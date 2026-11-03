import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { createHmac, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'path';

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
  private readonly useCloudinary = process.env.STORAGE_PROVIDER?.trim().toLowerCase() === 'cloudinary';

  constructor() {
    if (!this.useCloudinary) return;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('CLOUDINARY_STORAGE_NOT_CONFIGURED');
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    this.logger.log('Cloudinary authenticated storage enabled');
  }

  private pathFor(key: string): string {
    const p = resolve(this.root, key);
    const rel = relative(this.root, p);
    if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new Error('INVALID_STORAGE_KEY');
    }
    return p;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const p = this.pathFor(key);
    if (this.useCloudinary) {
      await this.uploadToCloudinary(key, data);
      return;
    }
    await fs.mkdir(dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }

  async read(key: string): Promise<Buffer> {
    this.pathFor(key);
    if (this.useCloudinary) {
      const cloudData = await this.readFromCloudinary(key);
      if (cloudData) return cloudData;
      // Keep local files readable while existing uploads are migrated to Cloudinary.
    }
    return fs.readFile(this.pathFor(key));
  }

  async remove(key: string): Promise<void> {
    if (this.useCloudinary) await this.removeFromCloudinary(key);
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

  private cloudinaryId(key: string): string {
    const normalizedPath = relative(this.root, this.pathFor(key)).split(sep).join('/');
    return normalizedPath.slice(0, -extname(normalizedPath).length);
  }

  private cloudinaryFormat(key: string): string {
    const format = extname(key).slice(1).toLowerCase();
    if (!format || !/^[a-z0-9]+$/.test(format)) throw new Error('INVALID_STORAGE_FORMAT');
    return format === 'jpeg' ? 'jpg' : format;
  }

  private uploadToCloudinary(key: string, data: Buffer): Promise<void> {
    return new Promise((resolveUpload, rejectUpload) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: this.cloudinaryId(key),
          resource_type: 'image',
          type: 'authenticated',
          overwrite: true,
          invalidate: true,
        },
        (error, result) => {
          if (error || !result?.public_id) {
            this.logger.warn(`Cloudinary upload failed${error instanceof Error ? ` (${error.name})` : ''}`);
            rejectUpload(new Error('CLOUDINARY_UPLOAD_FAILED'));
            return;
          }
          resolveUpload();
        },
      );
      stream.end(data);
    });
  }

  private async readFromCloudinary(key: string): Promise<Buffer | null> {
    const url = cloudinary.utils.private_download_url(this.cloudinaryId(key), this.cloudinaryFormat(key), {
      resource_type: 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 60,
    });

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      this.logger.warn(`Cloudinary read failed${error instanceof Error ? ` (${error.name})` : ''}`);
      throw new Error('CLOUDINARY_READ_FAILED');
    }

    if (response.status === 404) return null;
    if (!response.ok) {
      this.logger.warn(`Cloudinary read failed (HTTP ${response.status})`);
      throw new Error('CLOUDINARY_READ_FAILED');
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async removeFromCloudinary(key: string): Promise<void> {
    try {
      const result = await cloudinary.uploader.destroy(this.cloudinaryId(key), {
        resource_type: 'image',
        type: 'authenticated',
        invalidate: true,
      });
      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error('CLOUDINARY_DELETE_FAILED');
      }
    } catch (error) {
      this.logger.warn(`Cloudinary delete failed${error instanceof Error ? ` (${error.name})` : ''}`);
      throw new Error('CLOUDINARY_DELETE_FAILED');
    }
  }
}
