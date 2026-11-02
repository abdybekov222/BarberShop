'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';

/** Брендированная страница ошибки 500 (ТЗ §2.4). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-serif text-7xl text-gold-500 mb-4">500</p>
      <div className="gold-line w-16 mb-6" />
      <h1 className="text-2xl font-serif text-text-primary mb-2">{t('err.title')}</h1>
      <p className="text-text-secondary mb-8">
        {t('err.text')}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center justify-center rounded-full px-6 font-semibold bg-gold-500 hover:bg-gold-400 text-black"
        >
          {t('err.retry')}
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-full border border-gold-500 px-6 text-gold-500"
        >
          {t('err.home')}
        </Link>
      </div>
    </div>
  );
}
