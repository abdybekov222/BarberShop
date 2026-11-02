import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { Public } from '../auth/public.decorator';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/slots?masterId=…&duration=45            — сетка конкретного мастера
 * GET /api/slots?masterId=any&services=id1,id2&duration=45 — «Любой свободный»
 */
@Public()
@Controller('slots')
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  /** GET /api/slots/nearest — ближайшее окно каждого мастера. */
  @Get('nearest')
  nearest() {
    return this.slots.nearest();
  }

  @Get()
  async getSlots(
    @Query('masterId') masterId: string,
    @Query('duration') duration?: string,
    @Query('horizon') horizon?: string,
    @Query('services') services?: string,
  ) {
    if (!masterId) throw new BadRequestException('masterId обязателен');
    const durationMin = Math.min(Math.max(Number(duration) || 30, 15), 480);
    const horizonDays = horizon ? Math.min(Math.max(Number(horizon), 1), 30) : undefined;

    if (masterId === 'any') {
      const ids = (services ?? '').split(',').filter((s) => UUID.test(s));
      return this.slots.getSlotsAny(ids, durationMin, horizonDays);
    }
    if (!UUID.test(masterId)) throw new BadRequestException('Некорректный masterId');
    return this.slots.getSlots(masterId, durationMin, horizonDays);
  }
}
