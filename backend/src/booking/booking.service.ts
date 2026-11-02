import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { addMinutes, parseISO } from 'date-fns';
import { Prisma, type User } from '@prisma/client';
import { validatePhone } from '@barbershop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SlotsService } from '../slots/slots.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { TelegramService } from '../notifications/telegram.service';
import { formatSalonDateTime } from '../common/time';
import { CreateBookingDto, CancelBookingDto } from './booking.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slots: SlotsService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly telegram: TelegramService,
  ) {}

  // ─── Создание записи ──────────────────────────────────────────────

  async create(dto: CreateBookingDto, user: User) {
    const phone = validatePhone(dto.phone);
    if (!phone.ok) throw new BadRequestException(phone.error);

    const serviceIds = [...new Set(dto.serviceIds)];
    const startsAt = parseISO(dto.startsAt);
    if (Number.isNaN(startsAt.getTime()) || startsAt < new Date()) {
      throw new BadRequestException('Некорректное время записи');
    }

    // Мастер: конкретный или первый свободный из подходящих
    let candidates: string[];
    if (dto.masterId === 'any') {
      candidates = await this.slots.eligibleMasterIds(serviceIds);
    } else if (UUID.test(dto.masterId)) {
      candidates = [dto.masterId];
    } else {
      throw new BadRequestException('Некорректный мастер');
    }
    if (candidates.length === 0) {
      throw new BadRequestException('Нет мастеров, выполняющих выбранные услуги');
    }

    if (dto.aiGenerationId) {
      const gen = await this.prisma.aiGeneration.findUnique({ where: { id: dto.aiGenerationId } });
      if (!gen || gen.user_id !== user.id) throw new BadRequestException('Образ не найден');
    }

    // Профиль: имя и телефон (для Google-аккаунтов номер вводится при записи, ТЗ §1.3)
    await this.updateContact(user, dto.name.trim(), phone.value);

    for (const masterId of candidates) {
      const masterServices = await this.prisma.masterService.findMany({
        where: { master_id: masterId, service_id: { in: serviceIds }, service: { is_active: true } },
        include: { service: true, master: true },
      });
      if (masterServices.length !== serviceIds.length || !masterServices[0]?.master.is_active) {
        if (dto.masterId !== 'any') {
          throw new BadRequestException('Мастер не выполняет одну из выбранных услуг');
        }
        continue;
      }

      const totalDuration = masterServices.reduce(
        (acc, ms) => acc + (ms.duration_override ?? ms.service.duration_min),
        0,
      );
      const totalPrice = masterServices.reduce(
        (acc, ms) => acc + (ms.price_override ?? ms.service.base_price),
        0,
      );
      const endsAt = addMinutes(startsAt, totalDuration);

      if (!(await this.slots.isFree(masterId, startsAt, totalDuration))) {
        if (dto.masterId === 'any') continue;
        throw new ConflictException('Выбранное время занято. Пожалуйста, выберите другой слот.');
      }

      // Soft-lock слота на время оформления
      if (!(await this.slots.lockSlot(masterId, startsAt.toISOString()))) {
        if (dto.masterId === 'any') continue;
        throw new ConflictException('Это время сейчас оформляет другой клиент. Выберите другой слот.');
      }

      try {
        const booking = await this.prisma.booking.create({
          data: {
            user_id: user.id,
            master_id: masterId,
            starts_at: startsAt,
            ends_at: endsAt,
            status: 'pending',
            total_price: totalPrice,
            total_duration_min: totalDuration,
            client_comment: dto.comment?.trim() || null,
            ai_generation_id: dto.aiGenerationId ?? null,
            source: 'web',
            items: {
              create: masterServices.map((ms) => ({
                service_id: ms.service_id,
                price: ms.price_override ?? ms.service.base_price,
                duration_min: ms.duration_override ?? ms.service.duration_min,
              })),
            },
          },
          include: {
            items: { include: { service: true } },
            master: { select: { id: true, name: true, slug: true } },
          },
        });

        void this.telegram.notifyNewBooking({
          clientName: dto.name,
          clientPhone: phone.value,
          masterName: booking.master.name,
          dateTime: formatSalonDateTime(startsAt),
          services: booking.items.map((i) => i.service.name),
          price: totalPrice,
          comment: booking.client_comment,
          withAiLook: Boolean(dto.aiGenerationId),
          bookingId: booking.id,
        });
        return booking;
      } catch (e) {
        if (isOverlapError(e)) {
          if (dto.masterId === 'any') continue;
          throw new ConflictException('Это время уже занято другим клиентом. Попробуйте другой слот.');
        }
        throw e;
      } finally {
        await this.slots.unlockSlot(masterId, startsAt.toISOString());
      }
    }

    throw new ConflictException('На это время нет свободных мастеров. Выберите другой слот.');
  }

  async findForUser(userId: string, scope: 'upcoming' | 'past' | 'all' = 'all') {
    const now = new Date();
    return this.prisma.booking.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        ...(scope === 'upcoming'
          ? { starts_at: { gte: now }, status: { in: ['pending', 'confirmed'] } }
          : scope === 'past'
            ? { OR: [{ starts_at: { lt: now } }, { status: { notIn: ['pending', 'confirmed'] } }] }
            : {}),
      },
      orderBy: { starts_at: scope === 'upcoming' ? 'asc' : 'desc' },
      include: {
        items: { include: { service: { select: { id: true, name: true } } } },
        master: { select: { id: true, slug: true, name: true, photo_url: true } },
        review: { select: { id: true, rating: true } },
      },
    });
  }

  // ─── Деталь записи ────────────────────────────────────────────────

  async findOne(bookingId: string, userId: string) {
    if (!UUID.test(bookingId)) throw new NotFoundException('Запись не найдена');
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: { include: { service: true } },
        master: true,
        ai_generation: { include: { style: true } },
      },
    });
    if (!b || b.deleted_at) throw new NotFoundException('Запись не найдена');
    if (b.user_id !== userId) throw new ForbiddenException();
    return {
      ...b,
      ai_generation: b.ai_generation
        ? {
            id: b.ai_generation.id,
            style: b.ai_generation.style.name,
            result_url: this.storage.resolveUrl(b.ai_generation.result_key),
          }
        : null,
    };
  }

  // ─── .ics для добавления в календарь ─────────────────────────────

  async buildIcs(bookingId: string, userId: string): Promise<string> {
    const b = await this.findOne(bookingId, userId);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const services = b.items.map((i) => i.service.name).join(', ');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BARS Barber Club//RU',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${bookingId}@bars.kg`,
      `DTSTAMP:${fmt(new Date())}Z`,
      `DTSTART:${fmt(b.starts_at)}Z`,
      `DTEND:${fmt(b.ends_at)}Z`,
      `SUMMARY:BARS Barber Club — ${escapeIcs(b.master.name)}`,
      `DESCRIPTION:${escapeIcs(services)}`,
      `LOCATION:${escapeIcs(process.env.SALON_ADDRESS ?? 'г. Бишкек, ул. Московская, 123')}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Визит в барбершоп через 2 часа',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  // ─── Отмена ───────────────────────────────────────────────────────

  async cancel(bookingId: string, userId: string, dto: CancelBookingDto) {
    const b = await this.findOne(bookingId, userId);

    if (!['pending', 'confirmed'].includes(b.status)) {
      throw new BadRequestException('Отменить можно только активную запись');
    }

    const windowH = await this.settings.getNumber('cancel_window_hours', 3);
    const now = new Date();
    const diffH = (b.starts_at.getTime() - now.getTime()) / 36e5;
    if (diffH < windowH) {
      throw new BadRequestException(
        `Отмена онлайн возможна не позднее чем за ${windowH} ч до визита — позвоните нам`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'cancelled_by_client',
        cancelled_at: now,
        cancel_reason: dto.reason ?? null,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    void this.telegram.notifyBookingCancelled({
      clientName: user?.full_name ?? 'Клиент',
      masterName: b.master.name,
      dateTime: formatSalonDateTime(b.starts_at),
      reason: dto.reason || 'отменено клиентом',
    });
    return updated;
  }

  /** Обновляет имя/телефон клиента; номер, занятый другим аккаунтом, не перезаписывается. */
  private async updateContact(user: User, name: string, phone: string) {
    const data: Prisma.UserUpdateInput = {};
    if (name && name !== user.full_name) data.full_name = name;
    if (phone !== user.phone) {
      const owner = await this.prisma.user.findUnique({ where: { phone } });
      if (owner && owner.id !== user.id) {
        throw new BadRequestException(
          'Этот номер привязан к другому аккаунту. Войдите в него или укажите другой номер.',
        );
      }
      data.phone = phone;
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({ where: { id: user.id }, data: { ...data, updated_at: new Date() } });
    }
  }
}

function isOverlapError(e: unknown): boolean {
  const err = e as { code?: string; message?: string; meta?: { code?: string } };
  return (
    err.message?.includes('no_overlap') === true ||
    err.meta?.code === '23P01' ||
    err.message?.includes('23P01') === true
  );
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
