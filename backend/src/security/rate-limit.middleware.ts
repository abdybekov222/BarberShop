import type { NextFunction, Request, Response } from 'express';
import { clientIp } from '../common/time';

interface Rule {
  /** Метод + префикс пути; первое совпадение выигрывает. */
  match: (method: string, path: string) => boolean;
  bucket: string;
  limit: number;
  windowMs: number;
}

/** Лимиты запросов с одного IP (ТЗ §1.3 «антибот и rate limiting»). */
const RULES: Rule[] = [
  { bucket: 'feedback', match: (m, p) => m === 'POST' && p.startsWith('/api/feedback'), limit: 3, windowMs: 10 * 60_000 },
  { bucket: 'booking', match: (m, p) => m === 'POST' && p.startsWith('/api/bookings'), limit: 10, windowMs: 60_000 },
  { bucket: 'ai-write', match: (m, p) => m !== 'GET' && p.startsWith('/api/ai/'), limit: 15, windowMs: 60_000 },
  { bucket: 'auth', match: (m, p) => m === 'POST' && p.startsWith('/api/auth/'), limit: 10, windowMs: 60_000 },
  { bucket: 'api', match: (_m, p) => p.startsWith('/api/'), limit: 1000, windowMs: 60_000 },
];

const hits = new Map<string, { count: number; reset: number }>();

/**
 * Простой fixed-window лимитер в памяти процесса. Для одного инстанса API этого
 * достаточно; при горизонтальном масштабировании — перенести счётчики в Redis.
 */
export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const rule = RULES.find((r) => r.match(req.method, req.path));
  if (!rule) return next();

  const now = Date.now();
  const key = `${rule.bucket}:${clientIp(req) ?? 'unknown'}`;
  let entry = hits.get(key);
  if (!entry || entry.reset <= now) {
    entry = { count: 0, reset: now + rule.windowMs };
    hits.set(key, entry);
  }
  entry.count += 1;

  if (hits.size > 50_000) {
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }

  if (entry.count > rule.limit) {
    res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000));
    res.status(429).json({ statusCode: 429, message: 'Слишком много запросов. Попробуйте чуть позже.' });
    return;
  }
  next();
}

/** Базовые заголовки безопасности для ответов API (ТЗ §2.5). */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}
