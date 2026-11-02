import { Injectable, Logger } from '@nestjs/common';
import {
  AiNetworkError,
  type AiGenerationInput,
  type AiGenerationResult,
  type AiProvider,
} from './ai-provider.interface';
import { MockAiProvider } from './mock.provider';

/** Пока у ключа нет квоты на картинки (бесплатный тариф = 0), сайт работает в демо-режиме. */
export const geminiState = { quotaBlockedUntil: 0 };
const QUOTA_RETRY_MS = 30 * 60_000;

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
}

/**
 * Google Gemini (AI Studio) — редактирование фото: меняем только причёску/бороду.
 * Ключ: GEMINI_API_KEY (бесплатно на aistudio.google.com), модель — GEMINI_MODEL.
 * Фото уходит в Google только на время генерации (см. согласие /ai-consent).
 */
@Injectable()
export class GeminiAiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiAiProvider.name);
  private readonly key = process.env.GEMINI_API_KEY ?? '';
  private readonly models = (process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-image,gemini-3.1-flash-image')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  private readonly cost = Number(process.env.GEMINI_COST_USD ?? 0);
  private readonly fallback = new MockAiProvider();

  async generate({ photo, style }: AiGenerationInput): Promise<AiGenerationResult> {
    if (!this.key) throw new Error('GEMINI_NOT_CONFIGURED');
    if (geminiState.quotaBlockedUntil > Date.now()) return this.demo({ photo, style } as AiGenerationInput);

    const look = style.prompt?.trim() || style.name;
    const prompt = [
      'Edit this photo of a man. Change ONLY his hairstyle and facial hair to the following look:',
      look + '.',
      'Keep his face, identity, facial features, skin tone, expression, head pose, clothing, lighting and background exactly the same.',
      'Photorealistic barbershop result, natural hair texture, sharp focus. Do not add text, watermarks or other people.',
      style.negative_prompt ? `Avoid: ${style.negative_prompt}.` : '',
    ].join(' ');

    let lastError = 'GEMINI_FAILED';
    let quotaHit = false;
    let otherError = false;
    for (const model of this.models) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 85_000);
      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: photo.toString('base64') } }],
              },
            ],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(style.seed ? { seed: style.seed } : {}) },
          }),
          signal: controller.signal,
        });
      } catch (e) {
        throw new AiNetworkError(`GEMINI_NETWORK: ${(e as Error).message}`);
      } finally {
        clearTimeout(timer);
      }

      const body = (await res.json().catch(() => null)) as {
        candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
        error?: { message?: string; status?: string };
        promptFeedback?: { blockReason?: string };
      } | null;

      if (res.status === 503 || res.status === 500) throw new AiNetworkError(`GEMINI_${res.status}`);
      if (!res.ok) {
        lastError = `GEMINI_${res.status}: ${body?.error?.status ?? ''}`;
        this.logger.warn(`${model}: ${res.status} ${body?.error?.message?.slice(0, 200) ?? ''}`);
        // модель недоступна на этом ключе/тарифе — пробуем следующую
        if (res.status === 429 || res.status === 403) quotaHit = true;
        else if (res.status !== 404) otherError = true; // 404 — модели нет на этом ключе, не ошибка
        if (res.status === 404 || res.status === 400 || res.status === 429 || res.status === 403) continue;
        throw new Error(lastError);
      }

      const parts = body?.candidates?.[0]?.content?.parts ?? [];
      const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
      const data = img?.inlineData?.data ?? img?.inline_data?.data;
      if (!data) {
        lastError = body?.promptFeedback?.blockReason
          ? `GEMINI_BLOCKED_${body.promptFeedback.blockReason}`
          : `GEMINI_NO_IMAGE_${body?.candidates?.[0]?.finishReason ?? ''}`;
        this.logger.warn(`${model}: ${lastError}`);
        otherError = true;
        continue;
      }
      geminiState.quotaBlockedUntil = 0;
      return { image: Buffer.from(data, 'base64'), costUsd: this.cost, providerJobId: `${model}-${Date.now()}` };
    }
    if (quotaHit && !otherError) {
      // 429/403 на всех моделях — квоты на изображения нет (нужна оплата в AI Studio)
      this.logger.warn('Gemini: нет квоты на генерацию изображений — демо-режим на 30 минут');
      geminiState.quotaBlockedUntil = Date.now() + QUOTA_RETRY_MS;
      return this.demo({ photo, style } as AiGenerationInput);
    }
    throw new Error(lastError);
  }

  private async demo(input: AiGenerationInput): Promise<AiGenerationResult> {
    const r = await this.fallback.generate(input);
    return { ...r, costUsd: 0, providerJobId: `demo-${Date.now()}` };
  }
}
