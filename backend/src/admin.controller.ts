import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';

@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  @Roles('admin', 'owner')
  @Get('health')
  adminHealth() {
    return { status: 'ok', message: 'admin area' };
  }
}
