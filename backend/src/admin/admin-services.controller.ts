import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsUuidLike } from '../common/uuid';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';

class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) base_price?: number;
  @IsOptional() @IsBoolean() price_is_from?: boolean;
  @IsOptional() @IsInt() @Min(5) @Max(480) duration_min?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsInt() sort_order?: number;
}

class CreateServiceDto {
  @IsUuidLike() category_id!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsInt() @Min(0) @Max(1_000_000) base_price!: number;
  @IsInt() @Min(5) @Max(480) duration_min!: number;
  @IsOptional() @IsBoolean() price_is_from?: boolean;
  @IsOptional() @IsBoolean() is_combo?: boolean;
}

/** Управление каталогом услуг и ценами в сомах (базовая админка, ТЗ §4 этап 4). */
@Controller('admin/services')
@UseGuards(RolesGuard)
@Roles('admin', 'owner')
export class AdminServicesController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list() {
    return this.admin.getServices();
  }

  @Get('categories')
  categories() {
    return this.admin.getCategories();
  }

  @Post()
  create(@Body() dto: CreateServiceDto) {
    return this.admin.createService(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.admin.updateService(id, dto);
  }
}
