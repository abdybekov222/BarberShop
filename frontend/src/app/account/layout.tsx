'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, Heart, LayoutDashboard, LogOut, Package, ScanFace, Settings, User } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../i18n/I18nProvider';

/** Каркас личного кабинета: навигация + защита маршрута (Private Route). */
export default function AccountLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-screen px-4 py-16 sm:px-6 lg:px-10">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-bg-elevated-2" />
        <div className="mt-8 h-64 animate-pulse rounded-3xl bg-bg-elevated-2" />
      </div>
    );
  }

  const isAdmin = user.role === 'admin' || user.role === 'owner';
  // У админа нет клиентских разделов (записи, заказы, избранное) — только панель управления
  const items = isAdmin
    ? [
        { href: '/account', label: t('acc.overview'), Icon: User },
        { href: '/admin', label: t('acc.admin'), Icon: LayoutDashboard },
        { href: '/account/mirror', label: t('acc.mirror'), Icon: ScanFace },
        { href: '/account/profile', label: t('acc.profile'), Icon: Settings },
      ]
    : [
        { href: '/account', label: t('acc.overview'), Icon: User },
        { href: '/account/bookings', label: t('acc.bookings'), Icon: CalendarDays },
        { href: '/account/orders', label: t('acc.orders'), Icon: Package },
        { href: '/favorites', label: t('acc.favorites'), Icon: Heart },
        { href: '/account/mirror', label: t('acc.mirror'), Icon: ScanFace },
        { href: '/account/profile', label: t('acc.profile'), Icon: Settings },
      ];

  return (
    <div className="mx-auto max-w-screen px-4 pb-24 pt-8 sm:px-6 lg:px-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="mb-4 hidden items-center gap-3 lg:flex">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-500 text-lg font-bold uppercase text-black">
              {user.full_name.trim()[0] ?? 'B'}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-text-primary">{user.full_name}</p>
              <p className="truncate text-xs">{user.email}</p>
            </div>
          </div>
          <nav aria-label={t('acc.title')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
            {items.map(({ href, label, Icon }) => {
              const active = href === '/account' ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    active ? 'bg-gold-500 text-black' : 'bg-subtle text-text-secondary hover:text-text-primary lg:bg-transparent lg:hover:bg-subtle'
                  }`}
                >
                  <Icon size={17} strokeWidth={1.7} />
                  {label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.push('/');
              }}
              className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl bg-subtle px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-error lg:mt-4 lg:bg-transparent lg:hover:bg-subtle"
            >
              <LogOut size={17} strokeWidth={1.7} />
              {t('acc.logout')}
            </button>
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
