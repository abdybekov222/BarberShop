import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReviewsService } from './reviews.service';

class CreateReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(1000) text?: string;
}

class PublishDto {
  @IsBoolean() published!: boolean;
}

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** GET /api/reviews — последние отзывы (публично, для главной). */
  @Public()
  @Get('reviews')
  latest(@Query('take') take?: string) {
    return this.reviews.latest(Math.min(Number(take) || 6, 20));
  }

  /** POST /api/bookings/:id/review — отзыв о завершённом визите. */
  @Post('bookings/:id/review')
  create(@Param('id') id: string, @Body() dto: CreateReviewDto, @Req() req: any) {
    return this.reviews.create(req.user.id as string, id, dto.rating, dto.text);
  }

  @Get('admin/reviews')
  @UseGuards(RolesGuard)
  @Roles('admin', 'owner')
  adminList() {
    return this.reviews.listForAdmin();
  }

  /** Модерация: скрыть / опубликовать отзыв. */
  @Patch('admin/reviews/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'owner')
  publish(@Param('id') id: string, @Body() dto: PublishDto) {
    return this.reviews.setPublished(id, dto.published);
  }
}
