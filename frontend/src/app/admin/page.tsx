import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminDashboard } from './AdminDashboard';
import { getServerI18n } from '../../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return { title: t('acc.admin'), robots: { index: false, follow: false } };
}

export default function AdminPage() {
  // useSearchParams (?tab=) требует Suspense
  return (
    <Suspense>
      <AdminDashboard />
    </Suspense>
  );
}
