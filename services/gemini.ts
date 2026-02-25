
import { GoogleGenAI, Chat, GenerateContentResponse, Part, Content, VideoGenerationReferenceImage, VideoGenerationReferenceType, Type } from "@google/genai";

// Helper to get API Key dynamically
export const getApiKey = () => {
    const win = window as any;

    // 1. 优先使用 AI Studio 的 key
    if (win.aistudio && win.aistudio.getKey) {
        const key = win.aistudio.getKey();
        if (key) return key;
    }

    // 2. 其次使用 localStorage 中用户设置的对应提供商 key
    const provider = localStorage.getItem('api_provider') || 'gemini';
    let localKey = '';

    if (provider === 'gemini') localKey = localStorage.getItem('gemini_api_key') || '';
    else if (provider === 'yunwu') localKey = localStorage.getItem('yunwu_api_key') || '';
    else if (provider === 'custom') localKey = localStorage.getItem('custom_api_key') || '';

    // 为了兼容老用户，如果新字段没有，尝试取老字段
    if (!localKey) {
        localKey = localStorage.getItem('custom_api_key') || '';
    }

    if (localKey) return localKey;

    // 3. 最后才使用环境变量（可选）
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey && envKey !== 'undefined') return envKey;

    // 4. 如果都没有，返回 PLACEHOLDER 防止 crash
    return 'PLACEHOLDER';
};

// Helper to get API Base URL dynamically
const getApiUrl = () => {
    if (typeof window !== 'undefined') {
        const provider = localStorage.getItem('api_provider') || 'gemini';

        // 云雾API
        if (provider === 'yunwu') {
            return 'https://yunwu.ai';
        }

        // 自定义API
        if (provider === 'custom') {
            const url = localStorage.getItem('custom_api_url');
            if (url && url.trim()) return url.trim();
        }

        // Gemini原生 - 返回undefined使用默认值
    }
    return undefined;
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

// Models
const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_MODEL = 'gemini-3-flash-preview';
// Image Gen models
const IMAGE_PRO_MODEL = 'gemini-3-pro-image-preview';
const IMAGE_FLASH_MODEL = 'gemini-2.5-flash-preview-image-generation';
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
    model: 'Nano Banana' | 'Nano Banana Pro';
    aspectRatio: string;
    imageSize?: '1K' | '2K' | '4K';
    referenceImage?: string; // base64 (legacy)
    referenceImages?: string[]; // Multiple base64 images
}

export const generateImage = async (config: ImageGenerationConfig): Promise<string | null> => {
    const primaryModel = config.model === 'Nano Banana Pro' ? IMAGE_PRO_MODEL : IMAGE_FLASH_MODEL;
    // 降级顺序：Pro → Flash（确保 Pro 过载时仍能生成）
    const modelsToTry = primaryModel === IMAGE_PRO_MODEL
        ? [IMAGE_PRO_MODEL, IMAGE_FLASH_MODEL]
        : [IMAGE_FLASH_MODEL];

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
    model: 'Veo 3.1' | 'Veo 3.1 Fast';
    aspectRatio: string;
    startFrame?: string; // base64
    endFrame?: string; // base64
    referenceImages?: string[]; // array of base64
}

export const generateVideo = async (config: VideoGenerationConfig): Promise<string | null> => {
    try {
        // API Key Selection for Veo
        const win = window as any;
        if (win.aistudio) {
            const hasKey = await win.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await win.aistudio.openSelectKey();
            }
        }

        // New instance for Veo requests
        const genAI = getClient();

        let validAspectRatio = config.aspectRatio;
        // Veo models usually strictly support 16:9 or 9:16. 
        if (validAspectRatio !== '16:9' && validAspectRatio !== '9:16') {
            // Default to 16:9 if invalid for video (or map 1:1 to 16:9 for now as 1:1 is not strictly supported in standard Veo preview yet)
            validAspectRatio = '16:9';
        }

        let operation;
        const modelId = config.model === 'Veo 3.1' ? VEO_PRO_MODEL : VEO_FAST_MODEL;

        const commonConfig = {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: validAspectRatio
        };

        if (config.model === 'Veo 3.1 Fast') {
            // Fast Model: Supports prompt, image (start), lastFrame
            const request: any = {
                model: modelId,
                prompt: config.prompt,
                config: commonConfig
            };

            if (config.startFrame) {
                const matches = config.startFrame.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    request.image = {
                        mimeType: matches[1],
                        imageBytes: matches[2]
                    };
                }
            }
            // Fast model doesn't officially document lastFrame in standard public docs yet but system rules say so.
            // If provided, we add it.
            if (config.endFrame) {
                const matches = config.endFrame.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    request.config.lastFrame = {
                        mimeType: matches[1],
                        imageBytes: matches[2]
                    };
                }
            }
            operation = await retryWithBackoff(() => genAI.models.generateVideos(request));

        } else {
            // Veo 3.1 (Pro): Supports referenceImages, and usually start/end frames too.
            // Prioritize start/end if explicitly provided (First/Last mode).
            // Otherwise use referenceImages.

            const request: any = {
                model: modelId,
                prompt: config.prompt,
                config: commonConfig
            };

            if (config.startFrame || config.endFrame) {
                // Assuming Veo 3.1 supports image/lastFrame similar to Fast or better
                if (config.startFrame) {
                    const matches = config.startFrame.match(/^data:(.+);base64,(.+)$/);
                    if (matches) request.image = { mimeType: matches[1], imageBytes: matches[2] };
                }
                if (config.endFrame) {
                    const matches = config.endFrame.match(/^data:(.+);base64,(.+)$/);
                    if (matches) request.config.lastFrame = { mimeType: matches[1], imageBytes: matches[2] };
                }
            } else if (config.referenceImages && config.referenceImages.length > 0) {
                // Use Reference Images
                const refPayload: VideoGenerationReferenceImage[] = [];
                for (const imgStr of config.referenceImages) {
                    const matches = imgStr.match(/^data:(.+);base64,(.+)$/);
                    if (matches) {
                        refPayload.push({
                            image: {
                                mimeType: matches[1],
                                imageBytes: matches[2]
                            },
                            referenceType: 'ASSET' as any // Using ASSET as default reference type (or STYLE/CHARACTER if applicable)
                        });
                    }
                }
                request.config.referenceImages = refPayload;
            }

            operation = await retryWithBackoff(() => genAI.models.generateVideos(request));
        }

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await retryWithBackoff(() => genAI.operations.getVideosOperation({ operation: operation }));
        }

        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (uri) {
            return `${uri}&key=${getApiKey()}`;
        }
        return null;

    } catch (error: any) {
        console.error("Video Generation Error:", error);
        if (error.message && error.message.includes('Requested entity was not found')) {
            const win = window as any;
            if (win.aistudio) {
                // Reset key and prompt again if entity not found (key issue)
                await win.aistudio.openSelectKey();
                throw new Error("Please select a valid API key and try again.");
            }
        }
        throw error;
    }
}
