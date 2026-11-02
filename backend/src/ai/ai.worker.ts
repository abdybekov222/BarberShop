import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { AI_QUEUE } from './ai.constants';
import { AiProcessorService } from './ai-processor.service';

/**
 * BullMQ worker — выполняет генерацию ИИ-изображения (ТЗ §1.5 п.6).
 * concurrency 2; один повтор только при сетевой ошибке (attempts: 2).
 * Регистрируется только при наличии REDIS_URL.
 */
@Processor(AI_QUEUE, { concurrency: 2 })
export class AiWorker extends WorkerHost {
  constructor(private readonly processor: AiProcessorService) {
    super();
  }

  async process(job: Job<{ generationId: string }>): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    await this.processor.run(job.data.generationId, {
      canRetry: job.attemptsMade + 1 < maxAttempts,
    });
  }
}
