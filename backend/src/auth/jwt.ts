import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Секрет подписи JWT. В проде обязателен JWT_SECRET (длинная случайная строка). */
const SECRET = process.env.JWT_SECRET ?? process.env.STORAGE_SIGNING_SECRET ?? 'dev-only-jwt-secret';
const TTL_SECONDS = Number(process.env.JWT_TTL_SECONDS ?? 60 * 60 * 24 * 7); // 7 дней

export interface JwtPayload {
  sub: string; // users.id
  role: string;
  iat: number;
  exp: number;
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

/** Подписывает access-токен (JWT, HS256). */
export function signJwt(userId: string, role: string): { token: string; expiresAt: number } {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TTL_SECONDS;
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ sub: userId, role, iat, exp } satisfies JwtPayload));
  const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return { token: `${header}.${body}.${sig}`, expiresAt: exp * 1000 };
}

/** Проверяет подпись и срок действия. Возвращает payload или null. */
export function verifyJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts as [string, string, string];
  const expected = createHmac('sha256', SECRET).update(`${header}.${body}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const head = JSON.parse(Buffer.from(header, 'base64url').toString()) as { alg?: string };
    if (head.alg !== 'HS256') return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as JwtPayload;
    if (!payload.sub || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Хеш пароля: scrypt с солью, формат `scrypt$<salt>$<hash>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}
