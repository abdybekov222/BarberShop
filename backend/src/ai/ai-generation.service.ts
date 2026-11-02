import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import type { AiGeneration, AiProvider as AiProviderEnum, HairStyle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { SettingsService } from '../settings/settings.service';
import { AiBudgetService } from './ai-budget.service';
import { AiProcessorService } from './ai-processor.service';
import { AI_QUEUE, activeAiProvider } from './ai.constants';
import { secondsToSalonMidnight } from '../common/time';

const PROVIDER_ENUM = new Set(['fal', 'hairapi', 'hf']);

/**
 * Запуск генерации ИИ (ТЗ §3.5, шаг 2). Проверки от дешёвых к дорогим,
 * на первом отказе — остановка:
 *  1. Kill switch → 503 AI_UNAVAILABLE
 *  2. Фото approved и принадлежит пользователю
 *  3. Идемпотентность (Idempotency-Key) — без нового списания
 *  4. Кэш (sha256 + стиль + версия модели) — без списания и без расхода бюджета
 *  5. Лимит IP → 429 AI_IP_LIMIT
 *  6. Потолки сайта в час/сутки → 503 AI_BUSY
 *  7. Транзакция: резерв бюджета + списание попытки (+ запись генерации и ledger)
 *  8. Постановка в очередь (BullMQ; без Redis — выполнение в процессе)
 */
@Injectable()
export class AiGenerationService {
  private readonly logger = new Logger(AiGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
    private readonly budget: AiBudgetService,
    private readonly processor: AiProcessorService,
    @Optional() @InjectQueue(AI_QUEUE) private readonly queue?: Queue,
  ) {}

  async start(opts: {
    userId: string;
    photoId: string;
    styleId: string;
    idempotencyKey?: string;
    ip: string | null;
  }) {
    const { userId, photoId, styleId, ip } = opts;
    const idempKey = `${userId}:${opts.idempotencyKey ?? uuidv4()}`.slice(0, 120);

    // 1. Kill switch
    await this.budget.assertEnabled();

    // 2. Фото и стиль
    const photo = await this.prisma.aiPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.user_id !== userId || photo.deleted_at) {
      throw new NotFoundException('Фото не найдено — загрузите его заново');
    }
    if (photo.status !== 'approved') throw new BadRequestException('Фото не прошло проверку');
    if (photo.expires_at < new Date()) {
      throw new BadRequestException('Срок хранения фото истёк — загрузите его заново');
    }
    const style = await this.prisma.hairStyle.findFirst({ where: { id: styleId, is_active: true } });
    if (!style) throw new NotFoundException('Образ не найден');

    // 3. Идемпотентность
    const existing = await this.prisma.aiGeneration.findUnique({
      where: { idempotency_key: idempKey },
      include: { style: true },
    });
    if (existing) return this.view(existing);

    // 4. Кэш
    const modelVersion = process.env.AI_MODEL_VERSION ?? 'gemini-3.1-flash-image';
    const cached = await this.prisma.aiGeneration.findFirst({
      where: {
        photo: { sha256: photo.sha256 },
        style_id: styleId,
        model_version: modelVersion,
        status: 'succeeded',
        result_key: { not: null },
        result_expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });
    if (cached) {
      const copy = await this.prisma.aiGeneration.create({
        data: {
          user_id: userId,
          photo_id: photoId,
          style_id: styleId,
          status: 'succeeded',
          provider: cached.provider,
          model_version: modelVersion,
          result_key: cached.result_key,
          result_expires_at: cached.result_expires_at,
          cache_hit: true,
          quota_charged: false,
          cost_usd: 0,
          idempotency_key: idempKey,
          started_at: new Date(),
          finished_at: new Date(),
        },
        include: { style: true },
      });
      this.logger.log(`Cache hit: ${cached.id} → ${copy.id}`);
      return this.view(copy);
    }

    // 5. Лимит генераций с одного IP (ТЗ §3.5: 9 в сутки)
    await this.assertIpLimit(userId, ip);

    // 6. Потолки сайта
    try {
      await this.budget.assertCaps();
    } catch (e) {
      await this.prisma.aiAbuseLog.create({ data: { user_id: userId, ip, rule: 'cap_day' } });
      throw e;
    }

    // 7. Атомарно: резерв + списание; затем запись генерации и ledger
    const providerName: string = activeAiProvider();
    const generation = await this.budget.reserveAndCreate(userId, async (reserved, balance) => {
      const g = await this.prisma.aiGeneration.create({
        data: {
          user_id: userId,
          photo_id: photoId,
          style_id: styleId,
          status: 'queued',
          provider: PROVIDER_ENUM.has(providerName) ? (providerName as AiProviderEnum) : null,
          model_version: modelVersion,
          quota_charged: true,
          reserved_cost_usd: reserved,
          idempotency_key: idempKey,
        },
        include: { style: true },
      });
      await this.prisma.aiQuotaLedger.create({
        data: {
          user_id: userId,
          generation_id: g.id,
          delta: -1,
          reason: 'generation',
          balance_after: balance,
        },
      });
      return g;
    });

    if (ip && this.redis.available) {
      await this.redis.incr(`ai:ip:gen:${ip}`, secondsToSalonMidnight());
    }

    // 8. Очередь
    if (this.queue) {
      await this.queue.add(
        'generate',
        { generationId: generation.id },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 },
        },
      );
    } else {
      setImmediate(() => {
        this.processor.run(generation.id, { canRetry: false }).catch((e) => {
          this.logger.error(`Inline generation ${generation.id}: ${(e as Error).message}`);
        });
      });
    }

    this.logger.log(`Generation queued: ${generation.id}`);
    return this.view(generation);
  }

  /** Polling: статус генерации. */
  async getStatus(generationId: string, userId: string) {
    const g = await this.prisma.aiGeneration.findUnique({
      where: { id: generationId },
      include: { style: true },
    });
    if (!g || g.user_id !== userId) throw new NotFoundException();
    return this.view(g);
  }

  /** Список генераций пользователя (с актуальными подписанными ссылками). */
  async listForUser(userId: string) {
    const rows = await this.prisma.aiGeneration.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 20,
      include: { style: true },
    });
    return rows.map((g) => this.view(g));
  }

  /** Removes a user's generated result while preserving quota and booking history. */
  async removeResult(userId: string, generationId: string) {
    const generation = await this.prisma.aiGeneration.findUnique({ where: { id: generationId } });
    if (!generation || generation.user_id !== userId) throw new NotFoundException();
    if (generation.status === 'queued' || generation.status === 'processing') {
      throw new BadRequestException('AI_GENERATION_IN_PROGRESS');
    }
    if (!generation.result_key) return { ok: true };

    const resultKey = generation.result_key;
    const updated = await this.prisma.aiGeneration.updateMany({
      where: { id: generation.id, user_id: userId, result_key: resultKey },
      data: { result_key: null, result_expires_at: null },
    });
    if (updated.count > 0 && !generation.cache_hit && !/^https?:/.test(resultKey)) {
      await this.storage.remove(resultKey);
    }
    return { ok: true };
  }

  private view(g: AiGeneration & { style?: HairStyle }) {
    const expired = g.result_expires_at ? g.result_expires_at < new Date() : false;
    return {
      id: g.id,
      status: g.status,
      style: g.style ? { id: g.style.id, name: g.style.name, type: g.style.type } : null,
      photo_id: g.photo_id,
      result_url: expired ? null : this.storage.resolveUrl(g.result_key),
      result_expires_at: g.result_expires_at,
      cache_hit: g.cache_hit,
      quota_charged: g.quota_charged,
      refunded: Boolean(g.quota_refunded_at),
      error_code: g.error_code,
      created_at: g.created_at,
    };
  }

  private async assertIpLimit(userId: string, ip: string | null): Promise<void> {
    const whitelist = (process.env.AI_IP_WHITELIST ?? '').split(',').map((s) => s.trim());
    if (ip && whitelist.includes(ip)) return;

    // Не более N новых аккаунтов с одного IP за сутки (ТЗ §3.5): ИИ доступен первым N,
    // остальным — отказ (сам аккаунт и запись к мастеру работают).
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.signup_ip && !whitelist.includes(user.signup_ip)) {
      const maxAccounts = await this.settings.getNumber('ai_ip_new_accounts_per_day', 3);
      const earlier = await this.prisma.user.count({
        where: {
          signup_ip: user.signup_ip,
          created_at: { gte: new Date(user.created_at.getTime() - 86400_000), lt: user.created_at },
        },
      });
      if (earlier >= maxAccounts) {
        await this.prisma.aiAbuseLog.create({ data: { user_id: userId, ip: user.signup_ip, rule: 'ip_accounts' } });
        throw new HttpException({ statusCode: 429, message: 'AI_IP_LIMIT' }, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    if (!ip || !this.redis.available) return;
    const limit = await this.settings.getNumber('ai_ip_generations_per_day', 9);
    const count = Number((await this.redis.get(`ai:ip:gen:${ip}`)) ?? 0);
    if (count >= limit) {
      await this.prisma.aiAbuseLog.create({ data: { user_id: userId, ip, rule: 'ip_generations' } });
      throw new HttpException(
        { statusCode: 429, message: 'AI_IP_LIMIT' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
