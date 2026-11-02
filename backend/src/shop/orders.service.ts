import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { DeliveryMethod, OrderStatus, PaymentMethod, Prisma, User } from '@prisma/client';
import { validatePhone } from '@barbershop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../notifications/telegram.service';
import { MailService } from '../notifications/mail.service';

export const COURIER_PRICE = 200;
export const FREE_DELIVERY_FROM = 3000;
export const ORDER_STATUSES: OrderStatus[] = ['new', 'paid', 'processing', 'ready', 'completed', 'cancelled'];

export interface CreateOrderInput {
  items: { productId: string; qty: number }[];
  name: string;
  phone: string;
  email?: string;
  delivery: DeliveryMethod;
  address?: string;
  comment?: string;
  payment: PaymentMethod;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly mail: MailService,
  ) {}

  /**
   * Оформление заказа. Цены и наличие берутся только с сервера; остаток списывается
   * атомарно (UPDATE … WHERE stock >= qty) в одной транзакции — двойная продажа
   * последней единицы невозможна.
   */
  async create(user: User, input: CreateOrderInput) {
    const phone = validatePhone(input.phone);
    if (!phone.ok) throw new BadRequestException(phone.error);
    if (input.delivery === 'courier' && !input.address?.trim()) {
      throw new BadRequestException('Укажите адрес доставки');
    }
    const qtyById = new Map<string, number>();
    for (const i of input.items) qtyById.set(i.productId, (qtyById.get(i.productId) ?? 0) + i.qty);
    if (qtyById.size === 0) throw new BadRequestException('Корзина пуста');

    const products = await this.prisma.product.findMany({
      where: { id: { in: [...qtyById.keys()] }, is_active: true },
    });
    if (products.length !== qtyById.size) throw new BadRequestException('Некоторых товаров уже нет в продаже');

    const subtotal = products.reduce((a, p) => a + p.price * qtyById.get(p.id)!, 0);
    const deliveryPrice = input.delivery === 'courier' && subtotal < FREE_DELIVERY_FROM ? COURIER_PRICE : 0;

    const order = await this.prisma.$transaction(
      async (tx) => {
        for (const p of products) {
          const qty = qtyById.get(p.id)!;
          const updated = await tx.product.updateMany({
            where: { id: p.id, stock: { gte: qty } },
            data: { stock: { decrement: qty } },
          });
          if (updated.count === 0) {
            throw new BadRequestException(`«${p.name}»: осталось меньше, чем в корзине (${p.stock} шт.)`);
          }
        }
        return tx.order.create({
          data: {
            user_id: user.id,
            customer_name: input.name.trim(),
            phone: phone.value,
            email: input.email?.trim() || user.email || null,
            delivery: input.delivery,
            address: input.delivery === 'courier' ? input.address!.trim() : null,
            comment: input.comment?.trim() || null,
            payment_method: input.payment,
            subtotal,
            delivery_price: deliveryPrice,
            total: subtotal + deliveryPrice,
            items: {
              create: products.map((p) => ({ product_id: p.id, name: p.name, price: p.price, qty: qtyById.get(p.id)! })),
            },
          },
          include: { items: true },
        });
      },
      { maxWait: 15_000, timeout: 30_000 },
    );

    // Наличная оплата — уведомляем сразу; онлайн — после подтверждения оплаты
    if (input.payment === 'cash') await this.notify(order.id);
    return order;
  }

  /**
   * Демо-оплата картой (требование «Payment интеграция (demo)»): реальные данные карты
   * на сервер не передаются — клиент проверяет только тестовую карту 4242…, сервер
   * отмечает заказ оплаченным. Для боевого режима здесь подключается эквайринг.
   */
  async payDemo(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.user_id !== userId) throw new ForbiddenException();
    if (order.payment_method !== 'card_demo') throw new BadRequestException('Заказ оплачивается при получении');
    if (order.status !== 'new') throw new BadRequestException('Заказ уже оплачен или закрыт');
    const paid = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'paid', paid_at: new Date(), updated_at: new Date() },
      include: { items: true },
    });
    await this.notify(orderId);
    return paid;
  }

  forUser(userId: string) {
    return this.prisma.order.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: { items: { include: { product: { select: { slug: true, image_url: true } } } } },
    });
  }

  async one(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { slug: true, image_url: true } } } } },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.user_id !== userId) throw new ForbiddenException();
    return order;
  }

  /** Отмена клиентом — только пока заказ не собран; остаток возвращается на склад. */
  async cancel(orderId: string, userId: string) {
    const order = await this.one(orderId, userId);
    if (!['new', 'paid'].includes(order.status)) throw new BadRequestException('Заказ уже собран — позвоните нам');
    return this.setStatus(orderId, 'cancelled');
  }

  // ─── Админка ─────────────────────────────────────────────────────

  async list(opts: { status?: OrderStatus; page?: number; q?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const where: Prisma.OrderWhereInput = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.q
        ? {
            OR: [
              { customer_name: { contains: opts.q, mode: 'insensitive' } },
              { phone: { contains: opts.q } },
              ...(Number.isInteger(Number(opts.q)) ? [{ number: Number(opts.q) }] : []),
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
        include: { items: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, pages: Math.max(1, Math.ceil(total / 20)) };
  }

  async setStatus(orderId: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true, user: true } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (status === 'cancelled' && order.status !== 'cancelled') {
      // возврат остатков на склад
      await this.prisma.$transaction(
        order.items.map((i) => this.prisma.product.update({ where: { id: i.product_id }, data: { stock: { increment: i.qty } } })),
      );
    }
    const updated = await this.prisma.order.update({ where: { id: orderId }, data: { status, updated_at: new Date() } });
    if (order.user.telegram_chat_id && status !== order.status) {
      const label: Record<OrderStatus, string> = {
        new: 'принят',
        paid: 'оплачен',
        processing: 'собирается',
        ready: 'готов к выдаче',
        completed: 'выдан',
        cancelled: 'отменён',
      };
      await this.telegram.send(String(order.user.telegram_chat_id), `Заказ №${order.number}: ${label[status]}.`);
    }
    return updated;
  }

  private async notify(orderId: string) {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!o) return;
    const delivery = o.delivery === 'courier' ? `Курьер: ${o.address}` : 'Самовывоз из салона';
    const payment = o.payment_method === 'cash' ? 'при получении' : o.paid_at ? 'оплачен картой' : 'картой (ожидает)';
    await Promise.all([
      this.telegram.notifyNewOrder({
        orderId: o.id,
        number: o.number,
        clientName: o.customer_name,
        phone: o.phone,
        items: o.items,
        total: o.total,
        delivery,
        payment,
      }),
      o.email ? this.mail.orderCreated(o.email, { number: o.number, total: o.total, items: o.items, delivery }) : null,
    ]);
  }
}
