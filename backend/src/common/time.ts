import { addDays, startOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export const SALON_TZ = process.env.SALON_TZ ?? 'Asia/Bishkek';

/** Границы суток (UTC) для локальной даты салона. `date` — YYYY-MM-DD или «сегодня». */
export function salonDayRange(date?: string): { start: Date; end: Date } {
  const localDay = date
    ? startOfDay(new Date(`${date}T00:00:00`))
    : startOfDay(toZonedTime(new Date(), SALON_TZ));
  return {
    start: fromZonedTime(localDay, SALON_TZ),
    end: fromZonedTime(addDays(localDay, 1), SALON_TZ),
  };
}

/** Секунд до ближайшей полуночи по времени салона. */
export function secondsToSalonMidnight(): number {
  return Math.max(60, Math.ceil((salonDayRange().end.getTime() - Date.now()) / 1000));
}

/** Человекочитаемая дата-время в часовом поясе салона. */
export function formatSalonDateTime(d: Date): string {
  return d.toLocaleString('ru-RU', {
    timeZone: SALON_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** IP клиента с учётом прокси (Cloudflare / nginx). */
export function clientIp(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}): string | null {
  const cf = req.headers?.['cf-connecting-ip'];
  if (typeof cf === 'string') return cf;
  // Express resolves X-Forwarded-For using the configured trusted proxy hop.
  // Reading the raw header here would let a caller spoof the IP used by rate limits.
  return req.ip ?? null;
}
