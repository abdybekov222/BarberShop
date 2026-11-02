import { Body, Controller, Delete, Get, Patch, Req } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UsersService } from './users.service';
import { TelegramBotService } from '../notifications/telegram-bot.service';

class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) full_name?: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly bot: TelegramBotService,
  ) {}

  /** Ссылка на бота для привязки Telegram (напоминания, статусы заказов). */
  @Get('me/telegram')
  async telegram(@Req() req: any) {
    const fresh = await this.users.findForAuth(req.user.id as string);
    return {
      linked: Boolean(fresh?.telegram_chat_id),
      url: this.bot.linkUrl(req.user.id as string),
      bot: this.bot.botUsername,
    };
  }

  /** Текущий авторизованный пользователь (JwtAuthGuard уже положил в req.user). */
  @Get('me')
  async me(@Req() req: any) {
    // свежие данные: квота ИИ меняется после каждой генерации
    return toProfile((await this.users.findById(req.user.id as string)) ?? req.user);
  }

  @Patch('me')
  async update(@Body() dto: UpdateProfileDto, @Req() req: any) {
    return toProfile(await this.users.updateProfile(req.user.id as string, dto));
  }

  @Delete('me')
  remove(@Req() req: any) {
    return this.users.deleteAccount(req.user.id as string);
  }
}

function toProfile(user: any) {
  return {
    id: user.id as string,
    email: (user.email ?? null) as string | null,
    phone: (user.phone ?? null) as string | null,
    full_name: user.full_name as string,
    role: user.role as string,
    avatar_url: (user.avatar_url ?? null) as string | null,
    google_linked: Boolean(user.google_id),
    telegram_linked: Boolean(user.telegram_chat_id),
    consent_ai_at: user.consent_ai_at ?? null,
    consent_pd_at: user.consent_pd_at ?? null,
    ai_quota: user.ai_quota
      ? {
          free_limit: user.ai_quota.free_limit as number,
          used_count: user.ai_quota.used_count as number,
          bonus_count: user.ai_quota.bonus_count as number,
          remaining:
            (user.ai_quota.free_limit as number) +
            (user.ai_quota.bonus_count as number) -
            (user.ai_quota.used_count as number),
        }
      : null,
  };
}
