import type { Metadata } from 'next';
import { Clock, Instagram, Mail, MapPin, MessageCircle, Navigation, Phone, Send } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { BRAND, PHOTOS } from '../../lib/brand';
import { FeedbackForm } from './FeedbackForm';
import { getServerI18n } from '../../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return { title: t('pg.contacts.title'), description: `${BRAND.full}: ${t('contact.address')}` };
}

const { lat: LAT, lon: LON } = BRAND.geo;

const CHANNELS = [
  { Icon: Phone, label: 'pg.contacts.phone', value: BRAND.phone, href: BRAND.phoneHref },
  { Icon: MessageCircle, label: 'WhatsApp', value: BRAND.phone, href: BRAND.whatsapp },
  { Icon: Send, label: 'Telegram', value: BRAND.telegramLabel, href: BRAND.telegram },
  { Icon: Instagram, label: 'Instagram', value: BRAND.instagramLabel, href: BRAND.instagram },
  { Icon: Mail, label: 'Email', value: BRAND.email, href: `mailto:${BRAND.email}` },
];

export default async function ContactsPage() {
  const { t } = await getServerI18n();
  return (
    <>
      <PageHeader eyebrow={t('pg.contacts.title')} title={t('pg.contacts.eyebrow')} photo={PHOTOS.interiorWide}>
        {t('pg.contacts.lead')}
      </PageHeader>

      <div className="mx-auto max-w-screen px-4 sm:px-6 lg:px-10 py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="space-y-10">
            <div className="flex gap-4">
              <MapPin size={22} strokeWidth={1.3} className="shrink-0 text-gold-500" />
              <div>
                <p className="font-serif text-3xl text-text-primary">{t('contact.address')}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={`https://2gis.kg/bishkek/geo/${LON},${LAT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-gold-500 px-5 text-sm font-semibold text-black hover:bg-gold-400"
                  >
                    <Navigation size={15} /> {t('pg.contacts.route')}
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${LAT},${LON}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center whitespace-nowrap rounded-full border hairline px-5 text-sm font-semibold text-text-primary hover:border-gold-500/50"
                  >
                    Google Maps
                  </a>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Clock size={22} strokeWidth={1.3} className="shrink-0 text-gold-500" />
              <ul className="w-full max-w-sm space-y-2">
                {BRAND.hours.map((h, index) => (
                  <li key={h.day} className="flex justify-between gap-6 border-b hairline pb-2">
                    <span>{t(index === 0 ? 'hours.weekdays' : 'hours.sunday')}</span>
                    <span className={index === 0 ? 'text-text-primary' : 'text-text-secondary/60'}>{index === 0 ? h.time : t('hours.closed')}</span>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="grid gap-px overflow-hidden rounded-3xl border hairline bg-line sm:grid-cols-2">
              {CHANNELS.map(({ Icon, label, value, href }) => (
                <li key={label} className="bg-bg-primary">
                  <a
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-5 transition-colors hover:bg-bg-elevated"
                  >
                    <Icon size={20} strokeWidth={1.3} className="shrink-0 text-gold-500" />
                    <span>
                      <span className="block text-xs text-text-secondary/70">{label.startsWith('pg.') ? t(label as 'pg.contacts.phone') : label}</span>
                      <span className="block text-sm text-text-primary">{value}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative min-h-[380px] overflow-hidden rounded-3xl border hairline bg-bg-elevated lg:min-h-full">
            <iframe
              title={`${BRAND.full} — ${t('pg.contacts.map')}`}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${LON - 0.006}%2C${LAT - 0.003}%2C${LON + 0.006}%2C${LAT + 0.003}&layer=mapnik&marker=${LAT}%2C${LON}`}
              className="absolute inset-0 h-full w-full border-0 [filter:invert(0.92)_hue-rotate(180deg)_grayscale(0.5)_contrast(0.9)]"
              loading="lazy"
            />
          </div>
        </div>

        <div className="mt-20 grid gap-10 border-t hairline pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <p className="eyebrow">{t('pg.contacts.feedback')}</p>
            <h2 className="section-title mt-5">{t('pg.contacts.question')}</h2>
            <p className="mt-5 max-w-sm leading-relaxed">
              {t('pg.contacts.writeLead')}{' '}
              <a href="/booking" className="text-gold-400 underline underline-offset-4">
                {t('pg.contacts.formLink')}
              </a>
            </p>
          </div>
          <FeedbackForm />
        </div>
      </div>
    </>
  );
}
