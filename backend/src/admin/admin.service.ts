import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BOOKING_STATUSES, type BookingStatus } from '@barbershop/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { TelegramService } from '../notifications/telegram.service';
import { formatSalonDateTime, salonDayRange } from '../common/time';

/** Ключи salon_settings, которые разрешено менять из админки. */
const EDITABLE_SETTINGS = new Set([
  'slot_step_min',
  'cancel_window_hours',
  'booking_horizon_days',
  'soft_lock_minutes',
  'ai_free_limit',
  'ai_ip_new_accounts_per_day',
  'ai_ip_generations_per_day',
  'ai_uploads_per_day',
  'ai_photo_ttl_days',
  'ai_result_ttl_days',
]);

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly telegram: TelegramService,
  ) {}

  // ─── Записи ────────────────────────────────────────────────────
  async getBookings(opts: {
    status?: string;
    masterId?: string;
    date?: string;
    skip?: number;
    take?: number;
  }) {
    const { status, masterId, date, skip = 0, take = 50 } = opts;
    const where: Prisma.BookingWhereInput = { deleted_at: null };
    if (status && (BOOKING_STATUSES as readonly string[]).includes(status)) {
      where.status = status as BookingStatus;
    }
    if (masterId) where.master_id = masterId;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const { start, end } = salonDayRange(date);
      where.starts_at = { gte: start, lt: end };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: { starts_at: 'asc' },
        skip,
        take,
        include: {
          user: { select: { id: true, full_name: true, email: true, phone: true } },
          master: { select: { id: true, name: true, slug: true } },
          items: { include: { service: { select: { id: true, name: true } } } },
          ai_generation: { select: { id: true, result_key: true, style: { select: { name: true } } } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: items.map((b) => ({
        ...b,
        ai_generation: b.ai_generation
          ? {
              id: b.ai_generation.id,
              style: b.ai_generation.style.name,
              result_url: this.storage.resolveUrl(b.ai_generation.result_key),
            }
          : null,
      })),
      total,
      skip,
      take,
    };
  }

  async updateBookingStatus(bookingId: string, status: string, adminId: string, reason?: string) {
    if (!(BOOKING_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException('Неизвестный статус');
    }
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { master: true, user: true },
    });
    if (!b) throw new NotFoundException('Запись не найдена');

    const cancelled = status === 'cancelled_by_salon' || status === 'cancelled_by_client';
    try {
      const updated = await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: status as BookingStatus,
          confirmed_by: status === 'confirmed' ? adminId : undefined,
          cancelled_at: cancelled ? new Date() : undefined,
          cancel_reason: cancelled ? (reason ?? 'Отменено салоном') : undefined,
          updated_at: new Date(),
        },
      });
      if (status === 'cancelled_by_salon') {
        void this.telegram.notifyBookingCancelled({
          clientName: b.user.full_name,
          masterName: b.master.name,
          dateTime: formatSalonDateTime(b.starts_at),
          reason: reason ?? 'отменено салоном',
        });
      }
      return updated;
    } catch (e) {
      if (String((e as Error).message).includes('no_overlap')) {
        throw new BadRequestException('Нельзя восстановить запись: время уже занято');
      }
      throw e;
    }
  }

  // ─── Статистика ─────────────────────────────────────────────────
  async getStats() {
    const today = salonDayRange();
    const weekAgo = new Date(Date.now() - 7 * 86400_000);
    const [totalBookings, pendingBookings, todayBookings, totalUsers, revenueWeek, aiUsersWeek] =
      await Promise.all([
        this.prisma.booking.count({ where: { deleted_at: null } }),
        this.prisma.booking.count({ where: { status: 'pending', deleted_at: null } }),
        this.prisma.booking.count({
          where: {
            deleted_at: null,
            status: { in: ['pending', 'confirmed', 'completed'] },
            starts_at: { gte: today.start, lt: today.end },
          },
        }),
        this.prisma.user.count({ where: { deleted_at: null } }),
        this.prisma.booking.aggregate({
          _sum: { total_price: true },
          where: { status: 'completed', starts_at: { gte: weekAgo } },
        }),
        this.prisma.aiGeneration.groupBy({
          by: ['user_id'],
          where: { created_at: { gte: weekAgo } },
        }),
      ]);

    return {
      totalBookings,
      pendingBookings,
      todayBookings,
      totalUsers,
      revenueWeek: revenueWeek._sum.total_price ?? 0,
      aiUsersWeek: aiUsersWeek.length,
    };
  }

  // ─── Мастера ────────────────────────────────────────────────────
  async getMasters() {
    return this.prisma.master.findMany({
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      include: {
        working_hours: { orderBy: { weekday: 'asc' } },
        master_services: { include: { service: true } },
        _count: { select: { bookings: true } },
      },
    });
  }

  async toggleMasterActive(masterId: string, isActive: boolean) {
    return this.prisma.master.update({
      where: { id: masterId },
      data: { is_active: isActive, updated_at: new Date() },
    });
  }

  async addTimeOff(masterId: string, startsAt: string, endsAt: string, reason?: string) {
    const s = new Date(startsAt);
    const e = new Date(endsAt);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) {
      throw new BadRequestException('Некорректный период');
    }
    return this.prisma.timeOff.create({
      data: { master_id: masterId, starts_at: s, ends_at: e, reason: reason ?? null },
    });
  }

  // ─── Услуги и цены ─────────────────────────────────────────────
  async getServices() {
    return this.prisma.service.findMany({
      orderBy: [{ category: { sort_order: 'asc' } }, { sort_order: 'asc' }],
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async updateService(
    id: string,
    data: {
      name?: string;
      description?: string;
      base_price?: number;
      price_is_from?: boolean;
      duration_min?: number;
      is_active?: boolean;
      sort_order?: number;
    },
  ) {
    return this.prisma.service.update({ where: { id }, data: { ...data, updated_at: new Date() } });
  }

  async createService(data: {
    category_id: string;
    name: string;
    description?: string;
    base_price: number;
    duration_min: number;
    price_is_from?: boolean;
    is_combo?: boolean;
  }) {
    const service = await this.prisma.service.create({ data });
    // Новая услуга по умолчанию доступна всем активным мастерам
    const masters = await this.prisma.master.findMany({ where: { is_active: true }, select: { id: true } });
    await this.prisma.masterService.createMany({
      data: masters.map((m) => ({ master_id: m.id, service_id: service.id })),
      skipDuplicates: true,
    });
    return service;
  }

  async getCategories() {
    return this.prisma.serviceCategory.findMany({ orderBy: { sort_order: 'asc' } });
  }

  // ─── Настройки ──────────────────────────────────────────────────
  async getSettings() {
    return this.settings.all();
  }

  async updateSetting(key: string, value: string) {
    if (!EDITABLE_SETTINGS.has(key)) throw new BadRequestException('Этот параметр нельзя менять');
    if (!/^\d+$/.test(value)) throw new BadRequestException('Ожидается целое число');
    const row = await this.prisma.salonSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value, updated_at: new Date() },
    });
    this.settings.invalidate();
    return row;
  }
}
