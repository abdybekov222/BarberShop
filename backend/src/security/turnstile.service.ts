import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Cloudflare Turnstile (ТЗ §1.3, §3.5): проверка одноразового токена на сервере
 * перед загрузкой фото, запуском ИИ-генерации и отправкой формы.
 * Пока TURNSTILE_SECRET_KEY не задан — проверка пропускается (dev).
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secret = process.env.TURNSTILE_SECRET_KEY ?? '';

  constructor(private readonly prisma: PrismaService) {
    if (!this.secret) this.logger.warn('TURNSTILE_SECRET_KEY не задан — проверка капчи отключена');
  }

  get enabled(): boolean {
    return Boolean(this.secret);
  }

  async assert(token: string | undefined, ip: string | null, userId?: string): Promise<void> {
    if (!this.secret) return;
    let success = false;
    if (token) {
      try {
        const body = new URLSearchParams({ secret: this.secret, response: token });
        if (ip) body.set('remoteip', ip);
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body,
        });
        success = Boolean(((await res.json()) as { success?: boolean }).success);
      } catch (e) {
        this.logger.error(`Turnstile siteverify: ${(e as Error).message}`);
      }
    }
    if (!success) {
      await this.prisma.aiAbuseLog.create({
        data: { user_id: userId ?? null, ip, rule: 'turnstile_failed' },
      });
      throw new ForbiddenException('CAPTCHA_FAILED');
    }
  }
}
