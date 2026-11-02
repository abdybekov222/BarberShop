'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScanFace,
  Search,
  Settings,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { BRAND } from '../lib/brand';
import { useI18n } from '../i18n/I18nProvider';
import type { TKey } from '../i18n/dictionaries';
import { selectCartCount, useAppSelector } from '../store/store';
import { useMounted } from '../lib/useMounted';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { LangSwitcher } from './LangSwitcher';
import { Dropdown } from './ui/Dropdown';

const PRIMARY: { href: string; key: TKey }[] = [
  { href: '/services', key: 'nav.services' },
  { href: '/team', key: 'nav.masters' },
  { href: '/shop', key: 'nav.shop' },
  { href: '/gallery', key: 'nav.gallery' },
];
const MORE: { href: string; key: TKey }[] = [
  { href: '/account/mirror', key: 'nav.mirror' },
  { href: '/about', key: 'nav.about' },
  { href: '/contacts', key: 'nav.contacts' },
];

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-black">
      {n > 99 ? '99+' : n}
    </span>
  );
}

export function Header() {
  const { user, loading, signOut } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mounted = useMounted();
  const cartCountRaw = useAppSelector(selectCartCount);
  const favCountRaw = useAppSelector((s) => s.favorites.ids.length);
  const cartCount = mounted ? cartCountRaw : 0;
  const favCount = mounted ? favCountRaw : 0;
  const overHero = pathname === '/';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/shop?q=${encodeURIComponent(query)}` : '/shop');
    setSearchOpen(false);
  };

  const logout = async () => {
    await signOut();
    router.push('/');
  };

  const solid = !overHero || scrolled || open || searchOpen;
  const iconBtn = 'relative inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-subtle hover:text-text-primary';
  const navLink = (href: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return `whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-subtle text-text-primary' : 'text-text-secondary hover:text-text-primary'
    }`;
  };

  // У админа нет клиентских разделов (записи, заказы, избранное)
  const accountItems = [
    ...(isAdmin
      ? [
          { label: t('acc.admin'), href: '/admin', icon: <LayoutDashboard size={16} /> },
          { label: t('acc.overview'), href: '/account', icon: <User size={16} /> },
        ]
      : [
          { label: t('acc.overview'), href: '/account', icon: <User size={16} /> },
          { label: t('acc.bookings'), href: '/account/bookings', icon: <CalendarDays size={16} /> },
          { label: t('acc.orders'), href: '/account/orders', icon: <Package size={16} /> },
          { label: t('acc.favorites'), href: '/favorites', icon: <Heart size={16} />, hint: favCount ? String(favCount) : undefined },
        ]),
    { label: t('acc.mirror'), href: '/account/mirror', icon: <ScanFace size={16} /> },
    { label: t('acc.profile'), href: '/account/profile', icon: <Settings size={16} /> },
    { label: t('acc.logout'), onClick: logout, icon: <LogOut size={16} />, danger: true },
  ];

  return (
    <>
      <header
        className={`${overHero ? 'fixed' : 'sticky'} inset-x-0 top-0 z-50 transition-colors duration-300 ${
          solid ? 'border-b border-line bg-bg-primary/85 backdrop-blur-xl' : 'force-dark border-b border-transparent bg-transparent'
        }`}
      >
        <nav className="mx-auto flex h-[72px] max-w-screen items-center gap-2 px-4 sm:px-6 lg:px-10" aria-label={t('nav.main')}>
          <Link href="/" aria-label={`${BRAND.full} — ${t('nav.home')}`} className="mr-4 shrink-0">
            <Logo />
          </Link>

          <ul className="hidden items-center gap-1 xl:flex" role="list">
            {PRIMARY.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={navLink(l.href)}>
                  {t(l.key)}
                </Link>
              </li>
            ))}
            <li>
              <Dropdown
                hover
                align="left"
                label={t('nav.menu')}
                trigger={
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium text-text-secondary hover:text-text-primary">
                    {t('nav.menu')} <ChevronDown size={14} />
                  </span>
                }
                items={MORE.map((l) => ({ label: t(l.key), href: l.href }))}
              />
            </li>
          </ul>

          <div className="ml-auto flex items-center gap-0.5">
            <div className="hidden md:block">
              <LangSwitcher />
            </div>
            <ThemeToggle className="hidden sm:inline-flex" />
            <button type="button" className={iconBtn} aria-label={t('nav.search')} onClick={() => setSearchOpen((v) => !v)}>
              <Search size={18} strokeWidth={1.6} />
            </button>
            {!isAdmin && (
              <Link href="/favorites" className={`${iconBtn} hidden sm:inline-flex`} aria-label={t('nav.favorites')}>
                <Heart size={18} strokeWidth={1.6} />
                <Badge n={favCount} />
              </Link>
            )}
            <Link href="/cart" className={iconBtn} aria-label={`${t('nav.cart')}: ${cartCount}`}>
              <ShoppingBag size={18} strokeWidth={1.6} />
              <Badge n={cartCount} />
            </Link>
            {!loading && mounted && (
              <div className="hidden sm:block">
                {user ? (
                  <Dropdown
                    label={t('nav.account')}
                    trigger={
                      <span className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gold-500 text-sm font-bold uppercase text-black">
                        {user.full_name.trim()[0] ?? 'B'}
                      </span>
                    }
                    header={
                      <div>
                        <p className="font-semibold text-text-primary">{user.full_name}</p>
                        <p className="truncate text-xs">{user.email}</p>
                      </div>
                    }
                    items={accountItems}
                  />
                ) : (
                  <Link href="/auth" className="ml-1 inline-flex h-10 items-center rounded-full border border-line px-4 text-sm font-semibold text-text-primary hover:border-line-strong">
                    {t('nav.login')}
                  </Link>
                )}
              </div>
            )}
            <Link
              href="/booking"
              className="ml-2 hidden h-10 items-center whitespace-nowrap rounded-full bg-gold-500 px-5 text-sm font-semibold text-black transition-colors hover:bg-gold-400 md:inline-flex"
            >
              {t('nav.book')}
            </Link>
            <button
              className="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-text-primary hover:bg-subtle xl:hidden"
              aria-label={open ? t('common.close') : t('nav.menu')}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>

        {searchOpen && (
          <form onSubmit={submitSearch} className="border-t border-line bg-bg-primary">
            <div className="mx-auto flex max-w-screen items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
              <Search size={18} className="text-text-secondary" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('shop.search')}
                aria-label={t('nav.search')}
                className="h-11 flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-secondary/60"
              />
              <button type="button" onClick={() => setSearchOpen(false)} aria-label={t('common.close')} className="text-text-secondary">
                <X size={18} />
              </button>
            </div>
          </form>
        )}
      </header>

      {/* Бургер-меню на весь экран (ТЗ §2.3) */}
      <div
        className={`fixed inset-0 z-40 flex flex-col overflow-y-auto bg-bg-primary px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-24 transition-[opacity,transform] duration-300 xl:hidden ${
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.menu')}
        aria-hidden={!open}
      >
        {user && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-subtle p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-500 font-bold uppercase text-black">{user.full_name[0]}</span>
            <div className="min-w-0">
              <p className="font-semibold text-text-primary">{user.full_name}</p>
              <Link href="/account" className="text-sm text-gold-500">
                {t('nav.account')}
              </Link>
            </div>
          </div>
        )}
        <ul className="flex flex-col" role="list">
          {[...PRIMARY, ...MORE].map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="block border-b border-line py-3.5 font-serif text-2xl uppercase text-text-primary">
                {t(l.key)}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <LangSwitcher inline />
          <ThemeToggle />
          {!user && (
            <Link href="/auth" className="ml-auto text-sm font-semibold text-gold-500">
              {t('nav.login')}
            </Link>
          )}
        </div>
        <Link href="/booking" className="mt-6 flex h-14 items-center justify-center rounded-2xl bg-gold-500 text-base font-semibold text-black">
          {t('nav.book')}
        </Link>
        <div className="mt-auto space-y-1 pt-8 text-sm">
          <a href={BRAND.phoneHref} className="block text-text-primary">
            {BRAND.phone}
          </a>
          <p>{t('contact.address')}</p>
        </div>
      </div>
    </>
  );
}
