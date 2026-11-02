import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { validatePhone } from '@barbershop/shared';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { hashPassword, signJwt, verifyPassword } from './jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly firebase: FirebaseService,
  ) {}

  async register(dto: { name: string; email: string; password: string; phone?: string }, ip: string | null) {
    let phone: string | null = null;
    if (dto.phone?.trim()) {
      const p = validatePhone(dto.phone);
      if (!p.ok) throw new BadRequestException(p.error);
      phone = p.value;
    }
    const email = dto.email.trim().toLowerCase();
    if (await this.users.findActiveByEmail(email)) {
      throw new ConflictException('Аккаунт с таким email уже есть — войдите');
    }
    if (phone && (await this.users.findActiveByPhone(phone))) {
      throw new ConflictException('Этот номер уже привязан к другому аккаунту');
    }
    const user = await this.users.createLocal({
      email,
      name: dto.name.trim(),
      phone,
      passwordHash: await hashPassword(dto.password),
      ip,
    });
    return this.session(user);
  }

  async login(emailRaw: string, password: string) {
    const user = await this.users.findActiveByEmail(emailRaw.trim().toLowerCase());
    if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    if (user.is_blocked) throw new ForbiddenException('Аккаунт заблокирован');
    return this.session(user);
  }

  /** Google через Firebase: проверяем ID-токен Google и выдаём JWT сайта. */
  async google(idToken: string, ip: string | null) {
    let decoded;
    try {
      decoded = await this.firebase.verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException('Не удалось подтвердить вход через Google');
    }
    if (decoded.email && decoded.email_verified === false) {
      throw new ForbiddenException('Email Google-аккаунта не подтверждён');
    }
    const user = await this.users.findOrCreateByFirebase(decoded, ip);
    if (user.is_blocked || user.deleted_at) throw new ForbiddenException('Аккаунт заблокирован или удалён');
    return this.session(user);
  }

  private session(user: User) {
    const { token, expiresAt } = signJwt(user.id, user.role);
    return {
      token,
      expiresAt,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    };
  }
}
