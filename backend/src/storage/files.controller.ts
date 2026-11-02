import { Controller, ForbiddenException, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { StorageService } from './storage.service';

/** GET /api/files?key=&exp=&sig= — отдача приватных файлов по подписанной ссылке. */
@Public()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  /** GET /api/files/public/products/<file> — фото товаров (публичные, кэшируются). */
  @Get('public/products/:file')
  async publicFile(@Param('file') file: string, @Res() res: Response) {
    if (!/^[\w-]+\.(webp|jpg|png)$/.test(file)) throw new NotFoundException();
    try {
      const data = await this.storage.read(`products/${file}`);
      res.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : file.endsWith('.png') ? 'image/png' : 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(data);
    } catch {
      throw new NotFoundException();
    }
  }

  @Get()
  async get(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    if (!key || !sig || !this.storage.verify(key, Number(exp), sig)) {
      throw new ForbiddenException('Ссылка недействительна или истекла');
    }
    try {
      const data = await this.storage.read(key);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=600');
      res.send(data);
    } catch {
      throw new NotFoundException('Файл удалён');
    }
  }
}
