import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BookingWizard } from './BookingWizard';
import { getServerI18n } from '../../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return { title: t('bk.title'), description: t('bk.lead') };
}

export default async function BookingPage() {
  const { t } = await getServerI18n();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 font-serif text-4xl text-text-primary sm:text-5xl">{t('bk.title')}</h1>
      <p className="mb-8 text-text-secondary">{t('bk.lead')}</p>
      {/* useSearchParams() requires Suspense boundary in Next.js App Router */}
      <Suspense fallback={<div className="py-16 text-center text-text-secondary">{t('common.loading')}</div>}>
        <BookingWizard />
      </Suspense>
    </div>
  );
}
