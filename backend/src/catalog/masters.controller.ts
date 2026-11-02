import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('masters')
export class MastersController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  getMasters() {
    return this.catalog.getMasters();
  }

  @Get(':slug')
  async getMaster(@Param('slug') slug: string) {
    const master = await this.catalog.getMasterBySlug(slug);
    if (!master) throw new NotFoundException(`Мастер «${slug}» не найден`);
    return master;
  }
}
