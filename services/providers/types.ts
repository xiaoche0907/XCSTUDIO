export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio: string;
  imageSize?: '1K' | '2K' | '4K';
  referenceImage?: string; // base64
  referenceImages?: string[];
}

export interface VideoGenerationRequest {
  prompt: string;
  aspectRatio: string;
  startFrame?: string; // base64
  endFrame?: string; // base64
  referenceImages?: string[];
}

export interface ImageProvider {
  id: string;
  name: string;
  models: string[];
  generateImage(request: ImageGenerationRequest, model: string): Promise<string | null>;
}

export interface VideoProvider {
  id: string;
  name: string;
  models: string[];
  generateVideo(request: VideoGenerationRequest, model: string): Promise<string | null>;
}

export type ProviderType = 'image' | 'video';
