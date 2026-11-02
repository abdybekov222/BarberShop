'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import { formatKgs } from '@barbershop/shared';
import type { Product } from '../../lib/shop';
import { useI18n } from '../../i18n/I18nProvider';
import { addToCart } from '../../store/cartSlice';
import { toggleFavorite } from '../../store/favoritesSlice';
import { selectInCart, selectIsFavorite, useAppDispatch, useAppSelector } from '../../store/store';
import { useMounted } from '../../lib/useMounted';

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const mounted = useMounted();
  const favRaw = useAppSelector(selectIsFavorite(product.id));
  const inCartRaw = useAppSelector(selectInCart(product.id));
  const fav = mounted && favRaw;
  const inCart = mounted ? inCartRaw : 0;
  const out = product.stock <= 0;
  const discount = product.old_price ? Math.round((1 - product.price / product.old_price) * 100) : 0;

  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-sm bg-bg-elevated-2">
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
          className={`object-cover transition-transform duration-700 group-hover:scale-[1.04] ${out ? 'opacity-50 grayscale' : ''}`}
        />
        {discount > 0 && (
          <span className="absolute left-2 top-2 rounded-sm bg-gold-500 px-2 py-1 text-[11px] font-bold text-black">−{discount}%</span>
        )}
        <button
          type="button"
          onClick={() => dispatch(toggleFavorite(product.id))}
          aria-label={fav ? t('shop.removeFav') : t('shop.addFav')}
          aria-pressed={fav}
          className="absolute right-2 top-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-primary/80 text-text-primary backdrop-blur transition-colors hover:text-gold-500"
        >
          <Heart size={17} strokeWidth={1.6} className={fav ? 'fill-gold-500 text-gold-500' : ''} />
        </button>
      </div>

      <div className="mt-3 flex flex-1 flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary/80">{product.brand}</p>
        <h3 className="mt-1 text-base font-medium leading-snug text-text-primary [font-family:var(--font-sans)]">
          <Link href={`/shop/${product.slug}`} className="after:absolute after:inset-0">
            {product.name}
          </Link>
        </h3>
        {product.rating && (
          <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
            <Star size={12} className="fill-gold-500 text-gold-500" /> {product.rating}
            <span className="text-text-secondary/60">({product.reviews_count})</span>
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="flex flex-col leading-tight">
            {product.old_price && (
              <span className="text-xs text-text-secondary/70 line-through">{formatKgs(product.old_price)}</span>
            )}
            <span className="whitespace-nowrap font-serif text-xl text-text-primary">{formatKgs(product.price)}</span>
          </p>
          <button
            type="button"
            disabled={out}
            onClick={() =>
              dispatch(
                addToCart({
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  price: product.price,
                  image_url: product.image_url,
                  stock: product.stock,
                }),
              )
            }
            aria-label={`${t('shop.addToCart')}: ${product.name}`}
            className={`relative z-10 inline-flex h-10 min-w-[40px] shrink-0 items-center justify-center gap-1.5 rounded-sm px-2.5 text-xs font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 ${
              inCart ? 'border border-gold-500 text-gold-500' : 'bg-gold-500 text-black hover:bg-gold-400'
            }`}
          >
            <ShoppingBag size={15} />
            {inCart ? <span>{inCart}</span> : <span className="hidden sm:inline">{out ? t('shop.outOfStock') : t('shop.addToCart')}</span>}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Скелетон карточки (Loading skeleton UI). */
export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="aspect-square rounded-sm bg-bg-elevated-2" />
      <div className="mt-3 h-3 w-16 rounded bg-bg-elevated-2" />
      <div className="mt-2 h-4 w-3/4 rounded bg-bg-elevated-2" />
      <div className="mt-4 flex justify-between">
        <div className="h-5 w-20 rounded bg-bg-elevated-2" />
        <div className="h-10 w-24 rounded bg-bg-elevated-2" />
      </div>
    </div>
  );
}
