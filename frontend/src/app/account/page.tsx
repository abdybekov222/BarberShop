'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, LayoutDashboard, MessageSquare, Package, ScanFace, Send, ShoppingBag } from 'lucide-react';
import { formatKgs } from '@barbershop/shared';
import { useAuth } from '../../lib/auth-context';
import { apiGet } from '../../lib/api';
import { ORDER_STATUS_LABEL } from '../../lib/shop';
import { useI18n } from '../../i18n/I18nProvider';
import type { TKey } from '../../i18n/dictionaries';

interface Profile {
  full_name: string;
  role: string;
  ai_quota: { remaining: number; free_limit: number; bonus_count: number } | null;
}
interface Booking {
  id: string;
  starts_at: string;
  status: string;
  total_price: number;
  master: { name: string; photo_url: string | null };
  items: { service: { name: string } }[];
}
interface Order {
  id: string;
  number: number;
  status: string;
  total: number;
  created_at: string;
}
interface Tg {
  linked: boolean;
  url: string | null;
  bot: string | null;
}

const card = 'rounded-3xl border border-line bg-bg-elevated p-6';

export default function AccountOverview() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [next, setNext] = useState<Booking | null | undefined>(undefined);
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [tg, setTg] = useState<Tg | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = await user.getIdToken();
      const [p, b, o, tgInfo] = await Promise.all([
        apiGet<Profile>('/api/users/me', token).catch(() => null),
        apiGet<Booking[]>('/api/bookings/my?scope=upcoming', token).catch(() => []),
        apiGet<Order[]>('/api/orders/my', token).catch(() => []),
        apiGet<Tg>('/api/users/me/telegram', token).catch(() => null),
      ]);
      setProfile(p);
      setNext(b[0] ?? null);
      setOrder(o[0] ?? null);
      setTg(tgInfo);
    })();
  }, [user]);

  if (!user) return null;
  const locale = lang === 'en' ? 'en-GB' : lang === 'ky' ? 'ky-KG' : 'ru-RU';
  const isAdmin = user.role === 'admin' || user.role === 'owner';
  const quota = profile?.ai_quota;

  return (
    <div>
      <p className="text-sm text-gold-500">{t(`acc.role.${user.role}` as TKey)}</p>
      <h1 className="mt-1 font-serif text-4xl sm:text-5xl">
        {t('acc.hello')}, {user.full_name.split(' ')[0]}
      </h1>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {isAdmin ? (
          <AdminShortcuts />
        ) : (
        <>
        <section className={`${card} md:col-span-2`}>
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays size={16} className="text-gold-500" /> {t('acc.nextVisit')}
          </div>
          {next === undefined ? (
            <div className="mt-4 h-16 animate-pulse rounded-xl bg-bg-elevated-2" />
          ) : next ? (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="relative h-14 w-14 overflow-hidden rounded-full bg-bg-elevated-2">
                {next.master.photo_url && <Image src={next.master.photo_url} alt="" fill sizes="56px" className="object-cover" />}
              </span>
              <div className="min-w-[200px] flex-1">
                <p className="font-serif text-2xl text-text-primary first-letter:uppercase">
                  {new Date(next.starts_at).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bishkek' })}
                </p>
                <p className="text-sm">
                  {next.master.name} · {next.items.map((i) => i.service.name).join(', ')} · {formatKgs(next.total_price)}
                </p>
              </div>
              <Link href="/account/bookings" className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium text-text-primary hover:border-line-strong">
                {t('acc.bookings')} <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <p className="text-text-primary">{t('acc.noVisit')}</p>
              <Link href="/booking" className="inline-flex h-11 items-center rounded-full bg-gold-500 px-6 text-sm font-semibold text-black hover:bg-gold-400">
                {t('acc.book')}
              </Link>
            </div>
          )}
        </section>
        </>
        )}

        <section className={card}>
          <div className="flex items-center gap-2 text-sm">
            <ScanFace size={16} className="text-gold-500" /> {t('acc.aiLeft')}
          </div>
          {quota ? (
            <>
              <p className="mt-3 font-serif text-5xl text-text-primary">
                {quota.remaining}
                <span className="text-2xl text-text-secondary">
                  {' '}
                  {t('acc.of')} {quota.free_limit + quota.bonus_count}
                </span>
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-subtle">
                <div className="h-full rounded-full bg-gold-500" style={{ width: `${(quota.remaining / Math.max(1, quota.free_limit + quota.bonus_count)) * 100}%` }} />
              </div>
            </>
          ) : (
            <div className="mt-3 h-14 animate-pulse rounded-xl bg-bg-elevated-2" />
          )}
          <Link href="/account/mirror" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gold-500">
            {t('acc.tryOn')} <ArrowRight size={14} />
          </Link>
        </section>

        {!isAdmin && (
        <section className={card}>
          <div className="flex items-center gap-2 text-sm">
            <Package size={16} className="text-gold-500" /> {t('acc.lastOrder')}
          </div>
          {order === undefined ? (
            <div className="mt-3 h-14 animate-pulse rounded-xl bg-bg-elevated-2" />
          ) : order ? (
            <>
              <p className="mt-3 font-serif text-3xl text-text-primary">№{order.number}</p>
              <p className="text-sm">
                {ORDER_STATUS_LABEL[order.status]} · {formatKgs(order.total)}
              </p>
              <Link href="/account/orders" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gold-500">
                {t('acc.orders')} <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-text-primary">{t('acc.noOrders')}</p>
              <Link href="/shop" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gold-500">
                {t('acc.toShop')} <ArrowRight size={14} />
              </Link>
            </>
          )}
        </section>
        )}

        {tg && (tg.url || tg.linked) && (
          <section className={`${card} flex flex-wrap items-center justify-between gap-4 md:col-span-2`}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#229ED9]/15 text-[#229ED9]">
                <Send size={18} />
              </span>
              <div>
                <p className="font-semibold text-text-primary">{t('acc.tgTitle')}</p>
                <p className="text-sm">{tg.linked ? (isAdmin ? t('acc.tgAdmin') : t('acc.tgOn')) : t('acc.tgOff')}</p>
              </div>
            </div>
            {!tg.linked && tg.url && (
              <a href={tg.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-full bg-[#229ED9] px-6 text-sm font-semibold text-white hover:opacity-90">
                {t('acc.tgConnect')} @{tg.bot}
              </a>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/** Быстрые ссылки админа вместо клиентских карточек. */
function AdminShortcuts() {
  const { user } = useAuth();
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    user
      .getIdToken()
      .then((tk) => apiGet<{ pendingBookings: number }>('/api/admin/bookings/stats', tk))
      .then((s) => setPending(s.pendingBookings))
      .catch(() => setPending(null));
  }, [user]);

  const links = [
    { tab: 'bookings', label: 'Записи', note: pending === null ? 'Подтверждение и статусы' : `Ждут подтверждения: ${pending}`, Icon: CalendarDays },
    { tab: 'orders', label: 'Заказы', note: 'Статусы и оплата', Icon: Package },
    { tab: 'products', label: 'Товары', note: 'Каталог и остатки', Icon: ShoppingBag },
    { tab: 'reviews', label: 'Отзывы', note: 'Модерация', Icon: MessageSquare },
  ];

  return (
    <section className={`${card} md:col-span-2`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <LayoutDashboard size={16} className="text-gold-500" /> Админ-панель
        </div>
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-gold-500">
          Открыть <ArrowRight size={14} />
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {links.map(({ tab, label, note, Icon }) => (
          <Link key={tab} href={`/admin?tab=${tab}`} className="flex items-center gap-3 rounded-2xl bg-subtle p-4 transition-colors hover:bg-bg-elevated-2">
            <Icon size={18} className="shrink-0 text-gold-500" />
            <span className="min-w-0">
              <span className="block font-semibold text-text-primary">{label}</span>
              <span className="block text-sm">{note}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
