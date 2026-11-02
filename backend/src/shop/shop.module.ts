import { Module } from '@nestjs/common';
import { AdminProductsController, ProductsController } from './products.controller';
import { AdminOrdersController, OrdersController } from './orders.controller';
import { ProductsService } from './products.service';
import { OrdersService } from './orders.service';

/** Магазин барбер-косметики: каталог, отзывы, заказы, админ-CRUD. */
@Module({
  controllers: [ProductsController, AdminProductsController, OrdersController, AdminOrdersController],
  providers: [ProductsService, OrdersService],
})
export class ShopModule {}
