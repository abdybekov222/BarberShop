import { Injectable } from '@nestjs/common';
import {
  addDays,
  addMinutes,
  eachDayOfInterval,
  format,
  getDay,
  isAfter,
  isBefore,
  setHours,
  setMinutes,
  startOfDay,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SettingsService } from '../settings/settings.service';
import { SALON_TZ as TZ } from '../common/time';

export interface Slot {
  start: string; // ISO UTC
  end: string; // ISO UTC
  available: boolean;
  /** Для «Любой свободный»: мастера, у которых слот свободен. */
  masterIds?: string[];
}

export interface DaySlots {
  date: string; // YYYY-MM-DD (локальная дата салона)
  slots: Slot[];
}

/** Минимальный отступ от текущего момента до записи. */
const LEAD_MINUTES = 30;

/**
 * Генерирует сетку слотов для мастера на горизонт дней.
 *
 * Алгоритм:
 *  1. Для каждого дня в горизонте достаём рабочее расписание мастера (weekday).
 *  2. Генерируем слоты c шагом slot_step_min (salon_settings).
 *  3. Убираем слоты во время перерыва и отсутствий (time_off).
 *  4. Убираем слоты, перекрывающиеся с активными бронированиями (pending/confirmed).
 *  5. Помечаем слоты заблокированными soft-lock'ом в Redis.
 *  6. Слоты в прошлом (и ближе LEAD_MINUTES) — недоступны.
 */
@Injectable()
export class SlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
  ) {}

  async getSlots(masterId: string, durationMin: number, horizonDays?: number): Promise<DaySlots[]> {
    const horizon = horizonDays ?? (await this.settings.getNumber('booking_horizon_days', 21));
    const step = await this.settings.getNumber('slot_step_min', 30);
    return this.computeForMaster(masterId, durationMin, horizon, step);
  }

  /**
   * «Любой свободный»: объединяет сетки мастеров, выполняющих все выбранные услуги.
   * Слот доступен, если свободен хотя бы у одного из них.
   */
  async getSlotsAny(serviceIds: string[], durationMin: number, horizonDays?: number) {
    const horizon = horizonDays ?? (await this.settings.getNumber('booking_horizon_days', 21));
    const step = await this.settings.getNumber('slot_step_min', 30);
    const masterIds = await this.eligibleMasterIds(serviceIds);

    const perMaster = await Promise.all(
      masterIds.map((id) => this.computeForMaster(id, durationMin, horizon, step)),
    );
    const merged = new Map<string, Map<string, Slot>>();
    for (const [i, days] of perMaster.entries()) {
      const id = masterIds[i]!;
      for (const d of days) {
        const day = merged.get(d.date) ?? new Map<string, Slot>();
        for (const s of d.slots) {
          const cur = day.get(s.start) ?? { start: s.start, end: s.end, available: false, masterIds: [] };
          if (s.available) {
            cur.available = true;
            cur.masterIds!.push(id);
          }
          day.set(s.start, cur);
        }
        merged.set(d.date, day);
      }
    }
    return [...merged.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, slots]) => ({
        date,
        slots: [...slots.values()].sort((a, b) => a.start.localeCompare(b.start)),
      }));
  }

  private nearestCache: { at: number; data: { masterId: string; next: string | null; today: boolean }[] } | null =
    null;

  /**
   * Ближайшее свободное окно (30 мин) каждого активного мастера на 7 дней вперёд —
   * для карточек «Команда» и фильтра «Сегодня есть окна» (ТЗ §2.4). Кэш 60 с.
   */
  async nearest() {
    if (this.nearestCache && Date.now() - this.nearestCache.at < 60_000) return this.nearestCache.data;
    const step = await this.settings.getNumber('slot_step_min', 30);
    const masters = await this.prisma.master.findMany({ where: { is_active: true }, select: { id: true } });
    const today = format(toZonedTime(new Date(), TZ), 'yyyy-MM-dd');
    const data = await Promise.all(
      masters.map(async (m) => {
        const days = await this.computeForMaster(m.id, 30, 7, step);
        for (const d of days) {
          const s = d.slots.find((x) => x.available);
          if (s) return { masterId: m.id, next: s.start, today: d.date === today };
        }
        return { masterId: m.id, next: null, today: false };
      }),
    );
    this.nearestCache = { at: Date.now(), data };
    return data;
  }

  /** Активные мастера, выполняющие ВСЕ указанные услуги. */
  async eligibleMasterIds(serviceIds: string[]): Promise<string[]> {
    const masters = await this.prisma.master.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      include: { master_services: { select: { service_id: true } } },
    });
    return masters
      .filter((m) => {
        const has = new Set(m.master_services.map((ms) => ms.service_id));
        return serviceIds.every((id) => has.has(id));
      })
      .map((m) => m.id);
  }

  /** Свободен ли конкретный интервал у мастера (рабочее время, перерыв, брони, отсутствия). */
  async isFree(masterId: string, startsAt: Date, durationMin: number): Promise<boolean> {
    const step = await this.settings.getNumber('slot_step_min', 30);
    const horizon = await this.settings.getNumber('booking_horizon_days', 21);
    const days = await this.computeForMaster(masterId, durationMin, horizon, step);
    const iso = startsAt.toISOString();
    return days.some((d) => d.slots.some((s) => s.start === iso && s.available));
  }

  private async computeForMaster(
    masterId: string,
    durationMin: number,
    horizonDays: number,
    slotStep: number,
  ): Promise<DaySlots[]> {
    const nowUtc = new Date();
    const earliest = addMinutes(nowUtc, LEAD_MINUTES);
    const nowLocal = toZonedTime(nowUtc, TZ);

    const days = eachDayOfInterval({
      start: startOfDay(nowLocal),
      end: addDays(startOfDay(nowLocal), horizonDays - 1),
    });

    const workingHours = await this.prisma.workingHour.findMany({ where: { master_id: masterId } });
    const whByDay = new Map(workingHours.map((wh) => [wh.weekday, wh]));

    const horizonStart = fromZonedTime(startOfDay(nowLocal), TZ);
    const horizonEnd = fromZonedTime(startOfDay(addDays(nowLocal, horizonDays)), TZ);
    const [busy, timeOff] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          master_id: masterId,
          status: { in: ['pending', 'confirmed'] },
          starts_at: { lt: horizonEnd },
          ends_at: { gt: horizonStart },
          deleted_at: null,
        },
        select: { starts_at: true, ends_at: true },
      }),
      this.prisma.timeOff.findMany({
        where: { master_id: masterId, starts_at: { lt: horizonEnd }, ends_at: { gt: horizonStart } },
        select: { starts_at: true, ends_at: true },
      }),
    ]);
    const blocked = [...busy, ...timeOff];

    const at = (day: Date, hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return fromZonedTime(setMinutes(setHours(day, h!), m!), TZ);
    };

    const result: DaySlots[] = [];
    for (const day of days) {
      const wh = whByDay.get(getDay(day)); // 0=вс … 6=сб
      if (!wh) continue; // выходной

      const dayEnd = at(day, wh.end_time);
      const bs = wh.break_start && wh.break_end ? at(day, wh.break_start) : null;
      const be = wh.break_start && wh.break_end ? at(day, wh.break_end) : null;

      const slots: Slot[] = [];
      for (let cursor = at(day, wh.start_time); isBefore(cursor, dayEnd); cursor = addMinutes(cursor, slotStep)) {
        const slotEnd = addMinutes(cursor, durationMin);
        if (isAfter(slotEnd, dayEnd)) break;

        const inBreak = bs && be ? isBefore(cursor, be) && isAfter(slotEnd, bs) : false;
        const inPast = isBefore(cursor, earliest);
        const overlaps = blocked.some(
          (b) => isBefore(cursor, b.ends_at) && isAfter(slotEnd, b.starts_at),
        );
        let locked = false;
        if (!inBreak && !inPast && !overlaps && this.redis.available) {
          locked = (await this.redis.get(lockKey(masterId, cursor.toISOString()))) !== null;
        }

        slots.push({
          start: cursor.toISOString(),
          end: slotEnd.toISOString(),
          available: !inBreak && !inPast && !overlaps && !locked,
        });
      }

      if (slots.some((s) => s.available)) {
        result.push({ date: format(day, 'yyyy-MM-dd'), slots });
      }
    }
    return result;
  }

  /** Устанавливает soft-lock на слот (soft_lock_minutes, по умолчанию 5 мин). */
  async lockSlot(masterId: string, startIso: string): Promise<boolean> {
    const minutes = await this.settings.getNumber('soft_lock_minutes', 5);
    return this.redis.tryLock(lockKey(masterId, startIso), minutes * 60);
  }

  async unlockSlot(masterId: string, startIso: string): Promise<void> {
    await this.redis.unlock(lockKey(masterId, startIso));
  }
}

function lockKey(masterId: string, startIso: string) {
  return `slot:${masterId}:${startIso}`;
}
