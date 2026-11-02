/**
 * Интерфейс провайдера ИИ-генерации (ТЗ §1.5).
 * Замена провайдера — через переменную окружения AI_PROVIDER, без релиза.
 */
export interface AiGenerationInput {
  /** Подготовленное фото клиента (JPEG, ≤1024 px, без EXIF). */
  photo: Buffer;
  style: {
    id: string;
    name: string;
    prompt: string | null;
    negative_prompt: string | null;
    seed: number | null;
    model_params: Record<string, unknown>;
  };
}

export interface AiGenerationResult {
  /** Готовое изображение — будет сохранено в приватное хранилище… */
  image?: Buffer;
  /** …либо URL результата у провайдера. */
  resultUrl?: string;
  costUsd: number;
  providerJobId?: string;
}

/** Ошибка сети/таймаута — единственный случай, когда допускается один повтор (ТЗ §1.5 п.6). */
export class AiNetworkError extends Error {
  readonly retryable = true;
}

export interface AiProvider {
  /** fal | hairapi | hf | mock */
  readonly name: string;
  generate(input: AiGenerationInput): Promise<AiGenerationResult>;
}

export const AI_PROVIDER_TOKEN = 'AI_PROVIDER';
