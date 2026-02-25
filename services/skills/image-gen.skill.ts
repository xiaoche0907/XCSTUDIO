import { generateImageWithProvider } from '../providers';
import { ImageGenSkillParams } from '../../types/skill.types';

export async function imageGenSkill(params: ImageGenSkillParams): Promise<string | null> {
  let enhancedPrompt = params.prompt;

  if (params.brandContext?.colors?.length) {
    enhancedPrompt += `, color palette: ${params.brandContext.colors.join(', ')}`;
  }

  if (params.brandContext?.style) {
    enhancedPrompt += `, style: ${params.brandContext.style}`;
  }

  return generateImageWithProvider(
    {
      prompt: enhancedPrompt,
      aspectRatio: params.aspectRatio,
      imageSize: params.imageSize || '2K',
      referenceImage: params.referenceImage,
      referenceImages: params.referenceImages,
    },
    params.model
  );
}
