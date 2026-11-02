import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatSalonDateTime } from '../common/time';
import { TelegramService } from './telegram.service';

const INTERVAL_MS = 10 * 60 * 1000;

/**
 * Напоминания о визите за 24 ч и за 2 ч (ТЗ §2.4). Бесплатный канал — Telegram:
 * клиенту, если он привязал чат, а владельцу — сводка «кому напомнить/позвонить».
 * Каждое напоминание отправляется один раз (reminder_*_sent_at).
 */
@Injectable()
export class RemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  onApplicationBootstrap() {
    if (!this.telegram.available) return; // без канала доставки не помечаем как отправленные
    this.timer = setInterval(() => void this.run(), INTERVAL_MS);
    setTimeout(() => void this.run(), 20_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    try {
      await this.remind('24h', 24);
      await this.remind('2h', 2);
    } catch (e) {
      this.logger.error(`Напоминания: ${(e as Error).message}`);
    }
  }

  private async remind(kind: '24h' | '2h', hours: number) {
    const now = Date.now();
    const field = kind === '24h' ? 'reminder_24h_sent_at' : 'reminder_2h_sent_at';
    const due = await this.prisma.booking.findMany({
      where: {
        deleted_at: null,
        status: { in: ['pending', 'confirmed'] },
        starts_at: { gt: new Date(now), lte: new Date(now + hours * 3600_000) },
        [field]: null,
        // за 24 ч напоминаем только о записях, до которых больше 2 ч
        ...(kind === '24h' ? { NOT: { starts_at: { lte: new Date(now + 2 * 3600_000) } } } : {}),
      },
      include: {
        user: { select: { full_name: true, phone: true, telegram_chat_id: true } },
        master: { select: { name: true } },
      },
      orderBy: { starts_at: 'asc' },
    });
    if (due.length === 0) return;

    const rows: string[] = [];
    for (const b of due) {
      const when = formatSalonDateTime(b.starts_at);
      if (b.user.telegram_chat_id) {
        await this.telegram.send(
          String(b.user.telegram_chat_id),
          `Напоминаем о визите в барбершоп: ${when}, мастер ${b.master.name}. Ждём вас!`,
        );
      }
      rows.push(`${when} · ${b.user.full_name} ${b.user.phone ?? ''} · ${b.master.name}${b.status === 'pending' ? ' · ⚠️ не подтверждена' : ''}`);
    }
    await this.prisma.booking.updateMany({
      where: { id: { in: due.map((b) => b.id) } },
      data: { [field]: new Date() },
    });
    await this.telegram.notifyReminders(
      kind === '24h' ? 'Визиты в ближайшие сутки' : 'Визиты в ближайшие 2 часа',
      rows,
    );
    this.logger.log(`Напоминания ${kind}: ${due.length}`);
  }
}
