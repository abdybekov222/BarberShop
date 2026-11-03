import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '../../components/PageHeader';
import { PHOTOS } from '../../lib/brand';
import { ServicesClient, type Category } from './ServicesClient';
import { getServerI18n } from '../../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
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
  const { t, lang } = await getServerI18n();
  const emptyCopy = {
    ru: { title: 'Прайс пока не загрузился', text: 'Актуальные услуги, длительность и стоимость обычно отображаются здесь из каталога салона. Напишите нам — подскажем, какие услуги доступны и сколько займёт визит.', action: 'Уточнить в контактах' },
    ky: { title: 'Прайс азырынча жүктөлгөн жок', text: 'Салондун каталогундагы кызматтар, узактыгы жана баасы адатта бул жерде көрсөтүлөт. Бизге жазыңыз — жеткиликтүү кызматтар жана визиттин узактыгы тууралуу айтып беребиз.', action: 'Байланышуу' },
    en: { title: 'The price list is unavailable', text: 'The salon catalogue normally lists current services, duration, and prices here. Contact us and we can help with available services and visit times.', action: 'Contact the salon' },
  }[lang];
  return (
    <>
      <PageHeader eyebrow={t('pg.services.eyebrow')} title={t('pg.services.title')} photo={PHOTOS.tools}>
        {t('pg.services.lead')}
      </PageHeader>
      {categories.length > 0 ? (
        <ServicesClient categories={categories} />
      ) : (
        <section className="mx-auto max-w-screen px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <div className="max-w-2xl rounded-3xl border border-line bg-bg-elevated p-8 sm:p-12">
            <p className="eyebrow">{t('pg.services.title')}</p>
            <h2 className="mt-4 font-serif text-3xl text-text-primary sm:text-4xl">{emptyCopy.title}</h2>
            <p className="mt-4 leading-relaxed">{emptyCopy.text}</p>
            <Link href="/contacts" className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-gold-500 px-6 text-sm font-semibold text-black hover:bg-gold-400">
              {emptyCopy.action}
            </Link>
          </div>
        </section>
      )}
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
