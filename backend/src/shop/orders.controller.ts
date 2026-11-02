import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { IsUuidLike } from '../common/uuid';
import type { DeliveryMethod, OrderStatus, PaymentMethod } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ORDER_STATUSES, OrdersService } from './orders.service';

class OrderItemDto {
  @IsUuidLike() productId!: string;
  @IsInt() @Min(1) @Max(20) qty!: number;
}

class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() phone!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsIn(['pickup', 'courier']) delivery!: DeliveryMethod;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
  @IsIn(['cash', 'card_demo']) payment!: PaymentMethod;
}

class StatusDto {
  @IsIn(ORDER_STATUSES) status!: OrderStatus;
}

/** Заказы клиента (требуется вход — JWT Firebase). */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @Req() req: any) {
    return this.orders.create(req.user, dto);
  }

  @Get('my')
  my(@Req() req: any) {
    return this.orders.forUser(req.user.id as string);
  }

  @Get(':id')
  one(@Param('id') id: string, @Req() req: any) {
    return this.orders.one(id, req.user.id as string);
  }

  @Post(':id/pay-demo')
  pay(@Param('id') id: string, @Req() req: any) {
    return this.orders.payDemo(id, req.user.id as string);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.orders.cancel(id, req.user.id as string);
  }
}

@Controller('admin/orders')
@UseGuards(RolesGuard)
@Roles('admin', 'owner')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query('status') status?: string, @Query('page') page?: string, @Query('q') q?: string) {
    return this.orders.list({
      status: ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined,
      page: Number(page) || 1,
      q: q?.trim() || undefined,
    });
  }

  @Patch(':id/status')
  status(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.orders.setStatus(id, dto.status);
  }
}
