import { Controller, Get, Patch, Post, Param, Body, UseGuards } from '@nestjs/common';
import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';

class ToggleMasterDto {
  @IsBoolean() isActive!: boolean;
}

class TimeOffDto {
  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;
  @IsOptional() @IsString() @MaxLength(120) reason?: string;
}

@Controller('admin/masters')
@UseGuards(RolesGuard)
@Roles('admin', 'owner')
export class AdminMastersController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list() {
    return this.admin.getMasters();
  }

  @Patch(':id/active')
  toggle(@Param('id') id: string, @Body() dto: ToggleMasterDto) {
    return this.admin.toggleMasterActive(id, dto.isActive);
  }

  /** Отпуск / больничный / исключение в расписании. */
  @Post(':id/time-off')
  timeOff(@Param('id') id: string, @Body() dto: TimeOffDto) {
    return this.admin.addTimeOff(id, dto.startsAt, dto.endsAt, dto.reason);
  }
}
