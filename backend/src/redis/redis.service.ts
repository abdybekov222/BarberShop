import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Singleton ioredis клиент.
 * Используется для soft-lock слотов, rate-limit и счётчиков ИИ.
 * Если REDIS_URL не задан — работаем в fallback-режиме без Redis
 * (soft-lock просто пропускается, что допустимо для dev).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('REDIS_URL не задан — Redis отключён (dev-режим)');
      return;
    }
    this.client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
    });
    this.client.on('error', (e) => this.logger.error('Redis error:', e.message));
  }

  get available(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }

  /**
   * SET key value EX seconds NX — вернёт true, если блокировка получена.
   * Без Redis (dev) блокировка считается полученной: от двойной брони
   * всё равно защищает exclusion constraint в БД.
   */
  async tryLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) return true;
    const result = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async unlock(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.client) return 0;
    const val = await this.client.incr(key);
    if (val === 1 && ttlSeconds) {
      await this.client.expire(key, ttlSeconds);
    }
    return val;
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }
}
