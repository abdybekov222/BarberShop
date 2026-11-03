import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiPhotosController } from './ai-photos.controller';
import { AiGenerationsController } from './ai-generations.controller';
import { AiStylesController } from './ai-styles.controller';
import { AiAdminController } from './ai-admin.controller';
import { AiPhotosService } from './ai-photos.service';
import { AiGenerationService } from './ai-generation.service';
import { AiProcessorService } from './ai-processor.service';
import { AiCleanupService } from './ai-cleanup.service';
import { AiBudgetService } from './ai-budget.service';
import { AiQuotaService } from './ai-quota.service';
import { AiWorker } from './ai.worker';
import { AI_QUEUE, activeAiProvider } from './ai.constants';
import { AI_PROVIDER_TOKEN } from './providers/ai-provider.interface';
import { MockAiProvider } from './providers/mock.provider';
import { HfAiProvider } from './providers/hf.provider';
import { GeminiAiProvider } from './providers/gemini.provider';
import { CloudflareAiProvider } from './providers/cloudflare.provider';

/** Выбирает провайдера по переменной окружения AI_PROVIDER. */
const aiProviderFactory = {
  provide: AI_PROVIDER_TOKEN,
  useFactory: () => {
    const p = activeAiProvider();
    if (p === 'gemini') return new GeminiAiProvider();
    if (p === 'hf') return new HfAiProvider();
    if (p === 'cloudflare') return new CloudflareAiProvider();
    return new MockAiProvider();
  },
};

/** Очередь и воркер BullMQ — только при наличии Redis; иначе генерация идёт в процессе API. */
const useQueue = Boolean(process.env.REDIS_URL);

@Module({
  imports: useQueue ? [BullModule.registerQueue({ name: AI_QUEUE })] : [],
  controllers: [
    AiPhotosController,
    AiGenerationsController,
    AiStylesController,
    AiAdminController,
  ],
  providers: [
    AiPhotosService,
    AiGenerationService,
    AiProcessorService,
    AiCleanupService,
    AiBudgetService,
    AiQuotaService,
    aiProviderFactory,
    ...(useQueue ? [AiWorker] : []),
  ],
  exports: [AiBudgetService, AiQuotaService, AiPhotosService],
})
export class AiModule {}
