import { Controller, Get, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';

class UpdateBookingStatusDto {
  @IsString() status!: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

@Controller('admin/bookings')
@UseGuards(RolesGuard)
@Roles('admin', 'owner')
export class AdminBookingsController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  getStats() {
    return this.admin.getStats();
  }

  @Get()
  list(
    @Query('status') status?: string,
    @Query('masterId') masterId?: string,
    @Query('date') date?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.getBookings({
      status,
      masterId,
      date,
      skip: skip ? Number(skip) : 0,
      take: take ? Math.min(Number(take), 100) : 50,
    });
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateBookingStatusDto, @Req() req: any) {
    return this.admin.updateBookingStatus(id, dto.status, req.user.id as string, dto.reason);
  }
}
