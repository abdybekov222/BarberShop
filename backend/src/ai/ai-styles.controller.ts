import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

/**
 * GET /api/ai/styles — каталог причёсок (публичный).
 */
@Public()
@Controller('ai/styles')
export class AiStylesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('type') type?: string) {
    return this.prisma.hairStyle.findMany({
      where: {
        is_active: true,
        ...(type ? { type: type as never } : {}),
      },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        type: true,
        name: true,
        preview_url: true,
        sort_order: true,
      },
    });
  }
}
