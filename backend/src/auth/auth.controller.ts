import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { clientIp } from '../common/time';

class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(6) @MaxLength(100) password!: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
}

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) @MaxLength(100) password!: string;
}

class GoogleDto {
  @IsString() @MinLength(20) idToken!: string;
}

/**
 * JWT-авторизация (требование «JWT Auth + Private Routes»).
 * POST /api/auth/register — регистрация по email и паролю
 * POST /api/auth/login    — вход
 * POST /api/auth/google   — обмен Google ID-токена (Firebase) на JWT сайта
 */
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.auth.register(dto, clientIp(req));
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('google')
  @HttpCode(200)
  google(@Body() dto: GoogleDto, @Req() req: any) {
    return this.auth.google(dto.idToken, clientIp(req));
  }
}
