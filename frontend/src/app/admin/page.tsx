import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminDashboard } from './AdminDashboard';
import { getServerI18n } from '../../i18n/server';

export function generateMetadata(): Metadata {
  return { title: getServerI18n().t('acc.admin'), robots: { index: false, follow: false } };
}

export default function AdminPage() {
  // useSearchParams (?tab=) требует Suspense
  return (
    <Suspense>
      <AdminDashboard />
    </Suspense>
  );
}
