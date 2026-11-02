import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { addDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SALON_TZ, salonDayRange } from '../common/time';

/** Данные для графиков админ-панели (recharts): выручка, записи, заказы, топ товаров. */
@Controller('admin/stats')
@UseGuards(RolesGuard)
@Roles('admin', 'owner')
export class AdminStatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('charts')
  async charts(@Query('days') daysRaw?: string) {
    const days = Math.min(Math.max(Number(daysRaw) || 14, 7), 90);
    const today = salonDayRange();
    const from = new Date(today.end.getTime() - days * 86400_000);

    const [bookings, orders, topItems, byMaster] = await Promise.all([
      this.prisma.booking.findMany({
        where: { starts_at: { gte: from, lt: today.end }, deleted_at: null },
        select: { starts_at: true, status: true, total_price: true },
      }),
      this.prisma.order.findMany({
        where: { created_at: { gte: from }, status: { not: 'cancelled' } },
        select: { created_at: true, total: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ['name'],
        where: { order: { status: { not: 'cancelled' } } },
        _sum: { qty: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 5,
      }),
      this.prisma.booking.groupBy({
        by: ['master_id'],
        where: { starts_at: { gte: from }, status: { in: ['confirmed', 'completed'] } },
        _count: true,
      }),
    ]);

    const key = (d: Date) => format(toZonedTime(d, SALON_TZ), 'yyyy-MM-dd');
    const series = new Map<string, { date: string; bookings: number; services: number; shop: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = key(addDays(today.start, -i));
      series.set(d, { date: d.slice(5), bookings: 0, services: 0, shop: 0 });
    }
    for (const b of bookings) {
      const row = series.get(key(b.starts_at));
      if (!row) continue;
      if (b.status !== 'cancelled_by_client' && b.status !== 'cancelled_by_salon') row.bookings += 1;
      if (b.status === 'completed') row.services += b.total_price;
    }
    for (const o of orders) {
      const row = series.get(key(o.created_at));
      if (row) row.shop += o.total;
    }

    const masters = await this.prisma.master.findMany({ select: { id: true, name: true } });
    const names = new Map(masters.map((m) => [m.id, m.name]));

    return {
      daily: [...series.values()],
      topProducts: topItems.map((t) => ({ name: t.name, qty: t._sum.qty ?? 0 })),
      byMaster: byMaster.map((m) => ({ name: names.get(m.master_id) ?? '—', count: m._count })),
      totals: {
        bookings: bookings.filter((b) => !b.status.startsWith('cancelled')).length,
        services: bookings.filter((b) => b.status === 'completed').reduce((a, b) => a + b.total_price, 0),
        shop: orders.reduce((a, o) => a + o.total, 0),
        orders: orders.length,
      },
    };
  }
}
