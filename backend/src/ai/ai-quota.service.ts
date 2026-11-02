import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Управление квотами ИИ-генерации (аудит-ledger).
 */
@Injectable()
export class AiQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuota(userId: string) {
    const q = await this.prisma.aiQuota.findUnique({ where: { user_id: userId } });
    if (!q) return null;
    return {
      free_limit: q.free_limit,
      used_count: q.used_count,
      bonus_count: q.bonus_count,
      remaining: q.free_limit + q.bonus_count - q.used_count,
    };
  }

  /** Записывает строку в audit-ledger. */
  async logLedger(opts: {
    userId: string;
    generationId: string | null;
    delta: number;
    reason: 'generation' | 'refund' | 'admin_grant' | 'promo';
    balanceAfter: number;
  }) {
    await this.prisma.aiQuotaLedger.create({
      data: {
        user_id: opts.userId,
        generation_id: opts.generationId,
        delta: opts.delta,
        reason: opts.reason,
        balance_after: opts.balanceAfter,
      },
    });
  }
}
