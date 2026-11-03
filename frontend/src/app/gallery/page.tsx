import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { PHOTOS } from '../../lib/brand';
import { GalleryClient, type GalleryItem } from './GalleryClient';
import { getServerI18n } from '../../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return { title: t('pg.gallery.title'), description: t('pg.gallery.lead') };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: 1800 } });
    return res.ok ? res.json() : fallback;
  } catch {
    return fallback;
  }
}

export default async function GalleryPage() {
  const [gallery, masters] = await Promise.all([
    getJson<{ items: GalleryItem[]; total: number }>('/api/gallery?take=48', { items: [], total: 0 }),
    getJson<{ id: string; slug: string; name: string }[]>('/api/masters', []),
  ]);
  const { t } = await getServerI18n();
  return (
    <>
      <PageHeader eyebrow={t('pg.gallery.eyebrow')} title={t('pg.gallery.title')} photo={PHOTOS.fade}>
        {t('pg.gallery.lead')}
      </PageHeader>
      <Suspense>
        <GalleryClient initialItems={gallery.items} masters={masters} />
      </Suspense>
    </>
  );
}
