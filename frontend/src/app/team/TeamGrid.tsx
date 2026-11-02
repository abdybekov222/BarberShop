'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RankBadge } from '../../components/ui/Badge';
import { StarRating } from '../../components/ui/StarRating';
import { apiGet } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import type { Lang } from '../../i18n/dictionaries';

export interface TeamMaster {
  id: string;
  slug: string;
  name: string;
  rank: string;
  photo_url: string | null;
  experience_years: number | null;
  rating: string | number | null;
  specialties: string[];
}

interface Nearest {
  masterId: string;
  next: string | null;
  today: boolean;
}

/** Сортировка по рангу, затем по алфавиту (ТЗ §2.4). */
const RANK_ORDER: Record<string, number> = { chief: 0, top: 1, senior: 2, barber: 3 };

/** 1 год, 3 года, 12 лет; для ky/en — из словаря */
function pluralYears(n: number, lang: Lang, fallback: string): string {
  if (lang === 'en') return n === 1 ? 'year' : 'years';
  if (lang !== 'ru') return fallback;
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'год';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'года';
  return 'лет';
}

const LOCALE: Record<Lang, string> = { ru: 'ru-RU', ky: 'ky-KG', en: 'en-GB' };

const EMPTY_COPY: Record<Lang, { title: string; text: string; contact: string }> = {
  ru: { title: 'Профили мастеров сейчас недоступны', text: 'Состав команды и расписание обычно публикуются здесь. Пока данные не загрузились, мы поможем подобрать мастера и время напрямую.', contact: 'Связаться с нами' },
  ky: { title: 'Чеберлердин профилдери азыр жеткиликсиз', text: 'Команданын курамы жана графиги адатта бул жерде көрсөтүлөт. Маалымат жүктөлмөйүнчө, чеберди жана убакытты тандоого түз жардам беребиз.', contact: 'Биз менен байланышуу' },
  en: { title: 'Barber profiles are unavailable', text: 'Our team and schedule are normally listed here. While the details are unavailable, contact us and we can help you choose a barber and time.', contact: 'Contact us' },
};

function formatNext(n: Nearest | undefined, lang: Lang, todayAt: string): string | null {
  if (!n?.next) return null;
  const d = new Date(n.next);
  const time = d.toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bishkek' });
  if (n.today) return `${todayAt} ${time}`;
  const day = d.toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Bishkek' });
  return `${day}, ${time}`;
}

export function TeamGrid({ masters }: { masters: TeamMaster[] }) {
  const [nearest, setNearest] = useState<Record<string, Nearest>>({});
  const [loaded, setLoaded] = useState(false);
  const [onlyToday, setOnlyToday] = useState(false);
  const { t, lang } = useI18n();
  const emptyCopy = EMPTY_COPY[lang];

  useEffect(() => {
    apiGet<Nearest[]>('/api/slots/nearest', null)
      .then((rows) => setNearest(Object.fromEntries(rows.map((r) => [r.masterId, r]))))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const list = useMemo(
    () =>
      [...masters]
        .sort((a, b) => (RANK_ORDER[a.rank] ?? 9) - (RANK_ORDER[b.rank] ?? 9) || a.name.localeCompare(b.name, 'ru'))
        .filter((m) => !onlyToday || nearest[m.id]?.today),
    [masters, nearest, onlyToday],
  );

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          aria-pressed={onlyToday}
          disabled={!loaded}
          onClick={() => setOnlyToday((v) => !v)}
          className={`whitespace-nowrap rounded-full px-5 h-11 text-sm font-medium transition-colors disabled:opacity-50 ${
            onlyToday ? 'bg-gold-500 text-black font-semibold' : 'bg-subtle text-text-secondary hover:text-text-primary'
          }`}
        >
          {t('pg.team.today')}
        </button>
        {!loaded && <span className="text-xs text-text-secondary/60">{t('pg.team.checking')}</span>}
      </div>

      {list.length === 0 ? (
        masters.length === 0 ? (
          <section className="rounded-3xl border border-line bg-bg-elevated px-6 py-12 text-center sm:px-12">
            <h2 className="font-serif text-3xl text-text-primary">{emptyCopy.title}</h2>
            <p className="mx-auto mt-3 max-w-xl leading-relaxed">{emptyCopy.text}</p>
            <Link href="/contacts" className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-gold-500 px-6 text-sm font-semibold text-black hover:bg-gold-400">
              {emptyCopy.contact}
            </Link>
          </section>
        ) : (
          <p className="py-10 text-center text-text-secondary">
            {t('pg.team.noToday')} —{' '}
            <Link href="/booking" className="text-gold-500 underline">
              {t('pg.team.otherDay')}
            </Link>
          </p>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((m) => (
            <MasterCard key={m.id} master={m} next={formatNext(nearest[m.id], lang, t('pg.team.todayAt'))} loaded={loaded} />
          ))}
        </div>
      )}
    </>
  );
}

function MasterCard({ master, next, loaded }: { master: TeamMaster; next: string | null; loaded: boolean }) {
  const { t, lang } = useI18n();
  return (
    <article className="group relative overflow-hidden rounded-3xl border hairline bg-bg-elevated transition-colors hover:border-gold-500/40">
      <div className="relative aspect-[3/4] overflow-hidden bg-bg-elevated-2">
        {master.photo_url && (
          <Image
            src={master.photo_url}
            alt={master.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover grayscale transition-[filter,transform] duration-700 group-hover:grayscale-0 group-hover:scale-[1.04] group-focus-within:grayscale-0"
          />
        )}
        <div className="absolute top-3 left-3">
          <RankBadge rank={master.rank} />
        </div>
      </div>
      <div className="p-6">
        <h2 className="font-serif text-3xl text-text-primary">
          <Link href={`/team/${master.slug}`} className="after:absolute after:inset-0">
            {master.name}
          </Link>
        </h2>
        {master.experience_years ? (
          <p className="text-xs text-text-secondary mt-0.5">
            {t('pg.team.exp')} {master.experience_years} {pluralYears(master.experience_years, lang, t('pg.team.years'))}
          </p>
        ) : null}
        {master.rating ? (
          <div className="mt-2">
            <StarRating value={Number(master.rating)} label={t('shop.rating')} />
          </div>
        ) : null}
        {master.specialties?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {master.specialties.slice(0, 3).map((s) => (
              <span key={s} className="whitespace-nowrap rounded-full bg-subtle px-2.5 py-1 text-xs text-text-secondary">
                {s}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-text-secondary">
          {loaded ? (next ? <>{t('pg.team.next')}: <span className="text-text-primary">{next}</span></> : t('pg.team.noSlots')) : ' '}
        </p>
        <Link
          href={`/booking?master=${master.slug}`}
          className="relative z-10 mt-5 inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-gold-500/60 px-6 text-sm font-semibold text-gold-400 transition-colors hover:bg-gold-500 hover:text-black"
        >
          {t('pg.team.book')}
        </Link>
      </div>
    </article>
  );
}
