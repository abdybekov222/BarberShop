'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Minus, Plus } from 'lucide-react';
import type { Product } from '../../lib/shop';
import { useI18n } from '../../i18n/I18nProvider';
import { addToCart } from '../../store/cartSlice';
import { toggleFavorite } from '../../store/favoritesSlice';
import { selectInCart, selectIsFavorite, useAppDispatch, useAppSelector } from '../../store/store';
import { useMounted } from '../../lib/useMounted';

/** Количество, «В корзину», «В избранное» на странице товара. */
export function ProductActions({ product }: { product: Product }) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const mounted = useMounted();
  const favRaw = useAppSelector(selectIsFavorite(product.id));
  const inCartRaw = useAppSelector(selectInCart(product.id));
  const fav = mounted && favRaw;
  const inCart = mounted ? inCartRaw : 0;
  const [qty, setQty] = useState(1);
  const out = product.stock <= 0;
  const max = Math.max(1, Math.min(product.stock - inCart, 20));

  return (
    <div className="mt-8">
      {out ? (
        <p className="text-error">{t('shop.outOfStock')}</p>
      ) : product.stock <= 5 ? (
        <p className="text-sm text-gold-500">
          {t('shop.left')} {product.stock} {t('shop.pcs')}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="inline-flex h-14 items-center rounded-sm border border-line">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={out || qty <= 1}
            aria-label="−1"
            className="inline-flex h-full w-12 items-center justify-center disabled:opacity-30"
          >
            <Minus size={16} />
          </button>
          <span className="w-10 text-center text-lg text-text-primary" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            disabled={out || qty >= max}
            aria-label="+1"
            className="inline-flex h-full w-12 items-center justify-center disabled:opacity-30"
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          type="button"
          disabled={out || inCart >= product.stock}
          onClick={() => {
            dispatch(
              addToCart({ id: product.id, slug: product.slug, name: product.name, price: product.price, image_url: product.image_url, stock: product.stock, qty }),
            );
            setQty(1);
          }}
          className="inline-flex h-14 flex-1 items-center justify-center rounded-sm bg-gold-500 px-8 font-serif text-lg uppercase tracking-[0.08em] text-black transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
        >
          {t('shop.addToCart')}
        </button>
        <button
          type="button"
          onClick={() => dispatch(toggleFavorite(product.id))}
          aria-pressed={fav}
          aria-label={fav ? t('shop.removeFav') : t('shop.addFav')}
          className="inline-flex h-14 w-14 items-center justify-center rounded-sm border border-line transition-colors hover:border-gold-500"
        >
          <Heart size={20} strokeWidth={1.5} className={fav ? 'fill-gold-500 text-gold-500' : 'text-text-primary'} />
        </button>
      </div>
      {inCart > 0 && (
        <p className="mt-3 text-sm">
          {t('shop.inCart')}: {inCart} ·{' '}
          <Link href="/cart" className="text-gold-500 underline underline-offset-4">
            {t('cart.checkout')}
          </Link>
        </p>
      )}
    </div>
  );
}
