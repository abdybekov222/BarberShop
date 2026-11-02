import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';

class UpdateSettingDto {
  @IsString() key!: string;
  @IsString() value!: string;
}

@Controller('admin/settings')
@UseGuards(RolesGuard)
@Roles('admin', 'owner')
export class AdminSettingsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  getAll() {
    return this.admin.getSettings();
  }

  @Put()
  update(@Body() dto: UpdateSettingDto) {
    return this.admin.updateSetting(dto.key, dto.value);
  }
}
