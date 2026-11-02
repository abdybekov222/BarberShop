import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join, normalize, resolve } from 'path';

/**
 * Приватное хранилище фото клиентов и результатов ИИ (ТЗ §1.4, §1.5 п.7).
 *
 * MVP-реализация — локальная папка STORAGE_DIR, доступ только по подписанным
 * ссылкам с TTL (HMAC-SHA256). Интерфейс (put/read/remove/signedUrl) совпадает
 * с тем, что понадобится для S3/R2 — замена без изменений в вызывающем коде.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root = resolve(process.env.STORAGE_DIR ?? join(process.cwd(), 'storage'));
  private readonly secret =
    process.env.STORAGE_SIGNING_SECRET ?? process.env.FIREBASE_PROJECT_ID ?? 'dev-secret';
  private readonly publicBase = (process.env.API_PUBLIC_URL ?? 'http://localhost:3001').replace(
    /\/$/,
    '',
  );

  private pathFor(key: string): string {
    const p = normalize(join(this.root, key));
    if (!p.startsWith(this.root)) throw new Error('INVALID_STORAGE_KEY');
    return p;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const p = this.pathFor(key);
    await fs.mkdir(dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.pathFor(key));
  }

  async remove(key: string): Promise<void> {
    try {
      await fs.unlink(this.pathFor(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Не удалось удалить ${key}: ${(e as Error).message}`);
      }
    }
  }

  /** Подписанная ссылка (по умолчанию TTL 10 минут, ТЗ §1.5 п.7). */
  signedUrl(key: string, ttlSeconds = 600): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.sign(key, exp);
    return `${this.publicBase}/api/files?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
  }

  /** Публичная ссылка — только для неприватных файлов (фото товаров, prefix `products/`). */
  publicUrl(key: string): string {
    return `${this.publicBase}/api/files/public/${key}`;
  }

  /** Ссылка для отдачи клиенту: внешний URL провайдера — как есть, ключ хранилища — подписанный. */
  resolveUrl(keyOrUrl: string | null): string | null {
    if (!keyOrUrl) return null;
    return /^https?:\/\//.test(keyOrUrl) ? keyOrUrl : this.signedUrl(keyOrUrl);
  }

  verify(key: string, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(key, exp));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private sign(key: string, exp: number): string {
    return createHmac('sha256', this.secret).update(`${key}:${exp}`).digest('hex');
  }
}
