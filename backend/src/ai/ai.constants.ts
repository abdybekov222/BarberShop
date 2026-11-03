import { createHash } from 'crypto';

export const AI_QUEUE = 'ai-generation';

/** Версия текста согласия на обработку биометрии (журнал consents). */
export const AI_CONSENT_VERSION = '2026-11-01';
export const AI_CONSENT_TEXT =
  'Я даю согласие на обработку моего фото (изображение лица) для виртуальной примерки ' +
  'причёсок. Оператор — барбершоп; фото передаётся ИИ-провайдеру за пределами КР; ' +
  'исходник хранится 7 дней, результат — 14 дней; согласие можно отозвать, а данные ' +
  'удалить в личном кабинете. Мне исполнилось 18 лет.';

/** Активный ИИ-провайдер: auto → Gemini при наличии GEMINI_API_KEY, иначе mock (демо). */
export function activeAiProvider(): 'gemini' | 'hf' | 'cloudflare' | 'mock' {
  const p = process.env.AI_PROVIDER ?? 'auto';
  if (p === 'gemini' || (p === 'auto' && process.env.GEMINI_API_KEY)) return 'gemini';
  if (p === 'hf') return 'hf';
  if (p === 'cloudflare') return 'cloudflare';
  return 'mock';
}

/** Cache key follows the selected provider and its model, even if AI_PROVIDER changes. */
export function activeAiModelVersion(): string {
  const provider = activeAiProvider();
  const model =
    provider === 'gemini'
      ? process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-image'
      : provider === 'hf'
        ? process.env.HF_MODEL ?? 'black-forest-labs/FLUX.2-klein-9B'
        : provider === 'cloudflare'
          ? process.env.CF_AI_MODEL ?? '@cf/black-forest-labs/flux-2-klein-4b'
          : 'mock';
  const revision = process.env.AI_MODEL_VERSION?.trim() ?? '';
  const fingerprint = createHash('sha256')
    .update(`${provider}:${model}:${revision}`)
    .digest('hex')
    .slice(0, 16);

  return `${provider}:${fingerprint}`;
}

/** Conservative provider estimate used when reserving the shared AI budget. */
export function activeAiEstimatedCostUsd(): number {
  const provider = activeAiProvider();
  const [value, fallback] =
    provider === 'gemini'
      ? [process.env.GEMINI_COST_USD, 0.07]
      : provider === 'hf'
        ? [process.env.HF_COST_USD, 0.022]
        : provider === 'cloudflare'
          ? [process.env.CF_AI_COST_USD, 0.0013]
          : [undefined, 0];
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
