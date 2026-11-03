import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TelegramService } from '../notifications/telegram.service';
import { secondsToSalonMidnight } from '../common/time';
import { activeAiEstimatedCostUsd, activeAiProvider } from './ai.constants';

const HOUR_KEY = 'ai:cap:hour';
const DAY_KEY = 'ai:cap:day';
const ALERTED_KEY = 'ai:budget:alerted';

/** 402 AI_LIMIT_EXCEEDED — попытки на аккаунт закончились (ТЗ §3.5, шаг 9). */
export class AiLimitExceededException extends HttpException {
  constructor() {
    super({ statusCode: 402, message: 'AI_LIMIT_EXCEEDED' }, HttpStatus.PAYMENT_REQUIRED);
  }
}

/**
 * Управляет бюджетом $10, kill switch и потолками (ТЗ §1.5, §3.5).
 *
 * Перед вызовом провайдера:
 *  1. Kill switch → 503 AI_UNAVAILABLE
 *  2. Потолки (Redis, иначе — по БД) → 503 AI_BUSY
 *  3. Квота пользователя → 402 AI_LIMIT_EXCEEDED
 *  4. Атомарный резерв бюджета + списание квоты в одной транзакции
 */
@Injectable()
export class AiBudgetService {
  private readonly logger = new Logger(AiBudgetService.name);
  /** Резерв, если Redis нет: какие пороги алертов уже отправлены. */
  private alertedLocal = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly telegram: TelegramService,
  ) {}

  // ─── Проверки перед запуском ─────────────────────────────────────

  async assertEnabled(): Promise<void> {
    const budget = await this.prisma.aiBudget.findFirst({ where: { id: 1 } });
    if (!budget || budget.kill_switch) {
      throw new ServiceUnavailableException('AI_UNAVAILABLE');
    }
  }

  async assertCaps(): Promise<void> {
    const budget = await this.prisma.aiBudget.findFirst({ where: { id: 1 } });
    if (!budget) throw new ServiceUnavailableException('AI_UNAVAILABLE');
    const { hour, day } = await this.counters();
    if (hour >= budget.hourly_cap || day >= budget.daily_cap) {
      throw new ServiceUnavailableException('AI_BUSY');
    }
  }

  async assertQuota(userId: string): Promise<void> {
    const quota = await this.prisma.aiQuota.findUnique({ where: { user_id: userId } });
    if (!quota || quota.used_count >= quota.free_limit + quota.bonus_count) {
      throw new AiLimitExceededException();
    }
  }

  /**
   * Атомарный резерв (ТЗ §3.5, шаг 8–9): ОДНИМ SQL-оператором резервируем бюджет
   * и списываем попытку — либо оба UPDATE проходят, либо ни один. Строка ai_budget
   * блокируется (FOR UPDATE), поэтому параллельные запросы не превысят ни лимит,
   * ни бюджет. Один оператор вместо интерактивной транзакции — работает и через
   * PgBouncer с connection_limit=1 (Neon).
   *
   * `create` вызывается после списания; если он упал — попытка и резерв возвращаются.
   */
  async reserveAndCreate<T>(
    userId: string,
    create: (reservedCost: number, balanceAfter: number) => Promise<T>,
  ): Promise<T> {
    const providerEstimate = activeAiEstimatedCostUsd();
    const rows = await this.prisma.$queryRaw<
      { balance: number | null; est: number | null; budget_ok: boolean }[]
    >`
      WITH budget AS (
        SELECT GREATEST(est_cost_usd, ${providerEstimate}::numeric) AS est_cost_usd,
               (kill_switch = false AND spent_usd + reserved_usd + GREATEST(est_cost_usd, ${providerEstimate}::numeric) <= budget_usd) AS ok
        FROM ai_budget WHERE id = 1 FOR UPDATE
      ),
      quota AS (
        UPDATE ai_quotas
        SET used_count = used_count + 1, updated_at = now()
        WHERE user_id = ${userId}::uuid
          AND used_count < free_limit + bonus_count
          AND (SELECT ok FROM budget)
        RETURNING (free_limit + bonus_count - used_count)::int AS balance
      ),
      reserve AS (
        UPDATE ai_budget
        SET reserved_usd = reserved_usd + (SELECT est_cost_usd FROM budget), updated_at = now()
        WHERE id = 1 AND EXISTS (SELECT 1 FROM quota)
        RETURNING (SELECT est_cost_usd FROM budget)::float AS est
      )
      SELECT (SELECT balance FROM quota) AS balance,
             (SELECT est FROM reserve) AS est,
             COALESCE((SELECT ok FROM budget), false) AS budget_ok
    `;
    const r = rows[0];

    if (!r?.budget_ok) {
      // Автоотключение: остаток меньше стоимости одной генерации (ТЗ §3.5).
      const disabled = await this.prisma.aiBudget.updateMany({
        where: { id: 1, kill_switch: false },
        data: { kill_switch: true, kill_reason: 'budget' },
      });
      if (disabled.count > 0) {
        await this.telegram.notifyOwner('🚨 <b>ИИ-зеркало отключено</b>: бюджет исчерпан');
      }
      throw new ServiceUnavailableException('AI_UNAVAILABLE');
    }
    if (r.balance === null || r.est === null) throw new AiLimitExceededException();

    try {
      return await create(r.est, r.balance);
    } catch (e) {
      await this.release(userId, r.est);
      throw e;
    }
  }

  /** Возврат попытки и резерва одним оператором (без записи в ledger). */
  private async release(userId: string, reservedCost: number): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ balance: number }[]>`
      WITH b AS (
        UPDATE ai_budget
        SET reserved_usd = GREATEST(0, reserved_usd - ${reservedCost}::numeric), updated_at = now()
        WHERE id = 1
      )
      UPDATE ai_quotas
      SET used_count = GREATEST(0, used_count - 1), updated_at = now()
      WHERE user_id = ${userId}::uuid
      RETURNING (free_limit + bonus_count - used_count)::int AS balance
    `;
    return rows[0]?.balance ?? 0;
  }

  /** Подтвердить успешную генерацию: фактическая стоимость + счётчики потолков. */
  async confirmSpent(reservedCost: number, actualCost: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE ai_budget
      SET spent_usd    = spent_usd + ${actualCost}::numeric,
          reserved_usd = GREATEST(0, reserved_usd - ${reservedCost}::numeric),
          updated_at   = now()
      WHERE id = 1
    `;
    if (this.redis.available) {
      const secToNextHour = (60 - new Date().getMinutes()) * 60;
      await Promise.all([
        this.redis.incr(HOUR_KEY, secToNextHour),
        this.redis.incr(DAY_KEY, secondsToSalonMidnight()),
      ]);
    }
    await this.checkBudgetAlerts();
  }

  /**
   * Возврат попытки и резерва при сбое — строго один раз
   * (условие quota_refunded_at IS NULL, ТЗ §3.5 шаг 3). Возвращает true, если возврат выполнен.
   */
  async refund(generationId: string, errorCode: string): Promise<boolean> {
    const gen = await this.prisma.aiGeneration.findUnique({ where: { id: generationId } });
    if (!gen) return false;

    // Условный UPDATE — «замок» однократности: выиграет только один вызов.
    const marked = await this.prisma.aiGeneration.updateMany({
      where: { id: generationId, quota_refunded_at: null, quota_charged: true },
      data: {
        status: 'refunded',
        error_code: errorCode.slice(0, 80),
        quota_refunded_at: new Date(),
        finished_at: new Date(),
      },
    });
    if (marked.count === 0) {
      await this.prisma.aiGeneration.update({
        where: { id: generationId },
        data: { status: 'failed', error_code: errorCode.slice(0, 80), finished_at: new Date() },
      });
      return false;
    }

    const balance = await this.release(gen.user_id, Number(gen.reserved_cost_usd ?? 0));
    await this.prisma.aiQuotaLedger.create({
      data: {
        user_id: gen.user_id,
        generation_id: generationId,
        delta: 1,
        reason: 'refund',
        balance_after: balance,
      },
    });
    return true;
  }

  /** Circuit breaker: доля ошибок провайдера > 30% за 10 минут → kill switch. */
  async checkProviderErrors(): Promise<void> {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const [total, failed] = await Promise.all([
      this.prisma.aiGeneration.count({
        where: { finished_at: { gte: since }, cache_hit: false },
      }),
      this.prisma.aiGeneration.count({
        where: { finished_at: { gte: since }, cache_hit: false, status: { in: ['failed', 'refunded'] } },
      }),
    ]);
    if (total >= 3 && failed / total > 0.3) {
      await this.prisma.aiBudget.updateMany({
        where: { id: 1, kill_switch: false },
        data: { kill_switch: true, kill_reason: 'provider_errors' },
      });
      this.logger.error(`Circuit breaker: ${failed}/${total} ошибок провайдера за 10 мин`);
      await this.telegram.notifyOwner(
        `🚨 <b>ИИ-зеркало отключено</b>: ошибки провайдера ${failed}/${total} за 10 минут`,
      );
    }
  }

  async getStatus() {
    const b = await this.prisma.aiBudget.findFirst({ where: { id: 1 } });
    if (!b) return null;
    const spent = Number(b.spent_usd);
    const reserved = Number(b.reserved_usd);
    const total = Number(b.budget_usd);
    const { hour, day } = await this.counters();
    return {
      kill_switch: b.kill_switch,
      kill_reason: b.kill_reason,
      budget_usd: total,
      spent_usd: spent,
      reserved_usd: reserved,
      est_cost_usd: Number(b.est_cost_usd),
      remaining_usd: parseFloat((total - spent - reserved).toFixed(4)),
      hourly_cap: b.hourly_cap,
      daily_cap: b.daily_cap,
      generations_last_hour: hour,
      generations_today: day,
      provider: activeAiProvider(),
    };
  }

  // ─── Админка ──────────────────────────────────────────────────────

  async setKillSwitch(active: boolean): Promise<void> {
    await this.prisma.aiBudget.update({
      where: { id: 1 },
      data: { kill_switch: active, kill_reason: active ? 'manual' : null },
    });
  }

  async updateLimits(data: {
    hourly_cap?: number;
    daily_cap?: number;
    budget_usd?: number;
    est_cost_usd?: number;
  }): Promise<void> {
    await this.prisma.aiBudget.update({ where: { id: 1 }, data });
    if (data.budget_usd !== undefined) {
      this.alertedLocal.clear();
      await this.redis.del(ALERTED_KEY);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  /** Генерации за последний час и за сутки (Redis; без него — из БД). */
  private async counters(): Promise<{ hour: number; day: number }> {
    if (this.redis.available) {
      const [h, d] = await Promise.all([this.redis.get(HOUR_KEY), this.redis.get(DAY_KEY)]);
      return { hour: Number(h ?? 0), day: Number(d ?? 0) };
    }
    const now = Date.now();
    const midnight = new Date(now - (86400 - secondsToSalonMidnight()) * 1000);
    const active = { cache_hit: false, status: { in: ['queued', 'processing', 'succeeded'] as never } };
    const [hour, day] = await Promise.all([
      this.prisma.aiGeneration.count({
        where: { ...active, created_at: { gte: new Date(now - 3600_000) } },
      }),
      this.prisma.aiGeneration.count({ where: { ...active, created_at: { gte: midnight } } }),
    ]);
    return { hour, day };
  }

  /** Алерт владельцу в Telegram при 50/80/100% расхода (каждый порог — один раз). */
  private async checkBudgetAlerts(): Promise<void> {
    const b = await this.prisma.aiBudget.findFirst({ where: { id: 1 } });
    if (!b) return;
    const spent = Number(b.spent_usd);
    const total = Number(b.budget_usd);
    const pct = total > 0 ? (spent / total) * 100 : 100;
    const threshold = [100, 80, 50].find((t) => pct >= t);
    if (!threshold) return;

    const already = this.redis.available
      ? Number((await this.redis.get(ALERTED_KEY)) ?? 0) >= threshold
      : this.alertedLocal.has(threshold);
    if (already) return;
    if (this.redis.available) await this.redis.set(ALERTED_KEY, String(threshold));
    else this.alertedLocal.add(threshold);

    this.logger.warn(`ИИ-бюджет израсходован на ${threshold}%`);
    await this.telegram.notifyAiBudgetAlert(threshold, spent, total);
  }
}
