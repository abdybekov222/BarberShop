import { Inject, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SettingsService } from '../settings/settings.service';
import { AiBudgetService } from './ai-budget.service';
import { AI_PROVIDER_TOKEN, AiNetworkError, type AiProvider } from './providers/ai-provider.interface';

const TIMEOUT_MS = 90_000;

/**
 * Выполнение одной генерации (ТЗ §1.5 п.6, §3.5 шаг 3).
 * Вызывается BullMQ-воркером, а без Redis — напрямую из AiGenerationService.
 *
 * Успех → результат в хранилище (14 дней), фиксация фактической стоимости.
 * Сбой → если это не последняя попытка и ошибка сетевая — пробрасываем для повтора;
 * иначе — однократный возврат попытки и резерва бюджета.
 */
@Injectable()
export class AiProcessorService {
  private readonly logger = new Logger(AiProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
    private readonly budget: AiBudgetService,
    @Inject(AI_PROVIDER_TOKEN) private readonly provider: AiProvider,
  ) {}

  async run(generationId: string, opts: { canRetry: boolean }): Promise<void> {
    const gen = await this.prisma.aiGeneration.findUnique({
      where: { id: generationId },
      include: { photo: true, style: true },
    });
    if (!gen || !['queued', 'processing'].includes(gen.status)) return;

    await this.prisma.aiGeneration.update({
      where: { id: generationId },
      data: { status: 'processing', started_at: gen.started_at ?? new Date() },
    });

    try {
      const photo = await this.storage.read(gen.photo.storage_key);
      const result = await withTimeout(
        this.provider.generate({
          photo,
          style: {
            id: gen.style.id,
            name: gen.style.name,
            prompt: gen.style.prompt,
            negative_prompt: gen.style.negative_prompt,
            seed: gen.style.seed,
            model_params: (gen.style.model_params as Record<string, unknown>) ?? {},
          },
        }),
        TIMEOUT_MS,
      );

      let resultKey = result.resultUrl ?? null;
      if (result.image) {
        resultKey = `ai-results/${gen.user_id}/${gen.id}.jpg`;
        const jpeg = await sharp(result.image, { failOn: 'error' })
          .rotate()
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer();
        await this.storage.put(resultKey, jpeg);
      }
      if (!resultKey) throw new Error('EMPTY_RESULT');

      const ttlDays = await this.settings.getNumber('ai_result_ttl_days', 14);
      await this.prisma.aiGeneration.update({
        where: { id: generationId },
        data: {
          status: 'succeeded',
          result_key: resultKey,
          result_expires_at: new Date(Date.now() + ttlDays * 86400_000),
          cost_usd: result.costUsd,
          provider_job_id: result.providerJobId ?? null,
          finished_at: new Date(),
        },
      });
      await this.budget.confirmSpent(Number(gen.reserved_cost_usd ?? 0), result.costUsd);
      this.logger.log(`Generation ${generationId} succeeded`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (opts.canRetry && err instanceof AiNetworkError) {
        this.logger.warn(`Generation ${generationId}: сетевая ошибка, повтор (${msg})`);
        throw err;
      }
      this.logger.error(`Generation ${generationId} failed: ${msg}`);
      await this.budget.refund(generationId, msg);
      await this.budget.checkProviderErrors();
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new AiNetworkError('TIMEOUT')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
