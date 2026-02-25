import { ImageProvider, VideoProvider, ImageGenerationRequest, VideoGenerationRequest } from './types';
import { generateImage, generateVideo } from '../gemini';

export const geminiImageProvider: ImageProvider = {
  id: 'gemini',
  name: 'Gemini',
  models: ['Nano Banana', 'Nano Banana Pro'],

  async generateImage(request: ImageGenerationRequest, model: string): Promise<string | null> {
    return generateImage({
      prompt: request.prompt,
      model: model as 'Nano Banana' | 'Nano Banana Pro',
      aspectRatio: request.aspectRatio,
      imageSize: request.imageSize,
      referenceImage: request.referenceImage,
      referenceImages: request.referenceImages,
    });
  }
};

export const geminiVideoProvider: VideoProvider = {
  id: 'gemini',
  name: 'Gemini Veo',
  models: ['Veo 3.1', 'Veo 3.1 Fast'],

  async generateVideo(request: VideoGenerationRequest, model: string): Promise<string | null> {
    return generateVideo({
      prompt: request.prompt,
      model: model as 'Veo 3.1' | 'Veo 3.1 Fast',
      aspectRatio: request.aspectRatio,
      startFrame: request.startFrame,
      endFrame: request.endFrame,
      referenceImages: request.referenceImages,
    });
  }
};
