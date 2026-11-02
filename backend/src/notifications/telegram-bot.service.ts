import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { createHmac } from 'crypto';
import type { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatSalonDateTime, salonDayRange } from '../common/time';
import { TelegramService, escapeHtml } from './telegram.service';

interface TgUpdate {
  update_id: number;
  message?: { chat: { id: number; first_name?: string }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number; text?: string } };
}

const SITE = (process.env.PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'новый',
  paid: 'оплачен',
  processing: 'в сборке',
  ready: 'готов к выдаче',
  completed: 'выдан',
  cancelled: 'отменён',
};

/**
 * Telegram-бот салона (long polling, без внешних зависимостей).
 *
 * Клиенту: /start — меню и ссылки на запись и магазин; привязка аккаунта сайта
 * по ссылке из личного кабинета (t.me/<bot>?start=link_…) — после этого бот
 * присылает напоминания о визитах и статусы заказов.
 *
 * Владельцу (TELEGRAM_OWNER_CHAT_ID): /today — записи на сегодня, /orders — новые
 * заказы, кнопки «Подтвердить / Отменить» под каждой новой записью и смена статуса заказа.
 * /id — показать chat id (нужен для настройки TELEGRAM_OWNER_CHAT_ID).
 */
@Injectable()
export class TelegramBotService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private offset = 0;
  private running = false;
  private abort: AbortController | null = null;
  private username: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tg: TelegramService,
  ) {}

  async onApplicationBootstrap() {
    if (!this.tg.hasToken || process.env.TELEGRAM_POLLING === 'false') return;
    const me = await this.tg.call<{ username: string }>('getMe');
    if (!me) return;
    this.username = me.username;
    // long polling несовместим с вебхуком — снимаем его, если был
    await this.tg.call('deleteWebhook');
    await this.tg.call('setMyCommands', {
      commands: [
        { command: 'start', description: 'Меню' },
        { command: 'book', description: 'Записаться к мастеру' },
        { command: 'shop', description: 'Магазин косметики' },
        { command: 'contacts', description: 'Адрес и телефон' },
        { command: 'today', description: 'Записи на сегодня (для администратора)' },
        { command: 'orders', description: 'Новые заказы (для администратора)' },
      ],
    });
    this.logger.log(`Telegram-бот @${me.username} запущен`);
    this.running = true;
    void this.loop();
  }

  onModuleDestroy() {
    this.running = false;
    this.abort?.abort();
  }

  /** Ссылка для привязки Telegram к аккаунту сайта (кнопка в личном кабинете). */
  linkUrl(userId: string): string | null {
    if (!this.username) return null;
    return `https://t.me/${this.username}?start=link_${userId.replace(/-/g, '')}_${this.sign(userId)}`;
  }

  get botUsername(): string | null {
    return this.username;
  }

  private sign(userId: string): string {
    const secret = process.env.STORAGE_SIGNING_SECRET ?? process.env.TELEGRAM_BOT_TOKEN ?? 'dev';
    return createHmac('sha256', secret).update(userId).digest('hex').slice(0, 16);
  }

  private async loop() {
    while (this.running) {
      this.abort = new AbortController();
      const updates = await this.tg.call<TgUpdate[]>(
        'getUpdates',
        { offset: this.offset, timeout: 25, allowed_updates: ['message', 'callback_query'] },
        this.abort.signal,
      );
      if (!updates) {
        if (this.running) await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const u of updates) {
        this.offset = u.update_id + 1;
        try {
          if (u.message) await this.onMessage(u.message.chat.id, u.message.text ?? '', u.message.chat.first_name);
          if (u.callback_query) await this.onCallback(u.callback_query);
        } catch (e) {
          this.logger.error(`Обработка апдейта: ${(e as Error).message}`);
        }
      }
    }
  }

  private async onMessage(chatId: number, text: string, firstName?: string) {
    const [cmd, payload] = text.trim().split(/\s+/, 2);
    const owner = await this.tg.isOwner(chatId);

    switch (cmd?.split('@')[0]) {
      case '/start':
        if (payload?.startsWith('link_')) return this.link(chatId, payload);
        return this.tg.send(
          String(chatId),
          [
            `Здравствуйте${firstName ? `, ${escapeHtml(firstName)}` : ''}! Это бот <b>BARS Barber Club</b>.`,
            '',
            'Здесь можно записаться к мастеру, заглянуть в магазин и получать напоминания о визите.',
            'Чтобы бот присылал статусы ваших записей и заказов, привяжите Telegram в личном кабинете на сайте.',
          ].join('\n'),
          [
            [{ text: '✂️ Записаться', url: `${SITE}/booking` }],
            [
              { text: '🛍 Магазин', url: `${SITE}/shop` },
              { text: '👤 Кабинет', url: `${SITE}/account` },
            ],
          ],
        );
      case '/book':
        return this.tg.send(String(chatId), 'Выберите услугу, мастера и время — займёт минуту:', [
          [{ text: 'Открыть запись', url: `${SITE}/booking` }],
        ]);
      case '/shop':
        return this.tg.send(String(chatId), 'Помады, масла для бороды, бритвы и наборы — с самовывозом из салона:', [
          [{ text: 'Открыть магазин', url: `${SITE}/shop` }],
        ]);
      case '/contacts':
        return this.tg.send(
          String(chatId),
          `📍 ${escapeHtml(process.env.SALON_ADDRESS ?? 'г. Бишкек, ул. Московская, 123')}\n🕙 Пн–Сб 10:00–20:00, вс — выходной`,
        );
      case '/id':
        return this.tg.send(String(chatId), `Ваш chat id: <code>${chatId}</code>`);
      case '/today':
        return owner ? this.today(chatId) : this.denied(chatId);
      case '/orders':
        return owner ? this.newOrders(chatId) : this.denied(chatId);
      default:
        return this.tg.send(String(chatId), 'Не понял команду. Нажмите /start, чтобы открыть меню.');
    }
  }

  private denied(chatId: number) {
    return this.tg.send(String(chatId), 'Эта команда доступна только администратору салона.');
  }

  /** Привязка: link_<userId без дефисов>_<подпись>. */
  private async link(chatId: number, payload: string) {
    const [, raw, sig] = payload.split('_');
    if (!raw || raw.length !== 32 || !sig) return this.tg.send(String(chatId), 'Ссылка устарела. Откройте её заново из личного кабинета.');
    const userId = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
    if (this.sign(userId) !== sig) return this.tg.send(String(chatId), 'Ссылка недействительна.');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { telegram_chat_id: BigInt(chatId) },
    });
    this.tg.invalidateAdmins();
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    await this.tg.send(
      String(chatId),
      isAdmin
        ? `Готово, ${escapeHtml(user.full_name.split(' ')[0] ?? '')}! Вы администратор: сюда будут приходить новые записи и заказы с кнопками управления. Команды: /today, /orders.`
        : `Готово, ${escapeHtml(user.full_name.split(' ')[0] ?? '')}! Теперь сюда будут приходить напоминания о записях и статусы заказов.`,
    );
  }

  private async today(chatId: number) {
    const { start, end } = salonDayRange();
    const rows = await this.prisma.booking.findMany({
      where: { starts_at: { gte: start, lt: end }, status: { in: ['pending', 'confirmed'] }, deleted_at: null },
      orderBy: { starts_at: 'asc' },
      include: {
        user: { select: { full_name: true, phone: true } },
        master: { select: { name: true } },
        items: { include: { service: { select: { name: true } } } },
      },
    });
    if (rows.length === 0) return this.tg.send(String(chatId), 'На сегодня записей нет.');
    const text = rows
      .map((b) => {
        const time = b.starts_at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bishkek' });
        return `<b>${time}</b> ${escapeHtml(b.user.full_name)} ${b.user.phone ?? ''}\n   ${escapeHtml(b.master.name)} · ${escapeHtml(b.items.map((i) => i.service.name).join(', '))}${b.status === 'pending' ? ' · ⚠️ не подтверждена' : ''}`;
      })
      .join('\n');
    return this.tg.send(String(chatId), `📅 <b>Сегодня, ${rows.length}</b>\n${text}`);
  }

  private async newOrders(chatId: number) {
    const rows = await this.prisma.order.findMany({
      where: { status: { in: ['new', 'paid', 'processing', 'ready'] } },
      orderBy: { created_at: 'desc' },
      take: 15,
    });
    if (rows.length === 0) return this.tg.send(String(chatId), 'Открытых заказов нет.');
    return this.tg.send(
      String(chatId),
      rows
        .map((o) => `№${o.number} · ${escapeHtml(o.customer_name)} ${o.phone} · ${o.total} сом · ${ORDER_STATUS_LABEL[o.status]}`)
        .join('\n'),
    );
  }

  private async onCallback(q: NonNullable<TgUpdate['callback_query']>) {
    const chatId = q.message?.chat.id;
    if (!chatId || !(await this.tg.isOwner(chatId))) {
      await this.tg.call('answerCallbackQuery', { callback_query_id: q.id, text: 'Недостаточно прав' });
      return;
    }
    const [kind, action, id] = (q.data ?? '').split(':');
    let note = '';

    if (kind === 'bk' && id) {
      const status = action === 'ok' ? 'confirmed' : 'cancelled_by_salon';
      const b = await this.prisma.booking.update({
        where: { id },
        data: {
          status,
          ...(status === 'cancelled_by_salon' ? { cancelled_at: new Date(), cancel_reason: 'Отменено администратором' } : {}),
          updated_at: new Date(),
        },
        include: { user: true, master: true },
      });
      note = status === 'confirmed' ? '✅ Подтверждена' : '❌ Отменена';
      if (b.user.telegram_chat_id) {
        await this.tg.send(
          String(b.user.telegram_chat_id),
          status === 'confirmed'
            ? `Ваша запись подтверждена: ${formatSalonDateTime(b.starts_at)}, мастер ${escapeHtml(b.master.name)}. Ждём вас!`
            : `К сожалению, запись на ${formatSalonDateTime(b.starts_at)} отменена салоном. Мы свяжемся с вами, чтобы подобрать другое время.`,
        );
      }
    } else if (kind === 'or' && id) {
      const map: Record<string, OrderStatus> = { ready: 'ready', done: 'completed', cancel: 'cancelled' };
      const status = map[action ?? ''];
      if (!status) return;
      const o = await this.prisma.order.update({
        where: { id },
        data: { status, updated_at: new Date() },
        include: { user: true },
      });
      note = `Статус: ${ORDER_STATUS_LABEL[status]}`;
      if (o.user.telegram_chat_id) {
        await this.tg.send(String(o.user.telegram_chat_id), `Заказ №${o.number}: ${ORDER_STATUS_LABEL[status]}.`);
      }
    }

    await this.tg.call('answerCallbackQuery', { callback_query_id: q.id, text: note || 'Готово' });
    if (note && q.message) {
      await this.tg.call('editMessageText', {
        chat_id: chatId,
        message_id: q.message.message_id,
        text: `${q.message.text ?? ''}\n\n${note}`,
      });
    }
  }
}
