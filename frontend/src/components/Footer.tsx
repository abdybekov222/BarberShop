import Link from 'next/link';
import { Instagram, Send, MessageCircle, MapPin, Phone, Clock } from 'lucide-react';
import { BRAND } from '../lib/brand';
import { Logo } from './Logo';
import { getServerI18n } from '../i18n/server';
import type { TKey } from '../i18n/dictionaries';

const NAV: { href: string; key: TKey }[] = [
  { href: '/services', key: 'nav.services' },
  { href: '/team', key: 'nav.masters' },
  { href: '/shop', key: 'nav.shop' },
  { href: '/gallery', key: 'nav.gallery' },
  { href: '/account/mirror', key: 'nav.mirror' },
  { href: '/about', key: 'nav.about' },
  { href: '/contacts', key: 'nav.contacts' },
];

export async function Footer() {
  const { t } = await getServerI18n();
  return (
    <footer className="border-t hairline bg-bg-primary pb-24 sm:pb-0">
      <div className="mx-auto max-w-screen px-4 sm:px-6 lg:px-10 py-16">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <Logo />
            <p className="mt-6 max-w-xs text-sm leading-relaxed">{t('footer.about')}</p>
            <div className="mt-6 flex gap-3">
              {[
                { href: BRAND.instagram, label: 'Instagram', Icon: Instagram },
                { href: BRAND.telegram, label: 'Telegram', Icon: Send },
                { href: BRAND.whatsapp, label: 'WhatsApp', Icon: MessageCircle },
              ].map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border hairline text-text-secondary hover:border-gold-500/50 hover:text-gold-500 transition-colors"
                >
                  <Icon size={17} strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>

          <nav className="md:col-span-3" aria-label={t('footer.sections')}>
            <p className="mb-5 font-serif text-lg uppercase tracking-[0.06em] text-text-primary">{t('footer.sections')}</p>
            <ul className="space-y-3 text-sm">
              {NAV.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-text-primary transition-colors">
                    {t(l.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-5">
            <p className="mb-5 font-serif text-lg uppercase tracking-[0.06em] text-text-primary">{t('footer.contacts')}</p>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3">
                <MapPin size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-gold-500" />
                <span>{t('contact.address')}</span>
              </li>
              <li className="flex gap-3">
                <Phone size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-gold-500" />
                <a href={BRAND.phoneHref} className="text-text-primary hover:text-gold-400">
                  {BRAND.phone}
                </a>
              </li>
              <li className="flex gap-3">
                <Clock size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-gold-500" />
                <span>
                  {BRAND.hours.map((h, index) => (
                    <span key={h.day} className="block">
                      {t(index === 0 ? 'hours.weekdays' : 'hours.sunday')}: <span className="text-text-primary">{index === 0 ? h.time : t('hours.closed')}</span>
                    </span>
                  ))}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t hairline pt-6 text-xs text-text-secondary/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BRAND.full}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/privacy" className="hover:text-text-secondary">
              {t('footer.privacy')}
            </Link>
            <Link href="/terms" className="hover:text-text-secondary">
              {t('footer.terms')}
            </Link>
            <Link href="/ai-consent" className="hover:text-text-secondary">
              {t('footer.consent')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
