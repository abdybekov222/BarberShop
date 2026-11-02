'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { formatKgs } from '@barbershop/shared';
import { useI18n } from '../../i18n/I18nProvider';
import { clearCart, removeFromCart, setQty } from '../../store/cartSlice';
import { selectCartTotal, useAppDispatch, useAppSelector } from '../../store/store';
import { FREE_DELIVERY_FROM } from '../../lib/shop';
import { useMounted } from '../../lib/useMounted';

export default function CartPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.cart.items);
  const subtotal = useAppSelector(selectCartTotal);
  const mounted = useMounted();

  if (!mounted) return <div className="mx-auto max-w-screen px-4 py-24"><div className="h-64 animate-pulse rounded-sm bg-bg-elevated-2" /></div>;

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <ShoppingBag size={48} strokeWidth={1} className="text-gold-500" />
        <h1 className="mt-6 font-serif text-4xl">{t('cart.empty')}</h1>
        <p className="mt-3">{t('cart.emptyText')}</p>
        <Link href="/shop" className="mt-8 inline-flex h-12 items-center rounded-sm bg-gold-500 px-8 font-serif uppercase tracking-[0.08em] text-black hover:bg-gold-400">
          {t('cart.toShop')}
        </Link>
      </div>
    );
  }

  const toFree = FREE_DELIVERY_FROM - subtotal;

  return (
    <div className="mx-auto max-w-screen px-4 pb-24 pt-10 sm:px-6 lg:px-10">
      <h1 className="font-serif text-5xl sm:text-6xl">{t('cart.title')}</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <ul className="divide-y divide-line border-y border-line">
            {items.map((i) => (
              <li key={i.id} className="flex gap-4 py-5">
                <Link href={`/shop/${i.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-sm bg-bg-elevated-2 sm:h-28 sm:w-28">
                  <Image src={i.image_url} alt={i.name} fill sizes="112px" className="object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/shop/${i.slug}`} className="font-medium text-text-primary hover:text-gold-500">
                      {i.name}
                    </Link>
                    <button
                      type="button"
                      onClick={() => dispatch(removeFromCart(i.id))}
                      aria-label={`${t('cart.remove')}: ${i.name}`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-text-secondary hover:text-error"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <p className="text-sm">{formatKgs(i.price)}</p>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="inline-flex h-10 items-center rounded-sm border border-line">
                      <button
                        type="button"
                        onClick={() => dispatch(setQty({ id: i.id, qty: i.qty - 1 }))}
                        disabled={i.qty <= 1}
                        aria-label="−1"
                        className="inline-flex h-full w-10 items-center justify-center disabled:opacity-30"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-text-primary">{i.qty}</span>
                      <button
                        type="button"
                        onClick={() => dispatch(setQty({ id: i.id, qty: i.qty + 1 }))}
                        disabled={i.qty >= i.stock}
                        aria-label="+1"
                        className="inline-flex h-full w-10 items-center justify-center disabled:opacity-30"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="font-serif text-xl text-text-primary">{formatKgs(i.price * i.qty)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => dispatch(clearCart())} className="mt-4 text-sm text-text-secondary underline underline-offset-4 hover:text-error">
            {t('cart.clear')}
          </button>
        </div>

        <aside className="h-fit rounded-sm border border-line bg-bg-elevated p-6 lg:sticky lg:top-24">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt>{t('cart.subtotal')}</dt>
              <dd className="text-text-primary">{formatKgs(subtotal)}</dd>
            </div>
          </dl>
          {toFree > 0 && (
            <p className="mt-4 text-xs">
              {t('cart.freeFrom')} {formatKgs(FREE_DELIVERY_FROM)} — {t('cart.more')} {formatKgs(toFree)}
            </p>
          )}
          <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
            <span className="font-serif text-xl uppercase">{t('cart.total')}</span>
            <span className="font-serif text-3xl text-text-primary">{formatKgs(subtotal)}</span>
          </div>
          <Link
            href="/checkout"
            className="mt-6 flex h-14 items-center justify-center rounded-sm bg-gold-500 font-serif text-lg uppercase tracking-[0.08em] text-black hover:bg-gold-400"
          >
            {t('cart.checkout')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
