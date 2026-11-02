'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Heart } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { apiGet } from '../../lib/api';
import type { Product, ProductPage } from '../../lib/shop';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppSelector } from '../../store/store';
import { ProductCard, ProductCardSkeleton } from '../../components/shop/ProductCard';
import { useMounted } from '../../lib/useMounted';

export default function FavoritesPage() {
  const { t } = useI18n();
  const ids = useAppSelector((s) => s.favorites.ids);
  const [products, setProducts] = useState<Product[] | null>(null);
  const mounted = useMounted();
  const { user } = useAuth();

  useEffect(() => {
    if (ids.length === 0) {
      setProducts([]);
      return;
    }
    apiGet<ProductPage>(`/api/products?ids=${ids.join(',')}&limit=48`, null)
      .then((d) => setProducts(ids.map((id) => d.items.find((p) => p.id === id)).filter((p): p is Product => Boolean(p))))
      .catch(() => setProducts([]));
  }, [ids]);

  return (
    <div className="mx-auto max-w-screen px-4 pb-24 pt-10 sm:px-6 lg:px-10">
      {mounted && user && (
        <Link href="/account" className="mb-4 inline-flex h-10 items-center gap-2 rounded-full bg-subtle px-4 text-sm font-medium text-text-secondary hover:text-text-primary">
          <ArrowLeft size={15} /> {t('acc.back')}
        </Link>
      )}
      <h1 className="font-serif text-5xl sm:text-6xl">{t('fav.title')}</h1>
      {!mounted || products === null ? (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {ids.slice(0, 4).map((id) => (
            <ProductCardSkeleton key={id} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <Heart size={44} strokeWidth={1} className="text-gold-500" />
          <p className="mt-6 max-w-sm">{t('fav.empty')}</p>
          <Link href="/shop" className="mt-8 inline-flex h-12 items-center whitespace-nowrap rounded-full bg-gold-500 px-8 text-sm font-semibold text-black">
            {t('cart.toShop')}
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
