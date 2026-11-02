import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiBudgetService } from './ai-budget.service';
import { PrismaService } from '../prisma/prisma.service';

class KillSwitchDto {
  @IsBoolean() active!: boolean;
}

class LimitsDto {
  @IsOptional() @IsInt() @Min(0) @Max(1000) hourly_cap?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000) daily_cap?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10000) budget_usd?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10) est_cost_usd?: number;
}

class GrantDto {
  @IsEmail() email!: string;
  @IsInt() @Min(1) @Max(20) amount!: number;
}

class StyleDto {
  @IsOptional() @IsIn(['haircut', 'beard', 'combo']) type?: 'haircut' | 'beard' | 'combo';
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() preview_url?: string;
  @IsOptional() @IsString() prompt?: string;
  @IsOptional() @IsString() negative_prompt?: string;
  @IsOptional() @IsInt() seed?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsInt() sort_order?: number;
}

/**
 * /admin/ai — раздел «ИИ» админ-панели (owner/admin, ТЗ §1.5).
 */
@Controller('admin/ai')
@UseGuards(RolesGuard)
@Roles('admin', 'owner')
export class AiAdminController {
  constructor(
    private readonly budget: AiBudgetService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  getStatus() {
    return this.budget.getStatus();
  }

  @Post('kill-switch')
  async setKillSwitch(@Body() dto: KillSwitchDto) {
    await this.budget.setKillSwitch(dto.active);
    return this.budget.getStatus();
  }

  @Patch('limits')
  async setLimits(@Body() dto: LimitsDto) {
    await this.budget.updateLimits(dto);
    return this.budget.getStatus();
  }

  /** Ручное начисление бонусных попыток (admin_grant), с записью в ledger. */
  @Post('grant')
  async grant(@Body() dto: GrantDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { ai_quota: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    // Инкремент атомарен сам по себе; запись в ledger — следом (append-only аудит)
    const q = await this.prisma.aiQuota.upsert({
      where: { user_id: user.id },
      create: { user_id: user.id, bonus_count: dto.amount },
      update: { bonus_count: { increment: dto.amount }, updated_at: new Date() },
    });
    const balance = q.free_limit + q.bonus_count - q.used_count;
    await this.prisma.aiQuotaLedger.create({
      data: { user_id: user.id, delta: dto.amount, reason: 'admin_grant', balance_after: balance },
    });
    return { user_id: user.id, remaining: balance };
  }

  @Get('log')
  getAbuseLog() {
    return this.prisma.aiAbuseLog.findMany({ orderBy: { created_at: 'desc' }, take: 50 });
  }

  @Get('ledger')
  getLedger() {
    return this.prisma.aiQuotaLedger.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
      include: { user: { select: { id: true, email: true, full_name: true } } },
    });
  }

  // ─── Каталог образов (новый стиль добавляется из админки, ТЗ §1.5 п.5) ───

  @Get('styles')
  styles() {
    return this.prisma.hairStyle.findMany({ orderBy: [{ type: 'asc' }, { sort_order: 'asc' }] });
  }

  @Post('styles')
  createStyle(@Body() dto: StyleDto, @Req() _req: unknown) {
    return this.prisma.hairStyle.create({
      data: { type: dto.type ?? 'haircut', name: dto.name ?? 'Новый образ', ...dto },
    });
  }

  @Patch('styles/:id')
  updateStyle(@Param('id') id: string, @Body() dto: StyleDto) {
    return this.prisma.hairStyle.update({ where: { id }, data: { ...dto, updated_at: new Date() } });
  }
}
