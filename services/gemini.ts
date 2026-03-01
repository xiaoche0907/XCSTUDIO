
import { GoogleGenAI, Chat, GenerateContentResponse, Part, Content, Type } from "@google/genai";

// Helper to get API configurations
export const getProviderConfig = () => {
    const providerId = localStorage.getItem('api_provider') || 'gemini';
    const providersRaw = localStorage.getItem('api_providers');

    if (providersRaw) {
        try {
            const providers = JSON.parse(providersRaw);
            const found = providers.find((p: any) => p.id === providerId);
            if (found) return found;
        } catch (e) {
            console.error("Parse providers error", e);
        }
    }

    // Default Fallbacks for legacy/start
    if (providerId === 'gemini') {
        return {
            id: 'gemini',
            name: 'Gemini',
            baseUrl: 'https://generativelanguage.googleapis.com',
            apiKey: localStorage.getItem('gemini_api_key') || ''
        };
    } else if (providerId === 'yunwu') {
        return {
            id: 'yunwu',
            name: 'Yunwu',
            baseUrl: 'https://yunwu.ai',
            apiKey: localStorage.getItem('yunwu_api_key') || ''
        };
    }

    return { id: 'gemini', apiKey: '' };
};

// Helper to get API Key dynamically
export const getApiKey = (all: boolean = false) => {
    const win = window as any;

    if (win.aistudio && win.aistudio.getKey) {
        const key = win.aistudio.getKey();
        if (key) return all ? [key] : key;
    }

    const config = getProviderConfig();
    const rawKeys = config.apiKey || '';

    if (rawKeys) {
        const keys = rawKeys.split('\n')
            .map(k => k.trim())
            .filter(k => k && !k.startsWith('#'));

        if (keys.length > 0) {
            if (all) return keys;

            const storageKey = `api_poll_index_${config.id}`;
            let currentIndex = parseInt(localStorage.getItem(storageKey) || '0', 10);
            if (currentIndex >= keys.length) currentIndex = 0;
            const selectedKey = keys[currentIndex];
            localStorage.setItem(storageKey, ((currentIndex + 1) % keys.length).toString());
            return selectedKey;
        }
    }
    return all ? [] : 'PLACEHOLDER';
};

/**
 * Normalize and clean Base URL
 */
const normalizeUrl = (baseUrl: string): string => {
    let url = (baseUrl || '').trim().replace(/\/+$/, '');
    if (!url) return 'https://generativelanguage.googleapis.com';
    return url;
};

/**
 * Fetch available models from the provider, attempting all provided keys
 */
export const fetchAvailableModels = async (provider: string, keys: string[], baseUrl?: string) => {
    if (keys.length === 0) return [];

    const isGoogle = !baseUrl || baseUrl.includes('googleapis.com');
    const rootUrl = normalizeUrl(baseUrl || '');
    const allModels = new Set<string>();

    // 1. Special Handling: MemeFast Pricing API (Public list, high accuracy)
    const isMemeFast = rootUrl.includes('memefast.top'); /* cspell:disable-line */
    if (isMemeFast) {
        try {
            const pricingUrl = `${rootUrl}/api/pricing_new`;
            console.log(`[fetchAvailableModels] [MemeFast] Fetching pricing metadata: ${pricingUrl}`);
            const res = await fetch(pricingUrl);
            if (res.ok) {
                const json = await res.json();
                const data = json.data || [];
                if (Array.isArray(data)) {
                    data.forEach(m => {
                        if (m.model_name) allModels.add(m.model_name);
                    });
                }
            }
        } catch (e) {
            console.warn(`[fetchAvailableModels] [MemeFast] Pricing fetch failed, falling back to /v1/models`, e);
        }
    }

    // 2. Standard Logic: Iterate through all keys to find all accessible models
    const modelsPath = /\/v\d+$/.test(rootUrl) ? `${rootUrl}/models` : `${rootUrl}/v1/models`;
    const getGoogleUrl = (k: string) => `${rootUrl}/v1/models?key=${k}`;

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i].trim();
        if (!key) continue;

        try {
            const fetchUrl = isGoogle && !baseUrl ? getGoogleUrl(key) : modelsPath;
            console.log(`[fetchAvailableModels] [${provider}] Key #${i + 1} checking: ${fetchUrl}`);

            const res = await fetch(fetchUrl, {
                headers: isGoogle && !baseUrl ? {} : {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                }
            });

            if (res.ok) {
                const data = await res.json();
                const list = data.models || data.data || (Array.isArray(data) ? data : []);
                list.forEach((m: any) => {
                    const id = typeof m === 'string' ? m : (m.id || m.name || m.model);
                    if (id) allModels.add(id);
                });
                console.log(`[fetchAvailableModels] [${provider}] Key #${i + 1} found ${list.length} items.`);
            } else {
                console.warn(`[fetchAvailableModels] [${provider}] Key #${i + 1} returned ${res.status}`);
            }
        } catch (error) {
            console.error(`[fetchAvailableModels] [${provider}] Key #${i + 1} failed:`, error);
        }
    }

    const cleaned = Array.from(allModels).filter(Boolean);
    console.log(`[fetchAvailableModels] [${provider}] Total unique models found: ${cleaned.length}`);
    return cleaned;
};

// Helper to get API Base URL dynamically
const getApiUrl = () => {
    const config = getProviderConfig();
    return config.baseUrl;
};

// Initialize the GenAI client with dynamic key and url
export const getClient = () => {
    const config: any = { apiKey: getApiKey() };
    const baseUrl = getApiUrl();
    if (baseUrl) {
        config.httpOptions = { baseUrl }; // @google/genai SDK uses httpOptions.baseUrl
    }
    return new GoogleGenAI(config);
};

// Get base URL for video REST API (bypasses SDK's predictLongRunning endpoint)
const getVideoBaseUrl = () => {
    const baseUrl = getApiUrl();
    return (baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
};

// Models
const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_MODEL = 'gemini-3-flash-preview';
// Image Gen models
const IMAGE_PRO_MODEL = 'gemini-3-pro-image-preview';
const IMAGE_FLASH_MODEL = 'gemini-3-pro-image-preview';
const IMAGE_NANOBANANA_2_MODEL = 'gemini-3.1-flash-image-preview';
const IMAGE_SEEDREAM_MODEL = 'doubao-seedream-5-0-260128';
// Video Gen models
const VEO_FAST_MODEL = 'veo-3.1-fast-generate-preview';
const VEO_PRO_MODEL = 'veo-3.1-generate-preview';

// Helper for retry logic
const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    retries: number = 4,
    delay: number = 1000,
    factor: number = 2
): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        const statusCode = error.status || error.code || error.httpCode;
        const msg = error.message || '';

        // 可重试的错误：503（过载）、500（服务器错误）、429（限流）、网络错误
        const isRetryable =
            statusCode === 503 ||
            statusCode === 500 ||
            statusCode === 429 ||
            msg.includes('overloaded') ||
            msg.includes('UNAVAILABLE') ||
            msg.includes('503') ||
            msg.includes('500') ||
            msg.includes('429') ||
            msg.includes('RESOURCE_EXHAUSTED') ||
            msg.includes('rate limit') ||
            msg.includes('Too Many Requests') ||
            msg.includes('Internal Server Error') ||
            msg.includes('fetch failed') ||
            msg.includes('network');

        if (retries > 0 && isRetryable) {
            // 429 限流时使用更长的延迟
            const actualDelay = (statusCode === 429 || msg.includes('429') || msg.includes('rate limit'))
                ? Math.max(delay, 3000)
                : delay;
            console.warn(`[API重试] 错误码=${statusCode || 'unknown'}, ${actualDelay}ms 后重试... (剩余 ${retries} 次)`);
            await new Promise(resolve => setTimeout(resolve, actualDelay));
            return retryWithBackoff(fn, retries - 1, actualDelay * factor, factor);
        }
        throw error;
    }
};

export const createChatSession = (model: string = PRO_MODEL, history: Content[] = [], systemInstruction?: string): Chat => {
    return getClient().chats.create({
        model: model,
        history: history,
        config: {
            systemInstruction: systemInstruction || `You are XcAISTUDIO, an expert AI design assistant. You help users create posters, branding, and design elements.
      
      CRITICAL OUTPUT RULE:
      When you suggest visual designs or when the user asks for a design plan, YOU MUST provide specific actionable generation options.
      Do not just describe them in text. You MUST output a structured JSON block for each option so the user can click to generate it.
      
      Format:
      \`\`\`json:generation
      {
        "title": "Design Style Name (e.g. Minimalist Blue)",
        "description": "Short explanation of this style",
        "prompt": "The full detailed prompt for image generation..."
      }
      \`\`\`
      
      You can output multiple blocks. Keep the "title" short.`,
            temperature: 0.7
        },
    });
};

export const fileToPart = async (file: File): Promise<Part> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        // Determine mime type manually if missing (common for some windows configs)
        let mimeType = file.type;
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (!mimeType) {
            if (ext === 'pdf') mimeType = 'application/pdf';
            else if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            else if (ext === 'doc') mimeType = 'application/msword';
            else if (ext === 'md') mimeType = 'text/markdown';
            else if (ext === 'txt') mimeType = 'text/plain';
            else if (ext === 'png') mimeType = 'image/png';
            else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
            else if (ext === 'webp') mimeType = 'image/webp';
        }

        // Treat markdown and text as text parts
        if (mimeType === 'text/markdown' || mimeType === 'text/plain' || ext === 'md') {
            reader.onloadend = () => {
                resolve({ text: reader.result as string });
            };
            reader.readAsText(file);
        } else {
            // Treat others (images, pdf, docx) as inlineData (base64)
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve({
                    inlineData: {
                        data: base64String,
                        mimeType: mimeType || 'application/octet-stream'
                    }
                });
            };
            reader.readAsDataURL(file);
        }
        reader.onerror = reject;
    });
};

export const sendMessage = async (
    chat: Chat,
    message: string,
    attachments: File[] = [],
    enableWebSearch: boolean = false
): Promise<string> => {
    try {
        const parts: Part[] = [];

        // Add text if present
        if (message.trim()) {
            parts.push({ text: message });
        }

        // Add attachments
        for (const file of attachments) {
            const part = await fileToPart(file);
            parts.push(part);
        }

        if (parts.length === 0) return "";

        const config: any = {};
        if (enableWebSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        const result: GenerateContentResponse = await retryWithBackoff(() => chat.sendMessage({
            message: parts,
            config
        }));

        let text = result.text || "I processed your request.";

        // Handle Grounding Metadata (Sources)
        const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks && groundingChunks.length > 0) {
            const sources = groundingChunks
                .map((chunk: any) => {
                    if (chunk.web) {
                        return `[${chunk.web.title}](${chunk.web.uri})`;
                    }
                    return null;
                })
                .filter(Boolean);

            if (sources.length > 0) {
                text += `\n\n**Sources:**\n${sources.map((s: string) => `- ${s}`).join('\n')}`;
            }
        }

        return text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Sorry, I encountered an error while processing your request. Please ensure the file types are supported.";
    }
};

export const analyzeImageRegion = async (imageBase64: string): Promise<string> => {
    try {
        const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
        if (!matches) throw new Error("Invalid base64 image");

        const response = await retryWithBackoff<GenerateContentResponse>(() => getClient().models.generateContent({
            model: FLASH_MODEL,
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: matches[1],
                            data: matches[2]
                        }
                    },
                    {
                        text: "请用中文简要描述这个画面区域的主体（例如：一只猫、红色杯子）。只输出主体名称，不要任何废话，不超过5个字。"
                    }
                ]
            }
        }));

        return response.text || "Analysis failed.";
    } catch (error) {
        console.error("Analysis Error:", error);
        return "Could not analyze selection.";
    }
};

export const extractTextFromImage = async (imageBase64: string): Promise<string[]> => {
    try {
        const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
        if (!matches) throw new Error("Invalid base64 image");

        const response = await retryWithBackoff<GenerateContentResponse>(() => getClient().models.generateContent({
            model: FLASH_MODEL,
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: matches[1],
                            data: matches[2]
                        }
                    },
                    {
                        text: "Identify all the visible text in this image. Return the result as a JSON array of strings. If there is no text, return an empty array."
                    }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        }));

        if (response.text) {
            return JSON.parse(response.text);
        }
        return [];
    } catch (error) {
        console.error("Extract Text Error:", error);
        return [];
    }
};

export interface ImageGenerationConfig {
    prompt: string;
    model: 'Nano Banana Pro' | 'NanoBanana2' | 'Seedream5.0' | 'GPT Image 1.5' | 'Flux.2 Max';
    aspectRatio: string;
    imageSize?: '1K' | '2K' | '4K';
    referenceImage?: string; // base64 (legacy)
    referenceImages?: string[]; // Multiple base64 images
}

// Seedream 使用 dall-e-3 格式 (OpenAI 兼容的 /v1/images/generations 端点)
const generateImageDallE3 = async (
    model: string,
    prompt: string,
    aspectRatio: string
): Promise<string | null> => {
    const baseUrl = getApiUrl() || 'https://yunwu.ai';
    const apiKey = getApiKey();

    // 将宽高比转换为 dall-e-3 支持的尺寸
    let size = '1024x1024';
    if (aspectRatio === '16:9') size = '1792x1024';
    else if (aspectRatio === '9:16') size = '1024x1792';
    else if (aspectRatio === '4:3') size = '1024x768';
    else if (aspectRatio === '3:4') size = '768x1024';

    console.log(`[generateImageDallE3] model=${model}, size=${size}`);

    const response = await retryWithBackoff(async () => {
        const res = await fetch(`${baseUrl}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                prompt,
                n: 1,
                size,
                response_format: 'b64_json',
            }),
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            const err: any = new Error(`dall-e-3 API error: ${res.status} ${errBody}`);
            err.status = res.status;
            throw err;
        }

        return res.json();
    });

    const b64 = response?.data?.[0]?.b64_json;
    if (b64) {
        console.log(`[generateImageDallE3] Success with model: ${model}`);
        return `data:image/png;base64,${b64}`;
    }

    // 如果返回的是 url 格式
    const url = response?.data?.[0]?.url;
    if (url) {
        console.log(`[generateImageDallE3] Got URL result from model: ${model}`);
        return url;
    }

    return null;
};

export const generateImage = async (config: ImageGenerationConfig): Promise<string | null> => {
    // Seedream 使用 dall-e-3 格式，走单独的路径
    if (config.model === 'Seedream5.0') {
        try {
            const result = await generateImageDallE3(IMAGE_SEEDREAM_MODEL, config.prompt, config.aspectRatio);
            if (result) return result;
        } catch (error: any) {
            console.warn(`[generateImage] Seedream dall-e-3 failed:`, error.message || error);
        }
        // Seedream 失败后 fallback 到 Gemini 模型
        console.log(`[generateImage] Seedream failed, falling back to Gemini model`);
    }

    // Get selected models from settings (multi-select)
    const selectedModels = JSON.parse(localStorage.getItem('setting_image_models') || '[]');
    let targetModels = selectedModels.length > 0 ? selectedModels : [IMAGE_PRO_MODEL];

    const storageKeyIdx = `service_poll_index_image`;
    let currentIdx = parseInt(localStorage.getItem(storageKeyIdx) || '0', 10);
    if (currentIdx >= targetModels.length) currentIdx = 0;

    let targetModelId = targetModels[currentIdx];
    // Update index for next time (Round Robin across service nodes)
    localStorage.setItem(storageKeyIdx, ((currentIdx + 1) % targetModels.length).toString());

    // Map high-level model names to internal IDs if needed
    if (targetModelId === 'Nano Banana Pro') targetModelId = IMAGE_PRO_MODEL;
    else if (targetModelId === 'NanoBanana2') targetModelId = IMAGE_NANOBANANA_2_MODEL;
    else if (targetModelId === 'Seedream5.0') targetModelId = IMAGE_FLASH_MODEL;

    // Concurrency check: If user has multi-key, the getApiKey() will handle its own poll.
    // Here we focus on model rotation.

    const modelsToTry = [...new Set([targetModelId, IMAGE_FLASH_MODEL])];

    let validAspectRatio = config.aspectRatio;
    const supported = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    if (!supported.includes(validAspectRatio)) {
        if (validAspectRatio === '21:9') validAspectRatio = '16:9';
        else if (validAspectRatio === '3:2') validAspectRatio = '16:9';
        else if (validAspectRatio === '2:3') validAspectRatio = '9:16';
        else if (validAspectRatio === '5:4') validAspectRatio = '4:3';
        else if (validAspectRatio === '4:5') validAspectRatio = '3:4';
        else validAspectRatio = '1:1';
    }

    const parts: any[] = [{ text: config.prompt }];

    // Handle multiple references (preferred) or single reference
    const imagesToProcess = config.referenceImages || (config.referenceImage ? [config.referenceImage] : []);

    for (const imgBase64 of imagesToProcess) {
        const matches = imgBase64.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
            parts.push({
                inlineData: {
                    mimeType: matches[1],
                    data: matches[2]
                }
            });
        }
    }

    const imageConfig: any = {
        aspectRatio: validAspectRatio,
    };

    if (config.model === 'Nano Banana Pro' && config.imageSize) {
        imageConfig.imageSize = config.imageSize;
    }

    let lastError: any = null;

    for (const modelToUse of modelsToTry) {
        try {
            console.log(`[generateImage] Trying model: ${modelToUse}`);
            const response = await retryWithBackoff<GenerateContentResponse>(() => getClient().models.generateContent({
                model: modelToUse,
                contents: { parts },
                config: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    imageConfig
                }
            }));

            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    console.log(`[generateImage] Success with model: ${modelToUse}`);
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
            // 没有图片数据但没报错 — 尝试下一个模型
            console.warn(`[generateImage] No image data from ${modelToUse}, trying next model`);
        } catch (error: any) {
            lastError = error;
            console.warn(`[generateImage] Model ${modelToUse} failed:`, error.message || error);
            // 继续尝试下一个模型
        }
    }

    console.error("Image Generation Error: all models failed", lastError);
    throw lastError || new Error('所有图片生成模型均不可用');
};

export interface VideoGenerationConfig {
    prompt: string;
    model: 'Veo 3.1' | 'Veo 3.1 Pro' | 'Veo 3.1 Fast';
    aspectRatio: string;
    startFrame?: string; // base64
    endFrame?: string; // base64
    referenceImages?: string[]; // array of base64
}

export const generateVideo = async (config: VideoGenerationConfig): Promise<string | null> => {
    try {
        const win = window as any;
        if (win.aistudio) {
            const hasKey = await win.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await win.aistudio.openSelectKey();
            }
        }

        let validAspectRatio = config.aspectRatio;
        if (validAspectRatio !== '16:9' && validAspectRatio !== '9:16') {
            validAspectRatio = '16:9';
        }

        // 1. Determine the target model ID
        let targetModelId = '';
        if (config.model === 'Veo 3.1' || config.model === 'Veo 3.1 Pro') targetModelId = VEO_PRO_MODEL;
        else if (config.model === 'Veo 3.1 Fast') targetModelId = VEO_FAST_MODEL;

        if (!targetModelId) {
            const selectedModels = JSON.parse(localStorage.getItem('setting_video_models') || '[]');
            const candidates = selectedModels.length > 0 ? selectedModels : [VEO_FAST_MODEL];
            const storageKeyIdx = `service_poll_index_video`;
            let currentIdx = parseInt(localStorage.getItem(storageKeyIdx) || '0', 10);
            if (currentIdx >= candidates.length) currentIdx = 0;
            targetModelId = candidates[currentIdx];
            localStorage.setItem(storageKeyIdx, ((currentIdx + 1) % candidates.length).toString());
            if (targetModelId === 'Veo 3.1 Pro' || targetModelId === 'Veo 3.1') targetModelId = VEO_PRO_MODEL;
            else if (targetModelId === 'Veo 3.1 Fast') targetModelId = VEO_FAST_MODEL;
        }

        const modelId = targetModelId || VEO_FAST_MODEL;
        const baseUrl = getVideoBaseUrl();
        const apiKey = getApiKey();
        console.log(`[generateVideo] model=${modelId}, baseUrl=${baseUrl}, prompt=${config.prompt.slice(0, 50)}...`);

        // 2. Build request body
        const genConfig: any = { numberOfVideos: 1, aspectRatio: validAspectRatio };
        const body: any = { model: `models/${modelId}`, prompt: config.prompt, config: genConfig };
        const isFastModel = modelId.includes('fast');

        if (config.startFrame) {
            const matches = config.startFrame.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                body.image = { mimeType: matches[1], imageBytes: matches[2] };
            }
        }
        if (config.endFrame) {
            const matches = config.endFrame.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                genConfig.lastFrame = { mimeType: matches[1], imageBytes: matches[2] };
            }
        }
        if (config.referenceImages && config.referenceImages.length > 0 && !isFastModel) {
            const refPayload: any[] = [];
            for (const imgStr of config.referenceImages) {
                const matches = imgStr.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    refPayload.push({
                        image: { mimeType: matches[1], imageBytes: matches[2] },
                        referenceType: 'ASSET'
                    });
                }
            }
            if (refPayload.length > 0) genConfig.referenceImages = refPayload;
        }

        // 3. POST via fetch — uses generateVideos endpoint (not SDK's predictLongRunning)
        const isGoogleDirect = baseUrl.includes('googleapis.com');
        const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (!isGoogleDirect) {
            authHeaders['Authorization'] = `Bearer ${apiKey}`;
        }

        const generateUrl = isGoogleDirect
            ? `${baseUrl}/v1beta/models/${modelId}:generateVideos?key=${apiKey}`
            : `${baseUrl}/v1beta/models/${modelId}:generateVideos`;
        console.log(`[generateVideo] POST ${generateUrl.replace(apiKey, '***')}`);

        const genRes = await retryWithBackoff(async () => {
            const r = await fetch(generateUrl, { method: 'POST', headers: authHeaders, body: JSON.stringify(body) });
            if (!r.ok) {
                const errBody = await r.text();
                const err: any = new Error(`generateVideos ${r.status}: ${errBody}`);
                err.status = r.status;
                throw err;
            }
            return r.json();
        });

        const operationName = genRes.name;
        if (!operationName) {
            throw new Error(`生成请求未返回 operation name: ${JSON.stringify(genRes).slice(0, 200)}`);
        }
        console.log(`[generateVideo] Operation created: ${operationName}`);

        // 4. Poll for completion
        let pollCount = 0;
        const MAX_POLLS = 60;

        while (pollCount < MAX_POLLS) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            pollCount++;

            const pollUrl = isGoogleDirect
                ? `${baseUrl}/v1beta/${operationName}?key=${apiKey}`
                : `${baseUrl}/v1beta/${operationName}`;

            try {
                const pollRes = await fetch(pollUrl, { headers: authHeaders });
                const pollData = await pollRes.json();
                console.log(`[generateVideo] Poll #${pollCount}: done=${pollData.done}`);

                if (pollData.done) {
                    if (pollData.error) {
                        throw new Error(`生成失败: ${pollData.error.message || JSON.stringify(pollData.error)}`);
                    }
                    const uri = pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
                        || pollData.response?.generatedVideos?.[0]?.video?.uri;
                    if (uri) {
                        return `${uri}${uri.includes('?') ? '&' : '?'}key=${apiKey}`;
                    }
                    throw new Error(`未获取到视频资源: ${JSON.stringify(pollData.response || pollData).slice(0, 300)}`);
                }
            } catch (pollErr: any) {
                if (pollErr.message?.startsWith('生成失败') || pollErr.message?.startsWith('未获取到')) throw pollErr;
                console.warn(`[generateVideo] Poll #${pollCount} error:`, pollErr.message);
            }
        }

        throw new Error("视频生成超时，请稍后在项目中查看。");

    } catch (error: any) {
        console.error("Video Generation Detailed Error:", error);
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('requested entity was not found')) {
            throw new Error("模型无法在当前节点找到，请检查设置中的模型映射。");
        } else if (msg.includes('503') || msg.includes('overloaded') || msg.includes('unavailable')) {
            throw new Error("服务商节点当前过载 (503)，请稍后重试或切换 API 节点。");
        } else if (msg.includes('403') || msg.includes('permission') || msg.includes('401')) {
            throw new Error("API 密钥权限不足或已失效，请检查设置。");
        }
        throw error;
    }
}
