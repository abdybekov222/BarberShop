import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ProductCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const PRODUCT_CATEGORIES = ['styling', 'beard', 'shave', 'care', 'tools', 'gift'] as const;
export const PRODUCT_SORTS = ['popular', 'price_asc', 'price_desc', 'new', 'rating'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface ProductQuery {
  q?: string;
  category?: ProductCategory;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
  ids?: string[];
}

const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  popular: [{ is_featured: 'desc' }, { reviews_count: 'desc' }, { sort_order: 'asc' }],
  price_asc: [{ price: 'asc' }],
  price_desc: [{ price: 'desc' }],
  new: [{ created_at: 'desc' }],
  rating: [{ rating: { sort: 'desc', nulls: 'last' } }, { reviews_count: 'desc' }],
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Каталог: поиск по названию/бренду, фильтры, сортировка, пагинация. */
  async list(query: ProductQuery, includeInactive = false) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(query.limit ?? 12, 1), 48);
    const where: Prisma.ProductWhereInput = {
      ...(includeInactive ? {} : { is_active: true }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.inStock ? { stock: { gt: 0 } } : {}),
      ...(query.ids?.length ? { id: { in: query.ids } } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? { price: { gte: query.minPrice ?? undefined, lte: query.maxPrice ?? undefined } }
        : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { name: { contains: query.q.trim(), mode: 'insensitive' } },
              { brand: { contains: query.q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: ORDER_BY[query.sort ?? 'popular'],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async bySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, is_active: true },
      include: {
        reviews: {
          orderBy: { created_at: 'desc' },
          take: 20,
          include: { user: { select: { full_name: true } } },
        },
      },
    });
    if (!product) throw new NotFoundException('Товар не найден');
    const related = await this.prisma.product.findMany({
      where: { category: product.category, is_active: true, id: { not: product.id } },
      orderBy: { sort_order: 'asc' },
      take: 4,
    });
    return {
      ...product,
      reviews: product.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        created_at: r.created_at,
        author: r.user.full_name.split(' ')[0] ?? 'Клиент',
      })),
      related,
    };
  }

  async addReview(productId: string, userId: string, rating: number, text?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Товар не найден');
    try {
      await this.prisma.productReview.create({
        data: { product_id: productId, user_id: userId, rating, text: text?.trim() || null },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Вы уже оставили отзыв об этом товаре');
      }
      throw e;
    }
    const agg = await this.prisma.productReview.aggregate({
      where: { product_id: productId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        rating: agg._avg.rating === null ? null : Math.round(agg._avg.rating * 10) / 10,
        reviews_count: agg._count,
      },
    });
    return { ok: true };
  }

  // ─── Админка ─────────────────────────────────────────────────────

  create(data: Prisma.ProductCreateInput) {
    return this.prisma.product.create({ data });
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    return this.prisma.product.update({ where: { id }, data: { ...data, updated_at: new Date() } });
  }

  /** Товар, который уже есть в заказах, не удаляется физически — он скрывается. */
  async remove(id: string) {
    const used = await this.prisma.orderItem.count({ where: { product_id: id } });
    if (used > 0) {
      await this.prisma.product.update({ where: { id }, data: { is_active: false } });
      return { ok: true, archived: true };
    }
    await this.prisma.product.delete({ where: { id } });
    return { ok: true, archived: false };
  }
}
