import type { Metadata } from 'next';
import { PageHeader } from '../../components/PageHeader';
import { PHOTOS } from '../../lib/brand';
import { ServicesClient, type Category } from './ServicesClient';
import { getServerI18n } from '../../i18n/server';

export function generateMetadata(): Metadata {
  const { t } = getServerI18n();
  return { title: t('pg.services.title'), description: t('pg.services.lead') };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API}/api/services/categories`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function ServicesPage() {
  const categories = (await getCategories()).filter((c) => c.services.length > 0);
  const { t } = getServerI18n();
  return (
    <>
      <PageHeader eyebrow={t('pg.services.eyebrow')} title={t('pg.services.title')} photo={PHOTOS.tools}>
        {t('pg.services.lead')}
      </PageHeader>
      <ServicesClient categories={categories} />
      {/* schema.org Service/Offer (ТЗ §2.4 SEO) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'OfferCatalog',
            name: 'Услуги BARS Barber Club',
            itemListElement: categories.flatMap((c) =>
              c.services.map((s) => ({
                '@type': 'Offer',
                price: s.base_price,
                priceCurrency: 'KGS',
                itemOffered: { '@type': 'Service', name: s.name, description: s.description ?? undefined },
              })),
            ),
          }),
        }}
      />
    </>
  );
}
