'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatKgs } from '@barbershop/shared';
import { Clock } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  price_is_from: boolean;
  duration_min: number;
  is_combo: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  services: Service[];
}

/**
 * Прайс в стиле «меню ресторана» (ТЗ §2.4): все категории на одной странице,
 * sticky-чипы ведут к якорям, активная категория подсвечивается при прокрутке.
 */
export function ServicesClient({ categories }: { categories: Category[] }) {
  const [active, setActive] = useState(categories[0]?.slug ?? '');
  const { t } = useI18n();

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-140px 0px -60% 0px' },
    );
    categories.forEach((c) => {
      const el = document.getElementById(c.slug);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [categories]);

  return (
    <>
      <nav
        className="sticky top-[72px] z-30 border-b hairline bg-bg-primary/90 backdrop-blur-md"
        aria-label={t('pg.services.cats')}
      >
        <div className="no-scrollbar mx-auto flex max-w-screen gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-10">
          {categories.map((c) => (
            <a
              key={c.slug}
              href={`#${c.slug}`}
              aria-current={active === c.slug ? 'true' : undefined}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active === c.slug
                  ? 'bg-gold-500 text-black font-semibold'
                  : 'bg-subtle text-text-secondary hover:text-text-primary'
              }`}
            >
              {c.name}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-screen px-4 sm:px-6 lg:px-10 pb-24">
        {categories.map((c) => (
          <section key={c.slug} id={c.slug} className="scroll-mt-40 pt-16">
            <h2 className="font-serif text-4xl">{c.name}</h2>
            <ul className="mt-8 divide-y divide-line border-y hairline">
              {c.services.map((s) => (
                <li key={s.id} className="group grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-10">
                  <div>
                    <div className="flex items-baseline">
                      <h3 className="font-serif text-2xl leading-tight">{s.name}</h3>
                      {s.is_combo && (
                        <span className="ml-3 shrink-0 rounded-full border border-gold-500/50 px-2 py-0.5 text-[11px] font-semibold text-gold-500">
                          {t('bk.hit')}
                        </span>
                      )}
                      <span className="price-leader hidden sm:block" aria-hidden="true" />
                      <span className="ml-auto whitespace-nowrap pl-4 font-serif text-2xl text-gold-400 sm:ml-0 sm:pl-0">
                        {s.price_is_from ? `${t('bk.from')} ` : ''}
                        {formatKgs(s.base_price)}
                      </span>
                    </div>
                    {s.description && <p className="mt-2 max-w-2xl text-sm leading-relaxed">{s.description}</p>}
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-secondary/70">
                      <Clock size={13} strokeWidth={1.5} /> {s.duration_min} {t('bk.min')}
                    </p>
                  </div>
                  <Link
                    href={`/booking?service=${s.id}`}
                    className="justify-self-start inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-gold-500/60 px-6 text-sm font-semibold text-gold-400 transition-colors hover:bg-gold-500 hover:text-black"
                  >
                    {t('pg.services.choose')}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
