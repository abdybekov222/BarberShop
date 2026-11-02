import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BookingService } from './booking.service';
import { CreateBookingDto, CancelBookingDto } from './booking.dto';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  /** Мои записи. ?scope=upcoming|past|all */
  @Get('my')
  async myBookings(
    @Req() req: any,
    @Query('scope') scope?: 'upcoming' | 'past' | 'all',
  ) {
    return this.bookingService.findForUser(req.user.id, scope ?? 'all');
  }

  /** Детали конкретной записи */
  @Get(':id')
  async one(@Param('id') id: string, @Req() req: any) {
    return this.bookingService.findOne(id, req.user.id);
  }

  /** Скачать .ics для добавления в Календарь */
  @Get(':id/ics')
  async downloadIcs(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const ics = await this.bookingService.buildIcs(id, req.user.id);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="barbershop.ics"');
    res.send(ics);
  }

  /** Создать запись */
  @Post()
  async create(@Body() dto: CreateBookingDto, @Req() req: any) {
    return this.bookingService.create(dto, req.user);
  }

  /** Отменить запись */
  @Delete(':id')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @Req() req: any,
  ) {
    return this.bookingService.cancel(id, req.user.id, dto);
  }
}
