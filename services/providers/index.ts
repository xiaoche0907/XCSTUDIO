import { ImageProvider, VideoProvider, ImageGenerationRequest, VideoGenerationRequest } from './types';
import { geminiImageProvider, geminiVideoProvider } from './gemini.provider';
import { replicateImageProvider } from './replicate.provider';
import { klingVideoProvider } from './kling.provider';

// All registered providers
const imageProviders: Map<string, ImageProvider> = new Map([
  ['gemini', geminiImageProvider],
  ['replicate', replicateImageProvider],
]);

const videoProviders: Map<string, VideoProvider> = new Map([
  ['gemini', geminiVideoProvider],
  ['kling', klingVideoProvider],
]);

// Model → Provider lookup
const modelToImageProvider: Record<string, string> = {
  'Nano Banana Pro': 'gemini',
  'NanoBanana2': 'gemini',
  'Seedream5.0': 'gemini',
  'Flux Schnell': 'replicate',
  'SDXL': 'replicate',
};

const modelToVideoProvider: Record<string, string> = {
  'Veo 3.1': 'gemini',
  'Veo 3.1 Pro': 'gemini',
  'Veo 3.1 Fast': 'gemini',
  'Auto': 'gemini',
  'Kling Standard': 'kling',
  'Kling Pro': 'kling',
  'Kling 2.0': 'kling',
  'Kling 2.6': 'kling',
};

export function getAvailableImageModels(): string[] {
  return Object.keys(modelToImageProvider);
}

export function getAvailableVideoModels(): string[] {
  return Object.keys(modelToVideoProvider);
}

export async function generateImageWithProvider(
  request: ImageGenerationRequest,
  model: string
): Promise<string | null> {
  const providerId = modelToImageProvider[model];
  if (!providerId) throw new Error(`未知图像模型: ${model}`);

  const provider = imageProviders.get(providerId);
  if (!provider) throw new Error(`未找到提供商: ${providerId}`);

  return provider.generateImage(request, model);
}

export async function generateVideoWithProvider(
  request: VideoGenerationRequest,
  model: string
): Promise<string | null> {
  const providerId = modelToVideoProvider[model];
  if (!providerId) throw new Error(`未知视频模型: ${model}`);

  const provider = videoProviders.get(providerId);
  if (!provider) throw new Error(`未找到提供商: ${providerId}`);

  return provider.generateVideo(request, model);
}

export { imageProviders, videoProviders };
