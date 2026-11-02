import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Услуги ─────────────────────────────────────────────────────
  async getCategories() {
    return this.prisma.serviceCategory.findMany({
      orderBy: { sort_order: 'asc' },
      include: {
        services: {
          where: { is_active: true },
          orderBy: { sort_order: 'asc' },
        },
      },
    });
  }

  async getServices(categorySlug?: string) {
    return this.prisma.service.findMany({
      where: {
        is_active: true,
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      },
      orderBy: { sort_order: 'asc' },
      include: { category: { select: { id: true, slug: true, name: true } } },
    });
  }

  // ─── Мастера ────────────────────────────────────────────────────
  async getMasters() {
    return this.prisma.master.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      include: {
        master_services: {
          include: {
            service: { select: { id: true, name: true, duration_min: true } },
          },
        },
        working_hours: { orderBy: { weekday: 'asc' } },
      },
    });
  }

  async getMasterBySlug(slug: string) {
    return this.prisma.master.findUnique({
      where: { slug },
      include: {
        master_services: {
          include: { service: { include: { category: true } } },
        },
        working_hours: { orderBy: { weekday: 'asc' } },
        reviews: {
          where: { is_published: true },
          orderBy: { created_at: 'desc' },
          take: 10,
        },
        gallery_items: {
          where: { is_published: true },
          orderBy: { sort_order: 'asc' },
          take: 12,
        },
      },
    });
  }

  // ─── Галерея ─────────────────────────────────────────────────────
  async getGallery(opts: {
    styleTag?: string;
    masterSlug?: string;
    skip?: number;
    take?: number;
  }) {
    const { styleTag, masterSlug, skip = 0, take = 16 } = opts;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.galleryItem.findMany({
        where: {
          is_published: true,
          ...(styleTag ? { style_tag: styleTag } : {}),
          ...(masterSlug ? { master: { slug: masterSlug } } : {}),
        },
        orderBy: { sort_order: 'asc' },
        skip,
        take,
        include: {
          master: { select: { id: true, slug: true, name: true } },
          service_category: { select: { id: true, slug: true, name: true } },
        },
      }),
      this.prisma.galleryItem.count({
        where: {
          is_published: true,
          ...(styleTag ? { style_tag: styleTag } : {}),
          ...(masterSlug ? { master: { slug: masterSlug } } : {}),
        },
      }),
    ]);
    return { items, total, skip, take };
  }

  // ─── Salon config (для клиентской части) ─────────────────────────
  async getConfig() {
    const settings = await this.prisma.salonSetting.findMany();
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const budget = await this.prisma.aiBudget.findFirst({ where: { id: 1 } });
    return {
      timezone: map['timezone'] ?? 'Asia/Bishkek',
      slot_step_min: Number(map['slot_step_min'] ?? 30),
      ai_free_limit: Number(map['ai_free_limit'] ?? 3),
      ai_enabled: !(budget?.kill_switch ?? false),
    };
  }
}
