import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('services')
export class ServicesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  getServices(@Query('category') category?: string) {
    return this.catalog.getServices(category);
  }

  @Get('categories')
  getCategories() {
    return this.catalog.getCategories();
  }
}
