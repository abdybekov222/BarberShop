import { Injectable, Logger } from '@nestjs/common';
import {
  AiNetworkError,
  type AiGenerationInput,
  type AiGenerationResult,
  type AiProvider,
} from './ai-provider.interface';

/**
 * HuggingFaceProvider — dev/резерв через Inference API (ТЗ §1.5, вариант А).
 * Активируется при AI_PROVIDER=hf. Модель — HF_MODEL (image-to-image с prompt).
 * Бесплатные лимиты HF нестабильны, поэтому для прода предусмотрены fal/hairapi.
 */
@Injectable()
export class HfAiProvider implements AiProvider {
  readonly name = 'hf';
  private readonly logger = new Logger(HfAiProvider.name);
  private readonly model = process.env.HF_MODEL ?? 'timbrooks/instruct-pix2pix';

  async generate({ photo, style }: AiGenerationInput): Promise<AiGenerationResult> {
    const token = process.env.HF_API_TOKEN;
    if (!token) throw new Error('HF_NOT_CONFIGURED');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 80_000);
    let res: Response;
    try {
      res = await fetch(`https://api-inference.huggingface.co/models/${this.model}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: photo.toString('base64'),
          parameters: {
            prompt: style.prompt ?? style.name,
            negative_prompt: style.negative_prompt ?? undefined,
            seed: style.seed ?? undefined,
            ...style.model_params,
          },
        }),
        signal: controller.signal,
      });
    } catch (e) {
      throw new AiNetworkError(`HF_NETWORK: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 503 || res.status === 504) throw new AiNetworkError(`HF_${res.status}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`HF ${res.status}: ${body.slice(0, 200)}`);
      throw new Error(`HF_${res.status}`);
    }

    const image = Buffer.from(await res.arrayBuffer());
    return { image, costUsd: 0, providerJobId: `hf-${Date.now()}` };
  }
}
