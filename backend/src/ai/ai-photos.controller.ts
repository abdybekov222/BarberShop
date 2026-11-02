import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Headers,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Equals, IsBoolean } from 'class-validator';
import { AiPhotosService } from './ai-photos.service';
import { clientIp } from '../common/time';
import { TurnstileService } from '../security/turnstile.service';

class ConsentDto {
  @IsBoolean() @Equals(true) consent!: boolean;
  @IsBoolean() @Equals(true) adult!: boolean;
}

/**
 * POST   /api/ai/consent — согласие на обработку фото + подтверждение 18+.
 * POST   /api/ai/photos  — загрузка фото клиента (НЕ списывает квоту, ТЗ §3.5 шаг 1).
 * DELETE /api/ai/photos/:id — досрочное удаление фото и результатов.
 */
@Controller('ai')
export class AiPhotosController {
  constructor(
    private readonly photos: AiPhotosService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Post('consent')
  consent(@Body() _dto: ConsentDto, @Req() req: any) {
    return this.photos.giveConsent(
      req.user.id as string,
      clientIp(req),
      (req.headers['user-agent'] as string | undefined) ?? null,
    );
  }

  @Post('photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
        cb(ok ? null : new BadRequestException('Только JPEG/PNG/WebP'), ok);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Headers('cf-turnstile-response') captcha?: string,
  ) {
    if (!file) throw new BadRequestException('Файл не прикреплён');
    await this.turnstile.assert(captcha, clientIp(req), req.user.id as string);
    return this.photos.upload(req.user.id as string, file);
  }

  @Delete('photos/:id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.photos.remove(req.user.id as string, id);
  }
}
