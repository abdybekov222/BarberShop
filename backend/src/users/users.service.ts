import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import * as admin from 'firebase-admin';
import { validatePhone } from '@barbershop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';

const identityHash = (type: string, value: string) =>
  createHash('sha256').update(`${type}:${value}`).digest('hex');

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly adminEmails = new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Находит или создаёт пользователя по Firebase-токену.
   * При создании заводит квоту ИИ (ai_free_limit из настроек). Если Google-аккаунт
   * или email ранее удалялись (blocked_identities) — новая квота не выдаётся (ТЗ §3.5).
   */
  async findOrCreateByFirebase(decoded: admin.auth.DecodedIdToken, ip: string | null) {
    const existing = await this.prisma.user.findUnique({
      where: { firebase_uid: decoded.uid },
      include: { ai_quota: true },
    });
    const email = decoded.email?.toLowerCase() ?? null;
    if (existing) return this.syncAdminRole(existing);

    const googleIdentity = decoded.firebase?.identities?.['google.com'];
    const googleId = Array.isArray(googleIdentity) ? String(googleIdentity[0]) : null;

    // Уже есть аккаунт с этим email (регистрация по паролю) — привязываем к нему Google
    if (email) {
      const byEmail = await this.findActiveByEmail(email);
      if (byEmail) {
        const linked = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { firebase_uid: decoded.uid, google_id: googleId, avatar_url: byEmail.avatar_url ?? decoded.picture ?? null },
          include: { ai_quota: true },
        });
        return this.syncAdminRole(linked);
      }
    }

    const freeLimit = await this.freeLimitFor([
      googleId ? identityHash('google', googleId) : null,
      email ? identityHash('email', email) : null,
    ]);

    // Email может остаться у мягко удалённого аккаунта — освобождаем его
    if (email) {
      await this.prisma.user.updateMany({
        where: { email, deleted_at: { not: null } },
        data: { email: null },
      });
    }

    return this.prisma.user.upsert({
      where: { firebase_uid: decoded.uid },
      create: {
        firebase_uid: decoded.uid,
        email,
        full_name: decoded.name ?? email?.split('@')[0] ?? 'Клиент',
        avatar_url: decoded.picture ?? null,
        google_id: googleId,
        role: email && this.adminEmails.has(email) ? 'owner' : 'client',
        signup_ip: ip,
        consent_pd_at: new Date(),
        ai_quota: { create: { free_limit: freeLimit, used_count: 0, bonus_count: 0 } },
      },
      update: {},
      include: { ai_quota: true },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, include: { ai_quota: true } });
  }

  /** Короткий кэш пользователя для guard: база далеко, а запросов на страницу несколько. */
  private readonly authCache = new Map<string, { at: number; user: Awaited<ReturnType<UsersService['findAuthUser']>> }>();
  private static readonly AUTH_TTL_MS = 15_000;

  private findAuthUser(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findForAuth(id: string) {
    const hit = this.authCache.get(id);
    if (hit && Date.now() - hit.at < UsersService.AUTH_TTL_MS) return hit.user;
    const user = await this.findAuthUser(id);
    this.authCache.set(id, { at: Date.now(), user });
    if (this.authCache.size > 5000) this.authCache.clear();
    return user;
  }

  invalidate(id: string) {
    this.authCache.delete(id);
  }

  findActiveByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email, deleted_at: null }, include: { ai_quota: true } });
  }

  findActiveByPhone(phone: string) {
    return this.prisma.user.findFirst({ where: { phone, deleted_at: null } });
  }

  /** Регистрация по email и паролю. Квота ИИ создаётся сразу. */
  async createLocal(data: { email: string; name: string; phone: string | null; passwordHash: string; ip: string | null }) {
    await this.prisma.user.updateMany({ where: { email: data.email, deleted_at: { not: null } }, data: { email: null } });
    const freeLimit = await this.freeLimitFor([
      identityHash('email', data.email),
      data.phone ? identityHash('phone', data.phone) : null,
    ]);
    return this.prisma.user.create({
      data: {
        email: data.email,
        full_name: data.name,
        phone: data.phone,
        password_hash: data.passwordHash,
        role: this.adminEmails.has(data.email) ? 'owner' : 'client',
        signup_ip: data.ip,
        consent_pd_at: new Date(),
        ai_quota: { create: { free_limit: freeLimit, used_count: 0, bonus_count: 0 } },
      },
      include: { ai_quota: true },
    });
  }

  /** Email из ADMIN_EMAILS получает роль owner при следующем запросе. */
  async syncAdminRole<T extends { id: string; email: string | null; role: string }>(user: T): Promise<T> {
    if (user.email && this.adminEmails.has(user.email.toLowerCase()) && (user.role === 'client' || user.role === 'master')) {
      await this.prisma.user.update({ where: { id: user.id }, data: { role: 'owner' } });
      this.invalidate(user.id);
      return { ...user, role: 'owner' };
    }
    return user;
  }

  /** Повторная регистрация удалённого аккаунта не даёт новых бесплатных ИИ-попыток (blocked_identities). */
  private async freeLimitFor(hashes: (string | null)[]): Promise<number> {
    const list = hashes.filter((h): h is string => Boolean(h));
    const blocked = list.length ? await this.prisma.blockedIdentity.findFirst({ where: { identity_hash: { in: list } } }) : null;
    return blocked ? 0 : this.settings.getNumber('ai_free_limit', 3);
  }

  async updateProfile(userId: string, data: { full_name?: string; phone?: string | null }) {
    this.invalidate(userId);
    const update: { full_name?: string; phone?: string | null; updated_at: Date } = {
      updated_at: new Date(),
    };
    if (data.full_name !== undefined) update.full_name = data.full_name.trim();
    if (data.phone !== undefined) {
      if (data.phone === null || data.phone === '') update.phone = null;
      else {
        const p = validatePhone(data.phone);
        if (!p.ok) throw new BadRequestException(p.error);
        const owner = await this.prisma.user.findUnique({ where: { phone: p.value } });
        if (owner && owner.id !== userId) {
          throw new BadRequestException('Этот номер привязан к другому аккаунту');
        }
        update.phone = p.value;
      }
    }
    return this.prisma.user.update({ where: { id: userId }, data: update, include: { ai_quota: true } });
  }

  /**
   * «Удалить аккаунт и данные» (ТЗ §2.4, §3.5): удаляем фото и результаты ИИ,
   * отменяем будущие записи, обезличиваем профиль (мягкое удаление) и сохраняем
   * хэши идентификаторов в blocked_identities, чтобы повторная регистрация
   * не давала новых бесплатных попыток.
   */
  async deleteAccount(userId: string) {
    this.invalidate(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { ai_photos: true, ai_generations: true },
    });
    if (!user) return { ok: true };

    for (const p of user.ai_photos) if (p.storage_key) await this.storage.remove(p.storage_key);
    for (const g of user.ai_generations) {
      if (g.result_key && !g.cache_hit && !/^https?:/.test(g.result_key)) {
        await this.storage.remove(g.result_key);
      }
    }

    const identities = [
      user.google_id ? { type: 'google' as const, hash: identityHash('google', user.google_id) } : null,
      user.email ? { type: 'google' as const, hash: identityHash('email', user.email) } : null,
      user.phone ? { type: 'phone' as const, hash: identityHash('phone', user.phone) } : null,
    ].filter((x): x is { type: 'google' | 'phone'; hash: string } => Boolean(x));

    const now = new Date();
    await this.prisma.$transaction([
      ...identities.map((i) =>
        this.prisma.blockedIdentity.upsert({
          where: { identity_hash: i.hash },
          create: { identity_hash: i.hash, type: i.type, reason: 'account_deleted' },
          update: {},
        }),
      ),
      this.prisma.booking.updateMany({
        where: { user_id: userId, status: { in: ['pending', 'confirmed'] }, starts_at: { gt: now } },
        data: { status: 'cancelled_by_client', cancelled_at: now, cancel_reason: 'Аккаунт удалён' },
      }),
      this.prisma.aiGeneration.updateMany({ where: { user_id: userId }, data: { result_key: null } }),
      this.prisma.aiPhoto.updateMany({
        where: { user_id: userId },
        data: { storage_key: '', deleted_at: now },
      }),
      this.prisma.consent.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: now } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          firebase_uid: null,
          password_hash: null,
          email: null,
          phone: null,
          google_id: null,
          full_name: 'Удалённый пользователь',
          avatar_url: null,
          consent_ai_at: null,
          deleted_at: now,
        },
      }),
    ]);

    if (user.firebase_uid) {
      try {
        await admin.auth().deleteUser(user.firebase_uid);
      } catch (e) {
        // без service account удалить Firebase-аккаунт нельзя — это не мешает удалению на сайте
        this.logger.warn(`Firebase deleteUser: ${(e as Error).message}`);
      }
    }
    return { ok: true };
  }
}
