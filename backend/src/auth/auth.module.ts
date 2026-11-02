import { Module } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [RolesGuard, AuthService],
  exports: [RolesGuard],
})
export class AuthModule {}
