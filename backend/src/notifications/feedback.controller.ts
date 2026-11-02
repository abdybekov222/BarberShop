import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Public } from '../auth/public.decorator';
import { TurnstileService } from '../security/turnstile.service';
import { TelegramService } from './telegram.service';
import { clientIp } from '../common/time';

class FeedbackDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsString() @MinLength(5) @MaxLength(2000) message!: string;
}

/** POST /api/feedback — форма обратной связи на странице «Контакты» → Telegram владельцу. */
@Public()
@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Post()
  async send(
    @Body() dto: FeedbackDto,
    @Req() req: any,
    @Headers('cf-turnstile-response') captcha?: string,
  ) {
    await this.turnstile.assert(captcha, clientIp(req));
    await this.telegram.notifyFeedback(dto.name, dto.phone ?? null, dto.message);
    return { ok: true };
  }
}
