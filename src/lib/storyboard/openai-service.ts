/**
 * OpenAIStoryboardService — generates storyboard images via DALL-E 3.
 *
 * Requires NEXT_PUBLIC_OPENAI_API_KEY. Because this is a NEXT_PUBLIC_*
 * variable it is embedded in the client bundle — dangerouslyAllowBrowser is
 * set accordingly. This is consistent with the project's no-backend architecture.
 */

import OpenAI from 'openai';
import type { StoryboardGenerationService, StoryboardPromptContext } from './service';
import { buildStoryboardPrompt } from './prompt-builder';

export class OpenAIStoryboardService implements StoryboardGenerationService {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  async generateImage(context: StoryboardPromptContext): Promise<string> {
    const prompt = buildStoryboardPrompt(context);

    // Dev-time diagnostics — visible in browser console
    if (typeof window !== 'undefined') {
      console.log(
        `[storyboard] DALL-E call: frame ${context.frameIndex + 1}/${context.totalFrames}, ` +
          `prompt length ${prompt.length} chars`,
      );
    }

    try {
      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt,
        size: '1792x1024',
        response_format: 'b64_json',
        n: 1,
      });

      const base64 = response.data?.[0]?.b64_json;
      if (!base64) {
        throw new Error('DALL-E returned no image data');
      }
      return base64;
    } catch (err) {
      // Log full error detail so the failure mode is visible in dev tools
      if (typeof window !== 'undefined') {
        console.error('[storyboard] DALL-E error:', err);
      }
      // Re-throw with a clearer message if we can extract one from the API error
      if (err instanceof Error) {
        throw new Error(`DALL-E: ${err.message}`);
      }
      throw err;
    }
  }
}
