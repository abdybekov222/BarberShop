import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ShopFilters } from '../../components/shop/ShopFilters';
import { ProductCard } from '../../components/shop/ProductCard';
import { Pagination } from '../../components/shop/Pagination';
import { getServerI18n } from '../../i18n/server';
import type { ProductPage } from '../../lib/shop';

export const metadata: Metadata = {
  title: 'Магазин',
  description: 'Помады и глины для укладки, масла для бороды, бритвы и подарочные наборы. Самовывоз из салона или курьер по Бишкеку.',
};

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const KEYS = ['q', 'category', 'minPrice', 'maxPrice', 'inStock', 'sort', 'page'] as const;

async function getProducts(params: Record<string, string | undefined>): Promise<ProductPage | null> {
  const q = new URLSearchParams({ limit: '12' });
  for (const k of KEYS) if (params[k]) q.set(k, params[k]!);
  try {
    const res = await fetch(`${API}/api/products?${q}`, { next: { revalidate: 30 } });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

export default async function ShopPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { t, lang } = getServerI18n();
  const data = await getProducts(searchParams);
  const emptyCopy = {
    ru: { title: 'Каталог товаров пока пуст', text: 'В магазине собраны средства для укладки и ухода, которыми пользуются мастера. Когда каталог будет доступен, здесь появятся описания, объёмы и цены.', action: 'Уточнить наличие' },
    ky: { title: 'Товарлар каталогу азырынча бош', text: 'Дүкөндө чеберлер колдонгон чач жасалгалоо жана кам көрүү каражаттары бар. Каталог жеткиликтүү болгондо, бул жерде сүрөттөмөлөр, көлөмдөр жана баалар көрсөтүлөт.', action: 'Бар-жогун сураңыз' },
    en: { title: 'The product catalogue is empty', text: 'The shop features styling and care products used by our barbers. When the catalogue is available, product details, sizes, and prices will appear here.', action: 'Ask about availability' },
  }[lang];
  const hasSearchFilters = Boolean(searchParams.q || searchParams.category || searchParams.minPrice || searchParams.maxPrice || searchParams.inStock);

  return (
    <div className="mx-auto max-w-screen px-4 pb-24 pt-10 sm:px-6 lg:px-10">
      <h1 className="font-serif text-5xl sm:text-7xl">{t('shop.title')}</h1>
      <p className="mt-3 max-w-xl">{t('shop.lead')}</p>

      <div className="mt-10">
        <Suspense>
          <ShopFilters />
        </Suspense>
      </div>

      {!data ? (
        <section className="mt-10 rounded-3xl border border-line bg-bg-elevated px-6 py-12 text-center sm:px-12">
          <h2 className="font-serif text-3xl text-text-primary">{t('common.error')}</h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed">{emptyCopy.text}</p>
          <Link href="/contacts" className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-gold-500 px-6 text-sm font-semibold text-black hover:bg-gold-400">{emptyCopy.action}</Link>
        </section>
      ) : data.items.length === 0 ? (
        <section className="mt-10 rounded-3xl border border-line bg-bg-elevated px-6 py-12 text-center sm:px-12">
          {hasSearchFilters ? (
            <>
              <h2 className="font-serif text-3xl text-text-primary">{t('shop.empty')}</h2>
              <p className="mx-auto mt-3 max-w-xl leading-relaxed">{emptyCopy.text}</p>
              <Link href="/shop" className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-line-strong px-6 text-sm font-semibold text-text-primary hover:border-gold-500">{t('shop.reset')}</Link>
            </>
          ) : (
            <>
              <h2 className="font-serif text-3xl text-text-primary">{emptyCopy.title}</h2>
              <p className="mx-auto mt-3 max-w-xl leading-relaxed">{emptyCopy.text}</p>
              <Link href="/contacts" className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-gold-500 px-6 text-sm font-semibold text-black hover:bg-gold-400">{emptyCopy.action}</Link>
            </>
          )}
        </section>
      ) : (
        <>
          <p className="mt-8 text-sm text-text-secondary">
            {t('shop.found')}: {data.total}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
            {data.items.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
          <Pagination
            page={data.page}
            pages={data.pages}
            params={searchParams}
            labels={{ prev: t('shop.prev'), next: t('shop.next'), page: t('shop.page') }}
          />
        </>
      )}
    </div>
  );
}
