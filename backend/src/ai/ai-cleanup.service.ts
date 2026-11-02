import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AiPhotosService } from './ai-photos.service';

const INTERVAL_MS = 60 * 60 * 1000;

/**
 * Автоудаление фото (ТЗ §1.5): исходники — 7 дней, результаты — 14 дней.
 * Вторая линия защиты к Lifecycle-правилу хранилища: раз в час удаляет
 * просроченные файлы и обнуляет storage_key / result_key в БД.
 */
@Injectable()
export class AiCleanupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AiCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly photos: AiPhotosService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.run(), INTERVAL_MS);
    setTimeout(() => void this.run(), 10_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    try {
      const now = new Date();
      const photos = await this.prisma.aiPhoto.findMany({
        where: { expires_at: { lt: now }, deleted_at: null },
        select: { id: true },
        take: 500,
      });
      for (const p of photos) await this.photos.purgePhoto(p.id);

      const results = await this.prisma.aiGeneration.findMany({
        where: { result_expires_at: { lt: now }, result_key: { not: null } },
        select: { id: true, result_key: true, cache_hit: true },
        take: 500,
      });
      for (const g of results) {
        if (!g.cache_hit && g.result_key && !/^https?:/.test(g.result_key)) {
          await this.storage.remove(g.result_key);
        }
        await this.prisma.aiGeneration.update({ where: { id: g.id }, data: { result_key: null } });
      }

      if (photos.length || results.length) {
        this.logger.log(`Автоудаление: фото ${photos.length}, результатов ${results.length}`);
      }
    } catch (e) {
      this.logger.error(`Ошибка автоудаления: ${(e as Error).message}`);
    }
  }
}
