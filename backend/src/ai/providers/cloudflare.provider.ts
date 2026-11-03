import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import {
  AiNetworkError,
  type AiGenerationInput,
  type AiGenerationResult,
  type AiProvider,
} from './ai-provider.interface';

const DEFAULT_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';

interface CloudflareAiResponse {
  success?: boolean;
  result?: { image?: string };
  errors?: Array<{ message?: string; code?: number }>;
}

/** Cloudflare Workers AI FLUX.2 Klein 4B image editing. */
@Injectable()
export class CloudflareAiProvider implements AiProvider {
  readonly name = 'cloudflare';
  private readonly logger = new Logger(CloudflareAiProvider.name);
  private readonly model = process.env.CF_AI_MODEL ?? DEFAULT_MODEL;
  private readonly cost = Number(process.env.CF_AI_COST_USD ?? 0.0013);

  async generate({ photo, style }: AiGenerationInput): Promise<AiGenerationResult> {
    const accountId = process.env.CF_ACCOUNT_ID?.trim();
    const token = process.env.CF_API_TOKEN?.trim();
    if (!accountId || !token) throw new Error('CLOUDFLARE_NOT_CONFIGURED');

    const look = style.prompt?.trim() || style.name;
    const prompt = [
      'Edit the person in input_image_0. Change only the hairstyle and facial hair to this look:',
      `${look}.`,
      'Preserve the same person and identity, face shape and features, skin tone, expression, head pose, clothing, lighting, and background.',
      'Photorealistic barbershop result, natural hair texture, sharp focus. Do not add text, watermarks, or other people.',
      style.negative_prompt ? `Avoid: ${style.negative_prompt}.` : '',
    ].filter(Boolean).join(' ');

    const preparedPhoto = await sharp(photo, { failOn: 'error' })
      .rotate()
      .resize(511, 511, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    const form = new FormData();
    form.set('prompt', prompt);
    form.set('input_image_0', new Blob([Uint8Array.from(preparedPhoto)], { type: 'image/jpeg' }), 'photo.jpg');
    form.set('width', '768');
    form.set('height', '1024');
    if (style.seed !== null) form.set('seed', String(style.seed));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 85_000);
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${this.model}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          body: form,
          signal: controller.signal,
        },
      );

      const body = await response.json().catch(() => null) as CloudflareAiResponse | null;
      if (!response.ok) {
        const detail = body?.errors?.map((item) => item.message).filter(Boolean).join('; ') ?? '';
        const safeDetail = detail.replaceAll(token, '[redacted]').slice(0, 240);
        this.logger.warn(
          `Cloudflare image edit failed (HTTP ${response.status})${safeDetail ? `: ${safeDetail}` : ''}`,
        );
        if (response.status === 429 || response.status >= 500) {
          throw new AiNetworkError(`CLOUDFLARE_${response.status}`);
        }
        throw new Error(`CLOUDFLARE_${response.status}`);
      }

      const encodedImage = body?.result?.image;
      if (!encodedImage) throw new Error('CLOUDFLARE_EMPTY_RESULT');
      const base64 = encodedImage.replace(/^data:image\/[\w.+-]+;base64,/, '');
      const image = Buffer.from(base64, 'base64');
      if (!image.length) throw new Error('CLOUDFLARE_EMPTY_RESULT');

      return {
        image,
        costUsd: this.cost,
        providerJobId: `cloudflare-${this.model}-${Date.now()}`,
      };
    } catch (error) {
      if (error instanceof AiNetworkError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiNetworkError('CLOUDFLARE_TIMEOUT');
      }
      if (error instanceof Error && error.message.startsWith('CLOUDFLARE_')) throw error;

      const name = error instanceof Error ? error.name : 'UnknownError';
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cloudflare image edit request failed: ${name}: ${message.replaceAll(token, '[redacted]').slice(0, 240)}`);
      throw new AiNetworkError('CLOUDFLARE_NETWORK');
    } finally {
      clearTimeout(timer);
    }
  }
}
