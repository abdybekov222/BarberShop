import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Star, Store, Truck } from 'lucide-react';
import { formatKgs } from '@barbershop/shared';
import { getServerI18n } from '../../../i18n/server';
import { CATEGORY_KEY, type Product } from '../../../lib/shop';
import { ProductActions } from '../../../components/shop/ProductActions';
import { ProductReviews } from '../../../components/shop/ProductReviews';
import { ProductCard } from '../../../components/shop/ProductCard';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type ProductDetail = Product & {
  reviews: { id: string; rating: number; text: string | null; created_at: string; author: string }[];
  related: Product[];
};

async function getProduct(slug: string): Promise<ProductDetail | null> {
  try {
    const res = await fetch(`${API}/api/products/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getProduct(params.slug);
  if (!p) return { title: 'Товар не найден' };
  return { title: p.name, description: p.description.slice(0, 160), openGraph: { images: [p.image_url] } };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const p = await getProduct(params.slug);
  if (!p) notFound();
  const { t } = getServerI18n();

  return (
    <div className="mx-auto max-w-screen px-4 pb-24 pt-8 sm:px-6 lg:px-10">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Навигация">
        <Link href="/shop" className="hover:text-text-primary">
          {t('shop.title')}
        </Link>
        <ChevronRight size={14} className="text-faint" />
        <Link href={`/shop?category=${p.category}`} className="hover:text-text-primary">
          {t(CATEGORY_KEY[p.category])}
        </Link>
        <ChevronRight size={14} className="text-faint" />
        <span className="text-text-primary">{p.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="relative aspect-square overflow-hidden rounded-sm bg-bg-elevated-2">
          <Image src={p.image_url} alt={p.name} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{p.brand}</p>
          <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{p.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            {p.rating && (
              <a href="#reviews" className="inline-flex items-center gap-1.5">
                <Star size={15} className="fill-gold-500 text-gold-500" /> {p.rating}
                <span className="text-text-secondary">· {t('shop.reviews')}: {p.reviews_count}</span>
              </a>
            )}
            {p.volume && (
              <span>
                {t('shop.volume')}: <span className="text-text-primary">{p.volume}</span>
              </span>
            )}
          </div>

          <p className="mt-8 flex items-baseline gap-3">
            <span className="font-serif text-5xl text-text-primary">{formatKgs(p.price)}</span>
            {p.old_price && <span className="text-lg text-text-secondary line-through">{formatKgs(p.old_price)}</span>}
          </p>

          <ProductActions product={p} />

          <ul className="mt-8 space-y-3 border-y border-line py-5 text-sm">
            <li className="flex gap-3">
              <Store size={18} strokeWidth={1.5} className="shrink-0 text-gold-500" />
              {t('checkout.pickup')} — {t('checkout.pickupNote').toLowerCase()}
            </li>
            <li className="flex gap-3">
              <Truck size={18} strokeWidth={1.5} className="shrink-0 text-gold-500" />
              {t('checkout.courier')} — {t('checkout.courierNote')}
            </li>
          </ul>

          <div className="mt-8 space-y-6 leading-relaxed">
            <p className="text-base text-text-primary/90">{p.description}</p>
            {p.usage && (
              <div>
                <h2 className="font-serif text-xl">{t('shop.usage')}</h2>
                <p className="mt-2">{p.usage}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <section id="reviews" className="mt-20 scroll-mt-24">
        <h2 className="font-serif text-3xl sm:text-4xl">
          {t('shop.reviews')} <span className="text-text-secondary">{p.reviews_count}</span>
        </h2>
        <ProductReviews productId={p.id} reviews={p.reviews} />
      </section>

      {p.related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-serif text-3xl sm:text-4xl">{t('shop.related')}</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {p.related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: p.name,
            brand: p.brand,
            image: p.image_url,
            description: p.description,
            offers: {
              '@type': 'Offer',
              price: p.price,
              priceCurrency: 'KGS',
              availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            },
            ...(p.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviews_count } } : {}),
          }),
        }}
      />
    </div>
  );
}
