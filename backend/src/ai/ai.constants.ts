export const AI_QUEUE = 'ai-generation';

/** Версия текста согласия на обработку биометрии (журнал consents). */
export const AI_CONSENT_VERSION = '2026-11-01';
export const AI_CONSENT_TEXT =
  'Я даю согласие на обработку моего фото (изображение лица) для виртуальной примерки ' +
  'причёсок. Оператор — барбершоп; фото передаётся ИИ-провайдеру за пределами КР; ' +
  'исходник хранится 7 дней, результат — 14 дней; согласие можно отозвать, а данные ' +
  'удалить в личном кабинете. Мне исполнилось 18 лет.';

/** Активный ИИ-провайдер: auto → Gemini при наличии GEMINI_API_KEY, иначе mock (демо). */
export function activeAiProvider(): 'gemini' | 'hf' | 'mock' {
  const p = process.env.AI_PROVIDER ?? 'auto';
  if (p === 'gemini' || (p === 'auto' && process.env.GEMINI_API_KEY)) return 'gemini';
  if (p === 'hf') return 'hf';
  return 'mock';
}
