import { Module } from '@nestjs/common';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminMastersController } from './admin-masters.controller';
import { AdminServicesController } from './admin-services.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminService } from './admin.service';
import { AdminStatsController } from './admin-stats.controller';

@Module({
  controllers: [
    AdminBookingsController,
    AdminMastersController,
    AdminServicesController,
    AdminSettingsController,
    AdminStatsController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
