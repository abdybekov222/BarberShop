import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PublicCacheInterceptor } from './common/public-cache.interceptor';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { FirebaseModule } from './firebase/firebase.module';
import { RedisModule } from './redis/redis.module';
import { SettingsModule } from './settings/settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { SecurityModule } from './security/security.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ShopModule } from './shop/shop.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CatalogModule } from './catalog/catalog.module';
import { SlotsModule } from './slots/slots.module';
import { BookingModule } from './booking/booking.module';
import { AiModule } from './ai/ai.module';
import { AdminModule } from './admin/admin.module';
import { JwtAuthGuard } from './auth/auth.guard';
import { HealthController } from './health.controller';
import { AdminController } from './admin.controller';
import { ConfigController } from './config/config.controller';

@Module({
  imports: [
    // BullMQ подключается только при наличии Redis; без него ИИ-задачи
    // выполняются в процессе API (dev-режим), см. AiModule.
    ...(process.env.REDIS_URL
      ? [BullModule.forRoot({ connection: { url: process.env.REDIS_URL } as never })]
      : []),
    PrismaModule,
    FirebaseModule,
    RedisModule,
    SettingsModule,
    StorageModule,
    SecurityModule,
    NotificationsModule,
    ReviewsModule,
    ShopModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    SlotsModule,
    BookingModule,
    AiModule,
    AdminModule,
  ],
  controllers: [HealthController, AdminController, ConfigController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: PublicCacheInterceptor },
  ],
})
export class AppModule {}
