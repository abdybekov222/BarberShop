import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminDashboard } from './AdminDashboard';

export const metadata: Metadata = {
  title: 'Админ-панель',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  // useSearchParams (?tab=) требует Suspense
  return (
    <Suspense>
      <AdminDashboard />
    </Suspense>
  );
}
