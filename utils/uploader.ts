import { useImageHostStore } from '../stores/imageHost.store';

/**
 * 统一上传函数，根据 Store 中的配置自动选择图床并上传
 * @param file 要上传的图片文件
 * @returns 返回上传后的公网 URL
 */
export async function uploadImage(file: File): Promise<string> {
  const { selectedProvider, imgbbKey, customConfig } = useImageHostStore.getState(); // cspell:disable-line

  if (selectedProvider === 'none') {
    // 如果未配置图床，则返回本地临时 Object URL 以保证基础预览，但 Agent 无法从公网访问此 URL
    return URL.createObjectURL(file);
  }

  if (selectedProvider === 'imgbb') { // cspell:disable-line
    if (!imgbbKey) throw new Error('未配置 ImgBB API Key'); // cspell:disable-line
    
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { // cspell:disable-line
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || 'ImgBB 上传失败'); // cspell:disable-line
    }
    return data.data.url;
  }

  if (selectedProvider === 'custom') {
    const { uploadUrl, method, fileParamName, apiKeyParamName, apiKeyHeaderName, apiKey, responsePath } = customConfig;
    
    if (!uploadUrl) throw new Error('未配置自定义图床上传地址');

    const formData = new FormData();
    formData.append(fileParamName || 'image', file);
    
    // 处理 API Key 参数（如果是拼接到 URL 还是 Body）
    let url = uploadUrl;
    if (apiKeyParamName && apiKey) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}${apiKeyParamName}=${apiKey}`;
    }

    const headers: Record<string, string> = {};
    if (apiKeyHeaderName && apiKey) {
      headers[apiKeyHeaderName] = apiKey;
    }

    const response = await fetch(url, {
      method: method || 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error('自定义图床上传失败，请检查配置');
    }

    // 根据 responsePath 解析 URL (例如 "data.url" -> data.data.url)
    const urlResult = resolvePath(data, responsePath);
    if (!urlResult) {
      throw new Error(`无法从响应中解析图片地址: ${responsePath}`);
    }
    return urlResult;
  }

  return URL.createObjectURL(file);
}

/**
 * 辅助函数：根据路径字符串（如 "data.url"）从对象中取值
 */
function resolvePath(obj: any, path: string) {
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : undefined;
  }, obj);
}
