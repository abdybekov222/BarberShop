import { Injectable, Logger } from '@nestjs/common';
import { InferenceClient } from '@huggingface/inference';
import {
  AiNetworkError,
  type AiGenerationInput,
  type AiGenerationResult,
  type AiProvider,
} from './ai-provider.interface';

/** Hugging Face Inference Providers image-to-image integration. */
@Injectable()
export class HfAiProvider implements AiProvider {
  readonly name = 'hf';
  private readonly logger = new Logger(HfAiProvider.name);
  private readonly model = process.env.HF_MODEL ?? 'black-forest-labs/FLUX.2-klein-9B';
  // FLUX.2 [klein] 9B defaults to 1 MP input + 1 MP output ($0.022 per edit via fal-ai).
  private readonly cost = Number(process.env.HF_COST_USD ?? 0.022);

  async generate({ photo, style }: AiGenerationInput): Promise<AiGenerationResult> {
    const token = process.env.HF_API_TOKEN?.trim();
    if (!token) throw new Error('HF_NOT_CONFIGURED');

    const look = style.prompt?.trim() || style.name;
    const prompt = [
      'Edit this photo of a man. Change ONLY his hairstyle and facial hair to the following look:',
      `${look}.`,
      'Preserve his identity, face, facial features, skin tone, expression, head pose, clothing, lighting, and background.',
      'Photorealistic barbershop result, natural hair texture, sharp focus. Do not add text, watermarks, or other people.',
    ].join(' ');

    const client = new InferenceClient(token);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 85_000);

    try {
      const result = await client.imageToImage(
        {
          model: this.model,
          provider: 'fal-ai',
          inputs: new Blob([Uint8Array.from(photo)], { type: 'image/jpeg' }),
          parameters: {
            prompt,
            ...(style.negative_prompt ? { negative_prompt: style.negative_prompt } : {}),
          },
        },
        { signal: controller.signal },
      );

      const image = Buffer.from(await result.arrayBuffer());
      if (!image.length) throw new Error('HF_EMPTY_RESULT');

      return { image, costUsd: this.cost, providerJobId: `hf-${this.model}-${Date.now()}` };
    } catch (error) {
      const hfError = error as {
        status?: number;
        httpResponse?: { status?: number };
      };
      const status = hfError.status ?? hfError.httpResponse?.status;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiNetworkError('HF_TIMEOUT');
      }
      if (status === 429 || (status !== undefined && status >= 500)) {
        throw new AiNetworkError(`HF_${status}`);
      }
      const name = error instanceof Error ? error.name : 'UnknownError';
      const message = error instanceof Error ? error.message : String(error);
      const safeMessage = message.replaceAll(token, '[redacted]').slice(0, 240);
      this.logger.warn(
        `Hugging Face image edit failed${status ? ` (HTTP ${status})` : ''}: ${name}: ${safeMessage}`,
      );
      throw new Error(status ? `HF_${status}` : 'HF_FAILED');
    } finally {
      clearTimeout(timer);
    }
  }
}
