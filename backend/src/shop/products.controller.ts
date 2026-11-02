import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { ProductCategory } from '@prisma/client';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { StorageService } from '../storage/storage.service';
import { PRODUCT_CATEGORIES, PRODUCT_SORTS, ProductsService, type ProductSort } from './products.service';

class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(1000) text?: string;
}

class ProductDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) slug?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(80) brand?: string;
  @IsOptional() @IsIn(PRODUCT_CATEGORIES) category?: ProductCategory;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) usage?: string;
  @IsOptional() @IsString() @MaxLength(40) volume?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) price?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) old_price?: number | null;
  @IsOptional() @IsString() image_url?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) stock?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsBoolean() is_featured?: boolean;
  @IsOptional() @IsInt() sort_order?: number;
}

function parseQuery(q: Record<string, string | undefined>) {
  const num = (v?: string) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
  return {
    q: q.q,
    category: PRODUCT_CATEGORIES.includes(q.category as ProductCategory) ? (q.category as ProductCategory) : undefined,
    minPrice: num(q.minPrice),
    maxPrice: num(q.maxPrice),
    inStock: q.inStock === '1' || q.inStock === 'true',
    sort: PRODUCT_SORTS.includes(q.sort as ProductSort) ? (q.sort as ProductSort) : undefined,
    page: num(q.page),
    limit: num(q.limit),
    ids: q.ids ? q.ids.split(',').filter(Boolean).slice(0, 48) : undefined,
  };
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => {
      const m: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
      return m[c] ?? '';
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

/** Публичный каталог магазина. */
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  list(@Query() q: Record<string, string | undefined>) {
    return this.products.list(parseQuery(q));
  }

  @Public()
  @Get(':slug')
  one(@Param('slug') slug: string) {
    return this.products.bySlug(slug);
  }

  @Post(':id/reviews')
  review(@Param('id') id: string, @Body() dto: ReviewDto, @Req() req: any) {
    return this.products.addReview(id, req.user.id as string, dto.rating, dto.text);
  }
}

/** CRUD товаров для администратора + загрузка фото. */
@Controller('admin/products')
@UseGuards(RolesGuard)
@Roles('admin', 'owner')
export class AdminProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(@Query() q: Record<string, string | undefined>) {
    return this.products.list({ ...parseQuery(q), limit: 100 }, true);
  }

  @Post()
  create(@Body() dto: ProductDto) {
    if (!dto.name || !dto.category || dto.price === undefined || !dto.image_url) {
      throw new BadRequestException('Нужны название, категория, цена и фото');
    }
    return this.products.create({
      slug: dto.slug || `${slugify(dto.name)}-${randomUUID().slice(0, 4)}`,
      name: dto.name,
      brand: dto.brand ?? 'BARS',
      category: dto.category,
      description: dto.description ?? '',
      usage: dto.usage ?? null,
      volume: dto.volume ?? null,
      price: dto.price,
      old_price: dto.old_price ?? null,
      image_url: dto.image_url,
      stock: dto.stock ?? 0,
      is_active: dto.is_active ?? true,
      is_featured: dto.is_featured ?? false,
      sort_order: dto.sort_order ?? 0,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: ProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  /** Фото товара: сжатие до 1200 px (WebP) и публичная ссылка. */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
        cb(ok ? null : new BadRequestException('Только JPEG/PNG/WebP'), ok);
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не прикреплён');
    const key = `products/${randomUUID()}.webp`;
    const data = await sharp(file.buffer)
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    await this.storage.put(key, data);
    return { url: this.storage.publicUrl(key) };
  }
}
