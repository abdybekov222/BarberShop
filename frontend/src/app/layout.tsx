import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Golos_Text, Oswald } from 'next/font/google';
import { AuthProvider } from '../lib/auth-context';
import { BRAND } from '../lib/brand';
import { Header } from '../components/Header';
import { Preloader } from '../components/Preloader';
import { Footer } from '../components/Footer';
import { BookingCta } from '../components/BookingCta';
import { THEME_INIT_SCRIPT } from '../components/ThemeToggle';
import { StoreProvider } from '../store/StoreProvider';
import { I18nProvider } from '../i18n/I18nProvider';
import { getServerI18n } from '../i18n/server';

// Шрифты self-hosted через next/font, subset кириллица + латиница, display: swap (ТЗ §2.1)
const display = Oswald({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-display',
});
const sans = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

const META = {
  ru: {
    title: `${BRAND.full} — мужские стрижки и бритьё в Бишкеке`,
    description: 'Барбер-клуб в центре Бишкека: мужские стрижки, королевское бритьё, оформление бороды. Онлайн-запись за минуту и ИИ-примерка причёски до визита.',
    locale: 'ru_RU',
  },
  ky: {
    title: `${BRAND.full} — Бишкектеги эркектер барбершопу`,
    description: 'Бишкектин борборундагы барбер-клуб: чач тарач, кырынуу, сакал жасалгалоо. Бир мүнөттө онлайн жазылуу жана ИИ менен чачты сынап көрүү.',
    locale: 'ky_KG',
  },
  en: {
    title: `${BRAND.full} — men’s haircuts and shaves in Bishkek`,
    description: 'Barber club in central Bishkek: haircuts, royal shaves and beard grooming. Book online in a minute and try a haircut with AI before your visit.',
    locale: 'en_US',
  },
} as const;

export function generateMetadata(): Metadata {
  const m = META[getServerI18n().lang];
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bars.kg'),
    title: { default: m.title, template: `%s — ${BRAND.full}` },
    description: m.description,
    manifest: '/manifest.json',
    icons: { icon: '/icon.svg' },
    openGraph: { type: 'website', locale: m.locale, siteName: BRAND.full, title: m.title, description: m.description },
    twitter: { card: 'summary_large_image', title: m.title, description: m.description },
  };
}

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const { lang } = getServerI18n();
  return (
    <html lang={lang} className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-[100dvh] flex-col text-[15px]">
        <I18nProvider initial={lang}>
        <StoreProvider>
        <AuthProvider>
          <Preloader />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <BookingCta />
        </AuthProvider>
        </StoreProvider>
        </I18nProvider>
        {/* Schema.org — HairSalon (ТЗ §2.5 SEO) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'HairSalon',
              name: BRAND.full,
              description: META[lang].description,
              address: {
                '@type': 'PostalAddress',
                addressLocality: 'Бишкек',
                addressCountry: 'KG',
                streetAddress: BRAND.addressShort,
              },
              geo: { '@type': 'GeoCoordinates', latitude: BRAND.geo.lat, longitude: BRAND.geo.lon },
              telephone: BRAND.phoneHref.replace('tel:', ''),
              priceRange: '900–3200 KGS',
              currenciesAccepted: 'KGS',
              openingHoursSpecification: [
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                  opens: '10:00',
                  closes: '20:00',
                },
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
