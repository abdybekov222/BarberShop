'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { formatKgs } from '@barbershop/shared';
import { useAuth } from '../../../lib/auth-context';
import { apiGet, apiSend } from '../../../lib/api';
import { ORDER_STATUS_LABEL } from '../../../lib/shop';
import { useI18n } from '../../../i18n/I18nProvider';

interface Order {
  id: string;
  number: number;
  status: string;
  total: number;
  delivery: 'pickup' | 'courier';
  payment_method: 'cash' | 'card_demo';
  paid_at: string | null;
  created_at: string;
  items: { id: string; name: string; qty: number; price: number; product: { slug: string; image_url: string } }[];
}

const STATUS_CLS: Record<string, string> = {
  new: 'text-gold-500',
  paid: 'text-gold-500',
  processing: 'text-gold-500',
  ready: 'text-success',
  completed: 'text-text-secondary',
  cancelled: 'text-error',
};

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : lang === 'ky' ? 'ky-KG' : 'ru-RU';
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/account/orders');
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setOrders(await apiGet<Order[]>('/api/orders/my', await user.getIdToken()).catch(() => []));
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !user) return null;

  const cancel = async (id: string) => {
    if (!window.confirm(t('acc.orderCancelAsk'))) return;
    try {
      await apiSend('POST', `/api/orders/${id}/cancel`, await user.getIdToken(), {});
      setMsg(t('acc.orderCancelled'));
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-4xl sm:text-5xl">{t('acc.orders')}</h1>
      {msg && <p className="mt-4 text-sm">{msg}</p>}

      {orders === null ? (
        <div className="mt-8 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl bg-bg-elevated-2" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-16 text-center">
          <Package size={44} strokeWidth={1} className="mx-auto text-gold-500" />
          <p className="mt-4">{t('acc.noOrders')}</p>
          <Link href="/shop" className="mt-6 inline-flex h-12 items-center whitespace-nowrap rounded-full bg-gold-500 px-8 text-sm font-semibold text-black">
            {t('acc.toShop')}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="rounded-3xl border border-line bg-bg-elevated p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-serif text-2xl text-text-primary">№{o.number}</p>
                <p className={`text-sm font-medium ${STATUS_CLS[o.status] ?? ''}`}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</p>
              </div>
              <p className="text-xs">
                {new Date(o.created_at).toLocaleString(locale, { timeZone: 'Asia/Bishkek', dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                {o.delivery === 'courier' ? t('acc.courier') : t('acc.pickup')} · {o.payment_method === 'cash' ? t('acc.payCash') : o.paid_at ? t('acc.paidCard') : t('acc.awaitPay')}
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {o.items.map((i) => (
                  <li key={i.id}>
                    <Link href={`/shop/${i.product.slug}`} className="relative block h-14 w-14 overflow-hidden rounded-xl bg-bg-elevated-2" title={`${i.name} × ${i.qty}`}>
                      <Image src={i.product.image_url} alt={i.name} fill sizes="56px" className="object-cover" />
                      {i.qty > 1 && <span className="absolute bottom-0 right-0 bg-black/70 px-1 text-[10px] text-white">×{i.qty}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-serif text-xl text-text-primary">{formatKgs(o.total)}</span>
                {['new', 'paid'].includes(o.status) && (
                  <button type="button" onClick={() => cancel(o.id)} className="text-sm text-text-secondary underline underline-offset-4 hover:text-error">
                    {t('acc.cancel')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
