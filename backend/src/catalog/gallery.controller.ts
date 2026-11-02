import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('gallery')
export class GalleryController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  getGallery(
    @Query('tag') tag?: string,
    @Query('master') master?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.catalog.getGallery({
      styleTag: tag,
      masterSlug: master,
      skip: skip ? Number(skip) : 0,
      take: take ? Math.min(Number(take), 48) : 16,
    });
  }
}
