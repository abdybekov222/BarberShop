import { Injectable, Logger } from '@nestjs/common';
import { formatKgs } from '@barbershop/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Telegram-бот для уведомлений (ТЗ §1.3 — бесплатный канал в приоритете).
 * Bot API через HTTP, без дополнительных зависимостей.
 *
 * Кто получает уведомления салона: все администраторы и владельцы, которые подключили
 * Telegram в личном кабинете (users.telegram_chat_id), плюс TELEGRAM_OWNER_CHAT_ID, если задан.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string | null = process.env.TELEGRAM_BOT_TOKEN ?? null;
  private readonly envOwner: string | null;
  private cache: { at: number; ids: string[] } | null = null;

  constructor(private readonly prisma: PrismaService) {
    const owner = process.env.TELEGRAM_OWNER_CHAT_ID?.trim() || null;
    // Частая ошибка: вместо своего chat id вписан id бота (первая часть токена) — игнорируем
    const botId = this.token?.split(':')[0];
    this.envOwner = owner && owner !== botId ? owner : null;
    if (owner && !this.envOwner) {
      this.logger.warn('TELEGRAM_OWNER_CHAT_ID совпадает с id бота — это не ваш chat id. Подключите Telegram в кабинете админа.');
    }
    if (!this.token) this.logger.warn('TELEGRAM_BOT_TOKEN не задан — Telegram отключён');
  }

  get available(): boolean {
    return Boolean(this.token);
  }

  get hasToken(): boolean {
    return Boolean(this.token);
  }

  /** Chat id всех, кто получает уведомления салона (кэш 30 с). */
  async adminChats(): Promise<string[]> {
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache.ids;
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['admin', 'owner'] }, telegram_chat_id: { not: null }, deleted_at: null },
      select: { telegram_chat_id: true },
    });
    const ids = [...new Set([...(this.envOwner ? [this.envOwner] : []), ...admins.map((a) => String(a.telegram_chat_id))])];
    this.cache = { at: Date.now(), ids };
    return ids;
  }

  invalidateAdmins() {
    this.cache = null;
  }

  async isOwner(chatId: string | number): Promise<boolean> {
    return (await this.adminChats()).includes(String(chatId));
  }

  /** Отправить сообщение администраторам салона (опционально — с inline-кнопками). */
  async notifyOwner(text: string, buttons?: InlineButton[][]): Promise<void> {
    if (!this.token) return;
    const chats = await this.adminChats();
    if (chats.length === 0) this.logger.warn('Нет получателей уведомлений: подключите Telegram в кабинете администратора');
    await Promise.all(chats.map((id) => this.send(id, text, buttons)));
  }

  /** Отправить сообщение конкретному chatId (клиенту, если привязан TG). */
  async send(chatId: string, text: string, buttons?: InlineButton[][]): Promise<void> {
    await this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
    });
  }

  /** Вызов метода Bot API. Возвращает result или null при ошибке (ошибки только логируются). */
  async call<T = unknown>(method: string, payload: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T | null> {
    if (!this.token) return null;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
      if (!res.ok || !body?.ok) {
        this.logger.error(`Telegram ${method} failed: ${res.status} ${body?.description ?? ''}`);
        return null;
      }
      return body.result ?? null;
    } catch (e) {
      if ((e as Error).name !== 'AbortError') this.logger.error(`Telegram ${method} error: ${(e as Error).message}`);
      return null;
    }
  }

  // ─── Шаблоны уведомлений ──────────────────────────────────────────

  async notifyNewBooking(opts: {
    clientName: string;
    clientPhone: string;
    masterName: string;
    dateTime: string;
    services: string[];
    price: number;
    comment: string | null;
    withAiLook: boolean;
    bookingId: string;
  }) {
    const lines = [
      '🔔 <b>Новая запись</b> — требует подтверждения',
      `👤 ${escapeHtml(opts.clientName)} · ${opts.clientPhone}`,
      `💈 ${escapeHtml(opts.masterName)}`,
      `📅 ${opts.dateTime}`,
      `✂️ ${escapeHtml(opts.services.join(', '))}`,
      `💰 ${formatKgs(opts.price)}`,
      ...(opts.comment ? [`💬 ${escapeHtml(opts.comment)}`] : []),
      ...(opts.withAiLook ? ['🪞 Клиент прикрепил образ из ИИ-зеркала'] : []),
    ];
    await this.notifyOwner(lines.join('\n'), [
      [
        { text: '✅ Подтвердить', callback_data: `bk:ok:${opts.bookingId}` },
        { text: '❌ Отменить', callback_data: `bk:no:${opts.bookingId}` },
      ],
    ]);
  }

  async notifyNewOrder(opts: {
    orderId: string;
    number: number;
    clientName: string;
    phone: string;
    items: { name: string; qty: number; price: number }[];
    total: number;
    delivery: string;
    payment: string;
  }) {
    const lines = [
      `🛍 <b>Заказ №${opts.number}</b>`,
      `👤 ${escapeHtml(opts.clientName)} · ${opts.phone}`,
      ...opts.items.map((i) => `• ${escapeHtml(i.name)} × ${i.qty} — ${formatKgs(i.price * i.qty)}`),
      `💰 Итого: <b>${formatKgs(opts.total)}</b>`,
      `🚚 ${escapeHtml(opts.delivery)} · 💳 ${escapeHtml(opts.payment)}`,
    ];
    await this.notifyOwner(lines.join('\n'), [
      [
        { text: '🧾 В сборку', callback_data: `or:processing:${opts.orderId}` },
        { text: '❌ Отмена', callback_data: `or:cancel:${opts.orderId}` },
      ],
    ]);
  }

  async notifyBookingCancelled(opts: {
    clientName: string;
    masterName: string;
    dateTime: string;
    reason: string;
  }) {
    const lines = [
      '❌ <b>Запись отменена</b>',
      `👤 ${escapeHtml(opts.clientName)}`,
      `💈 ${escapeHtml(opts.masterName)}`,
      `📅 ${opts.dateTime}`,
      `Причина: ${escapeHtml(opts.reason)}`,
    ];
    await this.notifyOwner(lines.join('\n'));
  }

  async notifyFeedback(name: string, phone: string | null, message: string) {
    const lines = [
      '✉️ <b>Сообщение с сайта</b>',
      `👤 ${escapeHtml(name)}${phone ? ` · ${escapeHtml(phone)}` : ''}`,
      escapeHtml(message),
    ];
    if (!this.available) this.logger.log(`Обратная связь от ${name}: ${message}`);
    await this.notifyOwner(lines.join('\n'));
  }

  /** Список клиентов, которым нужно напомнить о визите (ТЗ §2.4: за 24 ч и за 2 ч). */
  async notifyReminders(title: string, rows: string[]) {
    if (rows.length === 0) return;
    await this.notifyOwner([`⏰ <b>${escapeHtml(title)}</b>`, ...rows.map(escapeHtml)].join('\n'));
  }

  async notifyAiBudgetAlert(pct: number, spent: number, budget: number) {
    const emoji = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : 'ℹ️';
    const lines = [
      `${emoji} <b>Бюджет ИИ ${pct}%</b>`,
      `Потрачено: $${spent.toFixed(4)} из $${budget.toFixed(2)}`,
    ];
    await this.notifyOwner(lines.join('\n'));
  }
}
