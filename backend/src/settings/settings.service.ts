import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Значения по умолчанию для ключей salon_settings (barbershop_db_schema.md §4). */
const DEFAULTS: Record<string, string> = {
  timezone: 'Asia/Bishkek',
  slot_step_min: '30',
  cancel_window_hours: '3',
  booking_horizon_days: '21',
  soft_lock_minutes: '5',
  ai_free_limit: '3',
  ai_ip_new_accounts_per_day: '3',
  ai_ip_generations_per_day: '9',
  ai_uploads_per_day: '5',
  ai_photo_ttl_days: '7',
  ai_result_ttl_days: '14',
};

/**
 * Чтение salon_settings с коротким кэшем в памяти (30 с),
 * чтобы не ходить в БД на каждый запрос слотов/генераций.
 */
@Injectable()
export class SettingsService {
  private cache: { at: number; map: Record<string, string> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async all(): Promise<Record<string, string>> {
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache.map;
    const rows = await this.prisma.salonSetting.findMany();
    const map = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
    this.cache = { at: Date.now(), map };
    return map;
  }

  async get(key: string): Promise<string | undefined> {
    return (await this.all())[key];
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const n = Number(await this.get(key));
    return Number.isFinite(n) ? n : fallback;
  }

  invalidate(): void {
    this.cache = null;
  }
}
