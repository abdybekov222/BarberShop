import { Body, Controller, Delete, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { IsUuidLike } from '../common/uuid';
import { AiGenerationService } from './ai-generation.service';
import { clientIp } from '../common/time';
import { TurnstileService } from '../security/turnstile.service';

export class StartGenerationDto {
  @IsUuidLike() photoId!: string;
  @IsUuidLike() styleId!: string;
}

/**
 * POST /api/ai/generations — запуск генерации (списывает квоту).
 * GET  /api/ai/generations  — список генераций пользователя.
 * GET  /api/ai/generations/:id — статус (polling каждые 2 с).
 */
@Controller('ai/generations')
export class AiGenerationsController {
  constructor(
    private readonly generations: AiGenerationService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Post()
  async start(
    @Body() dto: StartGenerationDto,
    @Req() req: any,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('cf-turnstile-response') captcha?: string,
  ) {
    await this.turnstile.assert(captcha, clientIp(req), req.user.id as string);
    return this.generations.start({
      userId: req.user.id as string,
      photoId: dto.photoId,
      styleId: dto.styleId,
      idempotencyKey,
      ip: clientIp(req),
    });
  }

  @Get()
  list(@Req() req: any) {
    return this.generations.listForUser(req.user.id as string);
  }

  @Get(':id')
  status(@Param('id') id: string, @Req() req: any) {
    return this.generations.getStatus(id, req.user.id as string);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.generations.removeResult(req.user.id as string, id);
  }
}
