import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SettingsService } from '../settings/settings.service';
import { AiBudgetService } from './ai-budget.service';
import { AI_CONSENT_TEXT, AI_CONSENT_VERSION } from './ai.constants';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MIN_SIDE = 512;
const TARGET_SIDE = 1024;

const REJECT_MESSAGES: Record<string, string> = {
  low_resolution: 'Разрешение фото меньше 512×512 — сделайте снимок крупнее',
  too_large: 'Файл слишком большой (максимум 10 МБ)',
  bad_angle: 'Фото должно быть вертикальным или квадратным — лицо крупно и анфас',
};

/**
 * Загрузка и проверка фото (ТЗ §3.5, шаг 1). Попытку НЕ списывает.
 * Согласие biometric_ai + 18+ → лимит загрузок → проверка изображения →
 * сжатие до 1024 px, JPEG q85, удаление EXIF → приватное хранилище, expires_at +7 дней.
 */
@Injectable()
export class AiPhotosService {
  private readonly logger = new Logger(AiPhotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
    private readonly budget: AiBudgetService,
  ) {}

  /** Фиксирует согласие на обработку биометрии в журнале consents. */
  async giveConsent(userId: string, ip: string | null, userAgent: string | null) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.consent.create({
        data: {
          user_id: userId,
          type: 'biometric_ai',
          text_version: AI_CONSENT_VERSION,
          text_hash: createHash('sha256').update(AI_CONSENT_TEXT).digest('hex'),
          ip,
          user_agent: userAgent,
        },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { consent_ai_at: now } }),
    ]);
    return { consent_ai_at: now, version: AI_CONSENT_VERSION };
  }

  async upload(userId: string, file: Express.Multer.File) {
    await this.budget.assertEnabled();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.consent_ai_at) {
      throw new ForbiddenException('AI_CONSENT_REQUIRED');
    }

    // Лимит загрузок на аккаунт в сутки
    const limit = await this.settings.getNumber('ai_uploads_per_day', 5);
    const uploadsToday = await this.prisma.aiPhoto.count({
      where: { user_id: userId, created_at: { gte: new Date(Date.now() - 86400_000) } },
    });
    if (uploadsToday >= limit) {
      throw new HttpException(
        { statusCode: 429, message: `Не более ${limit} загрузок фото в сутки. Попробуйте завтра.` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Поддерживаются только JPEG, PNG и WebP');
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.aiPhoto.findFirst({
      where: {
        user_id: userId,
        sha256,
        status: 'approved',
        deleted_at: null,
        expires_at: { gt: new Date() },
      },
    });
    if (existing) return this.view(existing.id, existing.storage_key, existing.status, sha256);

    const ttlDays = await this.settings.getNumber('ai_photo_ttl_days', 7);
    const photo = await this.prisma.aiPhoto.create({
      data: {
        user_id: userId,
        storage_key: `ai-photos/${userId}/${sha256}.jpg`,
        status: 'validating',
        sha256,
        expires_at: new Date(Date.now() + ttlDays * 86400_000),
      },
    });

    // Серверная проверка на CPU (бесплатно): декодирование, разрешение, пропорции.
    // Детекция лица/NSFW (MediaPipe/OpenCV) подключается здесь же на этапе R&D.
    let reject: 'low_resolution' | 'bad_angle' | null = null;
    let prepared: Buffer | null = null;
    let meta: { width: number; height: number } | null = null;
    try {
      const img = sharp(file.buffer, { failOn: 'error' }).rotate();
      const m = await img.metadata();
      const rotated = (m.orientation ?? 1) >= 5; // EXIF 5–8: снимок повёрнут на 90°
      const w = (rotated ? m.height : m.width) ?? 0;
      const h = (rotated ? m.width : m.height) ?? 0;
      meta = { width: w, height: h };
      if (Math.min(w, h) < MIN_SIDE) reject = 'low_resolution';
      else if (w / h > 1.6) reject = 'bad_angle';
      else {
        prepared = await img
          .resize(TARGET_SIDE, TARGET_SIDE, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer(); // sharp по умолчанию не переносит EXIF/GPS
      }
    } catch {
      reject = 'low_resolution';
    }

    if (reject || !prepared) {
      await this.prisma.aiPhoto.update({
        where: { id: photo.id },
        data: { status: 'rejected', reject_reason: reject ?? 'low_resolution', face_meta: meta ?? undefined },
      });
      throw new BadRequestException(REJECT_MESSAGES[reject ?? 'low_resolution']);
    }

    await this.storage.put(photo.storage_key, prepared);
    await this.prisma.aiPhoto.update({
      where: { id: photo.id },
      data: { status: 'approved', face_meta: meta ?? undefined },
    });
    this.logger.log(`Фото принято: ${photo.id}`);
    return this.view(photo.id, photo.storage_key, 'approved', sha256);
  }

  /** Досрочное удаление фото и всех результатов по нему (ТЗ §1.5, ПДн). */
  async remove(userId: string, photoId: string) {
    const photo = await this.prisma.aiPhoto.findUnique({
      where: { id: photoId },
      include: { ai_generations: true },
    });
    if (!photo || photo.user_id !== userId) throw new NotFoundException('Фото не найдено');
    await this.purgePhoto(photo.id);
    return { ok: true };
  }

  /** Удаляет файл исходника и результаты; ключи в БД обнуляются. Квота не меняется. */
  async purgePhoto(photoId: string) {
    const photo = await this.prisma.aiPhoto.findUnique({
      where: { id: photoId },
      include: { ai_generations: true },
    });
    if (!photo) return;
    await this.storage.remove(photo.storage_key);
    for (const g of photo.ai_generations) {
      if (g.result_key && !g.cache_hit && !/^https?:/.test(g.result_key)) {
        await this.storage.remove(g.result_key);
      }
    }
    await this.prisma.$transaction([
      this.prisma.aiGeneration.updateMany({
        where: { photo_id: photoId },
        data: { result_key: null },
      }),
      this.prisma.aiPhoto.update({
        where: { id: photoId },
        data: { storage_key: '', deleted_at: new Date() },
      }),
    ]);
  }

  private view(id: string, key: string, status: string, sha256: string) {
    return { id, sha256, status, preview_url: this.storage.signedUrl(key) };
  }
}
