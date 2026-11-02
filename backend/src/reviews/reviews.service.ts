import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Отзывы клиентов (ТЗ §2.4, §3.3): один отзыв на завершённую запись,
 * рейтинг мастера пересчитывается из опубликованных отзывов.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, bookingId: string, rating: number, text?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { review: true },
    });
    if (!booking || booking.deleted_at) throw new NotFoundException('Запись не найдена');
    if (booking.user_id !== userId) throw new ForbiddenException();
    if (booking.status !== 'completed') {
      throw new BadRequestException('Отзыв можно оставить после визита');
    }
    if (booking.review) throw new ConflictException('Вы уже оставили отзыв об этом визите');

    const review = await this.prisma.review.create({
      data: {
        booking_id: bookingId,
        user_id: userId,
        master_id: booking.master_id,
        rating,
        text: text?.trim() || null,
      },
    });
    await this.recalcRating(booking.master_id);
    return review;
  }

  /** Последние опубликованные отзывы для главной страницы. */
  async latest(take = 6) {
    const rows = await this.prisma.review.findMany({
      where: { is_published: true, text: { not: null } },
      orderBy: { created_at: 'desc' },
      take,
      include: {
        user: { select: { full_name: true } },
        master: { select: { name: true, slug: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      created_at: r.created_at,
      author: firstName(r.user.full_name),
      master: r.master,
    }));
  }

  async setPublished(id: string, published: boolean) {
    const r = await this.prisma.review.update({
      where: { id },
      data: { is_published: published, updated_at: new Date() },
    });
    await this.recalcRating(r.master_id);
    return r;
  }

  async listForAdmin() {
    return this.prisma.review.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        user: { select: { full_name: true, phone: true } },
        master: { select: { name: true } },
      },
    });
  }

  private async recalcRating(masterId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { master_id: masterId, is_published: true },
      _avg: { rating: true },
    });
    const avg = agg._avg.rating;
    await this.prisma.master.update({
      where: { id: masterId },
      data: { rating: avg === null ? null : Math.round(avg * 10) / 10, updated_at: new Date() },
    });
  }
}

/** В публичных отзывах показываем только имя (без фамилии). */
function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? 'Клиент';
}
