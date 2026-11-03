import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ChevronRight, Star } from 'lucide-react';
import { formatKgs } from '@barbershop/shared';
import { RankBadge } from '../../../components/ui/Badge';
import { StarRating } from '../../../components/ui/StarRating';
import { BRAND } from '../../../lib/brand';
import { getServerI18n } from '../../../i18n/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface MasterService {
  price_override: number | null;
  duration_override: number | null;
  service: { id: string; name: string; base_price: number; duration_min: number; is_active: boolean; category: { name: string; sort_order: number } };
}

interface MasterProfile {
  id: string;
  slug: string;
  name: string;
  rank: string;
  bio: string | null;
  photo_url: string | null;
  experience_years: number | null;
  rating: string | null;
  specialties: string[];
  master_services: MasterService[];
  gallery_items: { id: string; image_url: string; caption: string | null }[];
  reviews: { id: string; rating: number; text: string | null; created_at: string }[];
}

async function getMaster(slug: string): Promise<MasterProfile | null> {
  try {
    const res = await fetch(`${API}/api/masters/${slug}`, { next: { revalidate: 3600 } });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { t } = await getServerI18n();
  const master = await getMaster(slug);
  if (!master) return { title: '404' };
  return { title: master.name, description: master.bio ?? `${t('home.masterOf')} ${master.name}` };
}

export default async function MasterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const master = await getMaster(slug);
  if (!master) notFound();
  const firstName = master.name.split(' ')[0];
  const { t } = await getServerI18n();
  const services = master.master_services
    .filter((ms) => ms.service.is_active)
    .sort((a, b) => a.service.category.sort_order - b.service.category.sort_order);

  return (
    <div className="mx-auto max-w-screen px-4 sm:px-6 lg:px-10 pt-8 pb-24">
      <nav className="flex items-center gap-1.5 text-sm" aria-label="breadcrumb">
        <Link href="/team" className="hover:text-text-primary">
          {t('pg.team.title')}
        </Link>
        <ChevronRight size={13} className="text-faint" />
        <span className="text-text-primary">{master.name}</span>
      </nav>

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-bg-elevated">
            {master.photo_url && (
              <Image
                src={master.photo_url}
                alt={`${master.name} — ${BRAND.full}`}
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            )}
            <div className="absolute inset-4 border border-gold-500/30 pointer-events-none" />
          </div>
          <Link
            href={`/booking?master=${master.slug}`}
            className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-gold-500 whitespace-nowrap text-sm font-semibold text-black hover:bg-gold-400"
          >
            {t('pg.team.book')} · {firstName} <ArrowRight size={16} />
          </Link>
        </div>

        <div>
          <RankBadge rank={master.rank} />
          <h1 className="mt-5 font-serif text-5xl sm:text-6xl">{master.name}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {master.rating && <StarRating value={Number(master.rating)} label={t('shop.rating')} />}
            {master.experience_years ? <span>{t('pg.team.exp')}: {master.experience_years}</span> : null}
          </div>
          {master.specialties.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {master.specialties.map((s) => (
                <li key={s} className="rounded-sm border hairline px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-text-primary/80">
                  {s}
                </li>
              ))}
            </ul>
          )}
          {master.bio && <p className="mt-8 text-lg leading-relaxed text-text-primary/85">{master.bio}</p>}

          {services.length > 0 && (
            <section className="mt-14">
              <p className="eyebrow">{t('nav.services')}</p>
              <ul className="mt-6 divide-y divide-line border-y hairline">
                {services.map((ms) => (
                  <li key={ms.service.id}>
                    <Link href={`/booking?master=${master.slug}&service=${ms.service.id}`} className="group flex items-baseline py-4">
                      <span className="font-serif text-xl text-text-primary group-hover:text-gold-400">{ms.service.name}</span>
                      <span className="ml-3 text-xs text-text-secondary/60">{ms.duration_override ?? ms.service.duration_min} {t('bk.min')}</span>
                      <span className="price-leader" aria-hidden="true" />
                      <span className="whitespace-nowrap font-serif text-xl text-gold-400">
                        {formatKgs(ms.price_override ?? ms.service.base_price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {master.gallery_items.length > 0 && (
            <section className="mt-14">
              <p className="eyebrow">{t('pg.gallery.title')}</p>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {master.gallery_items.map((gi) => (
                  <div key={gi.id} className="card-zoom relative aspect-square overflow-hidden rounded-sm bg-bg-elevated">
                    <Image src={gi.image_url} alt={gi.caption ?? master.name} fill sizes="(min-width: 640px) 20vw, 50vw" className="object-cover" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {master.reviews.length > 0 && (
            <section className="mt-14">
              <p className="eyebrow">{t('shop.reviews')}</p>
              <ul className="mt-6 space-y-6">
                {master.reviews.map((r) => (
                  <li key={r.id} className="border-l border-gold-500/40 pl-5">
                    <div className="flex gap-0.5" aria-label={`${r.rating}/5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={13} className={n <= r.rating ? 'fill-gold-500 text-gold-500' : 'text-faint'} />
                      ))}
                    </div>
                    {r.text && <p className="mt-2 font-serif text-lg text-text-primary">«{r.text}»</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* schema.org Person (ТЗ §2.5) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: master.name,
            jobTitle: t('home.masterOf'),
            worksFor: { '@type': 'HairSalon', name: BRAND.full },
            image: master.photo_url ?? undefined,
          }),
        }}
      />
    </div>
  );
}
