import { Chat } from '@google/genai';
import { createChatSession, getClient } from '../gemini';
import { AgentTask, AgentInfo, ProjectContext, GeneratedAsset } from '../../types/agent.types';
import { executeSkill } from '../skills';

export abstract class BaseAgent {
  protected chat: Chat | null = null;

  abstract get agentInfo(): AgentInfo;
  abstract get systemPrompt(): string;

  async initialize(context: ProjectContext): Promise<void> {
    this.chat = createChatSession('gemini-3-pro-preview', [], this.systemPrompt);
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    try {
      const ai = getClient();

      const { message, attachments, context } = task.input;
      const fullPrompt = `${this.systemPrompt}

Project Context:
- Title: ${context.projectTitle}
- Brand: ${JSON.stringify(context.brandInfo || {})}
- Existing Assets: ${context.existingAssets.length}

User Request: ${message}

IMPORTANT: You are a design AI agent. When the user asks to generate, edit, or adjust an image, you MUST return skillCalls with generateImage skill. Each proposal MUST include a "prompt" field with a detailed English image generation prompt following Imagen best practices (50-150 words, specific subject + style + lighting + quality).

If the user selected an image and wants modifications, analyze what they want and create new generation prompts that incorporate the changes.

TASK DECOMPOSITION RULES (CRITICAL):
- If the user requests multiple images (e.g., "5张副图", "一套图", "3张海报"), you MUST generate EXACTLY that many proposals, each with a DIFFERENT angle/purpose/composition.
- For e-commerce listing images (亚马逊副图/Amazon listing/电商主图/详情图):
  1. Product Infographic — key selling points with callout-style annotations, clean white background, 1:1
  2. Multi-Angle Product Shot — 3/4 angle or side view showing form factor, studio lighting, 1:1
  3. Lifestyle/Scene — product in real-use scenario with model or environment, natural lighting, 1:1
  4. Detail/Texture Close-up — macro shot of material, craftsmanship, or key feature, 1:1
  5. Size/Packaging — dimensions comparison or what's-in-the-box layout, 1:1
- For social media sets, poster series, or campaign assets, each image MUST have a distinct visual concept.
- NEVER return only 1 proposal when the user explicitly requests multiple images.

Always return your response as JSON.`;

      // Build content parts - text + optional image attachments
      const parts: any[] = [{ text: fullPrompt }];

      // Add image attachments if present
      if (attachments && attachments.length > 0) {
        for (const file of attachments) {
          try {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            parts.push({
              inlineData: {
                mimeType: file.type || 'image/png',
                data: base64
              }
            });
          } catch (e) {
            console.warn('[Agent] Failed to attach file:', e);
          }
        }
      }

      const toolConfig: any = {};
      
      if (task.input.metadata?.enableWebSearch) {
        toolConfig.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
        ...toolConfig
      });

      const responseText = response.text || '';
      console.log('[Agent] Raw response:', responseText.substring(0, 500));

      const parsed = this.parseResponse(responseText);

      // Handle Grounding Metadata (Sources)
      const groundingChunks = (response.candidates?.[0] as any)?.groundingMetadata?.groundingChunks;
      let sourceText = '';
      if (groundingChunks && groundingChunks.length > 0) {
        const sources = groundingChunks
            .map((chunk: any) => {
                if (chunk.web) {
                    return `[${chunk.web.title}](${chunk.web.uri})`;
                }
                return null;
            })
            .filter((s: any) => s) as string[];

        if (sources.length > 0) {
            sourceText = `\n\n**参考来源:**\n${sources.map((s: string) => `- ${s}`).join('\n')}`;
            if (parsed.message) {
                parsed.message += sourceText;
            }
            if (parsed.analysis) {
                parsed.analysis += sourceText;
            }
        }
      }

      console.log('[Agent] Parsed response:', JSON.stringify(parsed, null, 2).substring(0, 500));

      if (parsed.proposals && Array.isArray(parsed.proposals)) {
        console.log('[Agent] Found proposals:', parsed.proposals.length);

        // Auto-execute image generation for proposals that have prompts (concurrent with limit)
        const proposalsWithPrompts = parsed.proposals.filter((p: any) => p.prompt);
        const CONCURRENCY_LIMIT = 3;
        const generatedAssets: GeneratedAsset[] = [];

        for (let i = 0; i < proposalsWithPrompts.length; i += CONCURRENCY_LIMIT) {
          const batch = proposalsWithPrompts.slice(i, i + CONCURRENCY_LIMIT);
          const results = await Promise.allSettled(
            batch.map(async (proposal: any) => {
              const url = await executeSkill('generateImage', {
                prompt: proposal.prompt,
                model: proposal.model || 'Nano Banana',
                aspectRatio: proposal.aspectRatio || '1:1'
              });
              return { proposal, url };
            })
          );

          for (const result of results) {
            if (result.status === 'fulfilled' && result.value.url) {
              const { proposal, url } = result.value;
              generatedAssets.push({
                id: crypto.randomUUID(),
                type: 'image',
                url,
                metadata: { prompt: proposal.prompt, model: proposal.model || 'Nano Banana', agentId: this.agentInfo.id }
              });
              proposal.generatedUrl = url;
            } else if (result.status === 'rejected') {
              console.warn('[Agent] Skill execution failed:', result.reason);
            }
          }
        }

        return {
          ...task,
          status: 'completed',
          output: {
            message: parsed.analysis || parsed.message || '已为您生成设计方案',
            analysis: parsed.analysis,
            proposals: parsed.proposals,
            assets: generatedAssets,
            adjustments: parsed.adjustments || ['调整构图', '更换风格', '修改配色', '添加文字', '放大画质']
          },
          updatedAt: Date.now()
        };
      }

      const executedSkills = await this.executeSkills(parsed.skillCalls || []);
      const assets = this.extractAssets(executedSkills);

      return {
        ...task,
        status: 'completed',
        output: {
          message: parsed.message || parsed.concept || responseText,
          assets
        },
        updatedAt: Date.now()
      };
    } catch (error) {
      return {
        ...task,
        status: 'failed',
        output: {
          message: `Error: ${error instanceof Error ? error.message : String(error)}`
        },
        updatedAt: Date.now()
      };
    }
  }


  protected parseResponse(response: string): any {
    console.log('[parseResponse] Raw response:', response.substring(0, 200));

    let cleaned = response.trim();

    // Remove markdown code blocks
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
      console.log('[parseResponse] Extracted from code block');
    }

    // Try direct parse
    try {
      const result = JSON.parse(cleaned);
      console.log('[parseResponse] Parse success, has proposals:', !!result.proposals);
      return result;
    } catch (e) {
      console.log('[parseResponse] Direct parse failed:', e);
    }

    // Try to find the first complete JSON object
    let braceCount = 0;
    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '{') {
        if (braceCount === 0) startIndex = i;
        braceCount++;
      } else if (cleaned[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          endIndex = i;
          break;
        }
      }
    }

    if (startIndex !== -1 && endIndex !== -1) {
      const jsonStr = cleaned.substring(startIndex, endIndex + 1);
      try {
        const result = JSON.parse(jsonStr);
        console.log('[parseResponse] Extracted JSON parse success, has proposals:', !!result.proposals);
        return result;
      } catch (e) {
        console.error('[parseResponse] Extracted JSON parse failed:', e);
      }
    }

    console.log('[parseResponse] All parsing failed, returning fallback');
    return { message: response, skillCalls: [] };
  }

  protected async executeSkills(skillCalls: any[]): Promise<any[]> {
    const results: any[] = [];
    for (const call of skillCalls) {
      try {
        const result = await executeSkill(call.skillName, call.params);
        results.push({ ...call, result });
      } catch (error) {
        results.push({ ...call, error: String(error) });
      }
    }
    return results;
  }

  protected extractAssets(skillCalls: any[]): GeneratedAsset[] {
    return skillCalls
      .filter(s => s.result && (s.skillName === 'generateImage' || s.skillName === 'generateVideo'))
      .map(s => ({
        id: crypto.randomUUID(),
        type: s.skillName === 'generateImage' ? 'image' as const : 'video' as const,
        url: s.result,
        metadata: {
          prompt: s.params.prompt,
          model: s.params.model,
          agentId: this.agentInfo.id
        }
      }));
  }

  reset(): void {
    this.chat = null;
  }
}
