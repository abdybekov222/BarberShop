'use client';

import { useI18n } from '../i18n/I18nProvider';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Sticky-кнопка «Записаться» внизу экрана на мобильном (ТЗ §2.3).
 * Скрывается на странице записи, в кабинете и админке.
 */
export function BookingCta() {
  const { t } = useI18n();
  const pathname = usePathname();
  if (
    pathname.startsWith('/booking') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/admin') || pathname.startsWith('/auth') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout')
  ) {
    return null;
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden border-t hairline bg-bg-primary/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <Link
        href="/booking"
        className="flex h-12 w-full items-center justify-center rounded-full bg-gold-500 whitespace-nowrap text-sm font-semibold text-black"
      >
        {t('nav.book')}
      </Link>
    </div>
  );
}
