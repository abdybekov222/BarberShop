import type { Metadata } from 'next';
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
  const { t } = getServerI18n();
  const data = await getProducts(searchParams);

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
        <p className="py-24 text-center">{t('common.error')}</p>
      ) : data.items.length === 0 ? (
        <p className="py-24 text-center">{t('shop.empty')}</p>
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
