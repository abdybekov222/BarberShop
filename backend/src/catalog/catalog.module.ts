import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { MastersController } from './masters.controller';
import { GalleryController } from './gallery.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [ServicesController, MastersController, GalleryController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
