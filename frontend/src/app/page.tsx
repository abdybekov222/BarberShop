import Image from 'next/image';
import Link from 'next/link';
import { formatKgs } from '@barbershop/shared';
import { ArrowRight, CalendarCheck, ScanFace, Scissors, ShoppingBag, Star } from 'lucide-react';
import { AiMaintenanceBanner } from '../components/AiMaintenanceBanner';
import { RankBadge } from '../components/ui/Badge';
import { ProductCard } from '../components/shop/ProductCard';
import { BRAND, PHOTOS } from '../lib/brand';
import type { ProductPage } from '../lib/shop';
import { getServerI18n } from '../i18n/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Service {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  price_is_from: boolean;
  duration_min: number;
  is_combo: boolean;
  category: { slug: string };
}

interface Master {
  id: string;
  slug: string;
  name: string;
  rank: string;
  photo_url: string | null;
  rating: string | null;
  specialties: string[];
}

interface Review {
  id: string;
  rating: number;
  text: string;
  author: string;
  master: { name: string };
}

const FAQ_COPY = {
  ru: {
    title: 'Перед записью',
    items: [
      ['Как записаться онлайн?', 'Выберите услугу, мастера и свободное время. Оставьте контакты — запрос появится в личном кабинете.'],
      ['Когда запись подтверждена?', 'После отправки запроса администратор подтвердит время по телефону или в мессенджере. Статус можно посмотреть в разделе «Мои записи».'],
      ['Можно ли отменить запись?', 'Отменить её через сайт можно не позднее чем за 3 часа до визита. Если времени осталось меньше, свяжитесь с нами напрямую.'],
      ['Что показывает ИИ-примерка?', 'Она помогает заранее обсудить образ с мастером. Результат — визуализация, поэтому готовая стрижка может отличаться от изображения.'],
    ],
  },
  ky: {
    title: 'Жазылардан мурун',
    items: [
      ['Онлайн кантип жазылам?', 'Кызматты, чеберди жана бош убакытты тандаңыз. Байланыш маалыматыңызды калтырсаңыз, өтүнүч жеке кабинетиңизде көрүнөт.'],
      ['Жазылуу качан ырасталат?', 'Өтүнүч жөнөтүлгөндөн кийин администратор убакытты телефон же мессенжер аркылуу ырастайт. Абалды «Жазылууларым» бөлүмүнөн көрө аласыз.'],
      ['Жазылууну жокко чыгарса болобу?', 'Сайт аркылуу визитке 3 сааттан кечиктирбей жокко чыгарсаңыз болот. Убакыт аз калса, биз менен түз байланышыңыз.'],
      ['ЖИ-сынамык эмнени көрсөтөт?', 'Ал чач жасалгасын чебер менен алдын ала талкуулоого жардам берет. Бул визуализация, ошондуктан даяр чач сүрөттөн айырмаланышы мүмкүн.'],
    ],
  },
  en: {
    title: 'Before you book',
    items: [
      ['How do I book online?', 'Choose a service, barber, and available time, then leave your contact details. Your request will appear in your account.'],
      ['When is my booking confirmed?', 'After you send a request, an administrator confirms the time by phone or messenger. You can check its status under “My bookings”.'],
      ['Can I cancel a booking?', 'You can cancel on the site up to 3 hours before your visit. If less time remains, contact us directly.'],
      ['What does the AI try-on show?', 'It helps you discuss a style with your barber ahead of time. It is a visualization, so the finished cut may look different.'],
    ],
  },
} as const;

async function getJson<T>(path: string, fallback: T, revalidate = 300): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate } });
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Популярное: первая услуга каждой категории + вторая стрижка. */
function pickTop(all: Service[]): Service[] {
  const seen = new Map<string, number>();
  return all
    .filter((s) => {
      const n = seen.get(s.category.slug) ?? 0;
      seen.set(s.category.slug, n + 1);
      return n === 0 || (s.category.slug === 'strizhki' && n === 1);
    })
    .slice(0, 6);
}

function SectionHead({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="flex items-end justify-between gap-6 border-b border-line pb-5">
      <h2 className="section-title">{title}</h2>
      {href && link && (
        <Link href={href} className="hidden shrink-0 items-center gap-2 text-sm font-medium text-gold-500 hover:text-gold-400 sm:inline-flex">
          {link} <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const { t, lang } = await getServerI18n();
  const [masters, services, config, gallery, reviews, products] = await Promise.all([
    getJson<Master[]>('/api/masters', [], 3600),
    getJson<Service[]>('/api/services', [], 3600),
    getJson<{ ai_enabled: boolean }>('/api/config', { ai_enabled: true }, 60),
    getJson<{ items: { id: string; image_url: string; caption: string | null }[] }>('/api/gallery?take=6', { items: [] }),
    getJson<Review[]>('/api/reviews?take=3', []),
    getJson<ProductPage | null>('/api/products?limit=4', null, 60),
  ]);
  const top = pickTop(services);
  const faq = FAQ_COPY[lang];
  const rating = masters.length ? (masters.reduce((a, m) => a + Number(m.rating ?? 0), 0) / masters.length).toFixed(1) : null;

  const why = [
    { Icon: Scissors, t: t('home.why.1.t'), d: t('home.why.1.d') },
    { Icon: CalendarCheck, t: t('home.why.2.t'), d: t('home.why.2.d') },
    { Icon: ScanFace, t: t('home.why.3.t'), d: t('home.why.3.d') },
    { Icon: ShoppingBag, t: t('home.why.4.t'), d: t('home.why.4.d') },
  ];

  return (
    <>
      {/* HERO — всегда тёмный: текст поверх фото */}
      <section className="force-dark relative isolate flex min-h-[100svh] items-end overflow-hidden bg-bg-primary">
        <Image
          src={PHOTOS.hero}
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-zoom -z-10 object-cover object-[65%_center]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/60 to-[#0b0b0b]/30" />

        <div className="mx-auto w-full max-w-screen px-4 pb-28 pt-36 sm:px-6 sm:pb-20 lg:px-10">
          <div className="hero-reveal max-w-3xl">
            <p className="text-sm font-medium text-gold-500">{t('home.hero.kicker')}</p>
            <h1 className="mt-4 font-serif text-[clamp(40px,9vw,112px)] leading-[0.95]">
              {t('home.hero.title1')}
              <br />
              <span className="text-gold-500">{t('home.hero.title2')}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-text-primary/85 sm:text-lg">{t('home.hero.text')}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/booking"
                className="inline-flex h-14 items-center justify-center gap-3 rounded-sm bg-gold-500 px-8 font-serif text-lg uppercase tracking-[0.06em] text-black hover:bg-gold-400"
              >
                {t('home.hero.book')} <ArrowRight size={18} />
              </Link>
              {config.ai_enabled && (
                <Link
                  href="/account/mirror"
                  className="inline-flex h-14 items-center justify-center gap-3 rounded-sm border border-line-strong px-8 font-serif text-lg uppercase tracking-[0.06em] text-text-primary hover:border-gold-500 hover:text-gold-500"
                >
                  <ScanFace size={19} strokeWidth={1.5} /> {t('home.hero.mirror')}
                </Link>
              )}
            </div>
          </div>
          <dl className="mt-14 flex flex-wrap gap-x-12 gap-y-4 border-t border-line pt-6 text-sm">
            {rating && (
              <div className="flex items-center gap-2">
                <dt className="text-text-secondary">{t('home.stats.rating')}</dt>
                <dd className="flex items-center gap-1 font-serif text-2xl text-text-primary">
                  {rating} <Star size={14} className="fill-gold-500 text-gold-500" />
                </dd>
              </div>
            )}
            <div className="flex items-center gap-2">
              <dt className="text-text-secondary">{t('home.stats.masters')}</dt>
              <dd className="font-serif text-2xl text-text-primary">{masters.length || 3}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-text-secondary">{t('home.stats.hours')}</dt>
              <dd className="font-serif text-2xl text-text-primary">10–20</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ПОЧЕМУ МЫ */}
      <section className="mx-auto max-w-screen px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionHead title={t('home.why.title')} />
        <div className="mt-10 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {why.map(({ Icon, t: title, d }) => (
            <div key={title}>
              <Icon size={30} strokeWidth={1.3} className="text-gold-500" />
              <h3 className="mt-5 font-serif text-2xl uppercase">{title}</h3>
              <p className="mt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ЦЕНЫ */}
      {top.length > 0 && (
        <section className="border-y border-line bg-bg-elevated">
          <div className="mx-auto grid max-w-screen gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[5fr_7fr] lg:gap-20 lg:px-10 lg:py-28">
            <div className="relative hidden aspect-[4/5] overflow-hidden rounded-sm lg:block">
              <Image src={PHOTOS.interior} alt={t('home.interiorAlt')} fill sizes="40vw" className="object-cover" />
            </div>
            <div>
              <SectionHead title={t('home.prices.title')} href="/services" link={t('home.prices.all')} />
              <ul className="divide-y divide-line">
                {top.map((s) => (
                  <li key={s.id}>
                    <Link href={`/booking?service=${s.id}`} className="group flex items-baseline gap-4 py-5">
                      <span className="min-w-0 flex-1">
                        <span className="block font-serif text-2xl uppercase text-text-primary group-hover:text-gold-500">{s.name}</span>
                        <span className="mt-1 block text-sm">
                          {s.duration_min} {t('common.min')}
                          {s.is_combo && <span className="ml-2 text-gold-500">· {t('home.comboSave')}</span>}
                        </span>
                      </span>
                      <span className="shrink-0 font-serif text-2xl text-text-primary">
                        {s.price_is_from ? `${t('bk.from')} ` : ''}
                        {formatKgs(s.base_price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/services" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-gold-500 sm:hidden">
                {t('home.prices.all')} <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* МАСТЕРА */}
      {masters.length > 0 && (
        <section className="mx-auto max-w-screen px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <SectionHead title={t('home.masters.title')} href="/team" link={t('home.masters.all')} />
          <div className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {masters.map((m) => (
              <Link key={m.id} href={`/team/${m.slug}`} className="group relative w-[80%] shrink-0 snap-start sm:w-auto">
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-bg-elevated-2">
                  {m.photo_url && (
                    <Image
                      src={m.photo_url}
                      alt={m.name}
                      fill
                      sizes="(min-width: 640px) 33vw, 80vw"
                      className="object-cover grayscale transition duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
                    />
                  )}
                </div>
                <div className="mt-4">
                  <RankBadge rank={m.rank} />
                  <h3 className="mt-2 font-serif text-3xl uppercase">{m.name}</h3>
                  <p className="mt-1 text-sm">{m.specialties.slice(0, 3).join(' · ')}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* МАГАЗИН */}
      {products && products.items.length > 0 && (
        <section className="mx-auto max-w-screen px-4 pb-20 sm:px-6 lg:px-10 lg:pb-28">
          <SectionHead title={t('home.shop.title')} href="/shop" link={t('home.shop.all')} />
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {products.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ИИ-ЗЕРКАЛО */}
      <section className="mx-auto max-w-screen px-4 pb-20 sm:px-6 lg:px-10 lg:pb-28">
        {!config.ai_enabled ? (
          <AiMaintenanceBanner />
        ) : (
          <div className="force-dark relative isolate overflow-hidden rounded-sm bg-bg-primary">
            <Image src={PHOTOS.fade} alt="" fill sizes="100vw" className="-z-10 object-cover opacity-40" />
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:p-16">
              <div>
                <h2 className="section-title">{t('home.mirror.title')}</h2>
                <p className="mt-5 max-w-lg leading-relaxed text-text-primary/85">{t('home.mirror.text')}</p>
              </div>
              <div className="lg:pt-2">
                <ol className="space-y-5">
                  {[t('home.mirror.step1'), t('home.mirror.step2'), t('home.mirror.step3')].map((s, i) => (
                    <li key={s} className="flex items-center gap-4 text-lg text-text-primary">
                      <span className="font-serif text-4xl text-gold-500">0{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <Link
                  href="/account/mirror"
                  className="mt-9 inline-flex h-14 items-center gap-3 rounded-sm bg-gold-500 px-8 font-serif text-lg uppercase tracking-[0.06em] text-black hover:bg-gold-400"
                >
                  {t('home.mirror.cta')} <ArrowRight size={18} />
                </Link>
                <p className="mt-3 text-sm text-text-secondary">{t('home.mirror.note')}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* РАБОТЫ */}
      {gallery.items.length > 0 && (
        <section className="mx-auto max-w-screen px-4 pb-20 sm:px-6 lg:px-10 lg:pb-28">
          <SectionHead title={t('home.works.title')} href="/gallery" link={t('home.works.all')} />
          <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {gallery.items.map((g) => (
              <Link key={g.id} href="/gallery" className="group relative aspect-square overflow-hidden rounded-sm bg-bg-elevated-2">
                <Image src={g.image_url} alt={g.caption ?? t('pg.gallery.title')} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover transition duration-700 group-hover:scale-[1.04]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ОТЗЫВЫ — только настоящие, из завершённых визитов */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-screen px-4 pb-20 sm:px-6 lg:px-10 lg:pb-28">
          <SectionHead title={t('home.reviews.title')} />
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {reviews.map((r) => (
              <figure key={r.id}>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={14} className={n <= r.rating ? 'fill-gold-500 text-gold-500' : 'text-faint'} />
                  ))}
                </div>
                <blockquote className="mt-3 text-lg leading-relaxed text-text-primary">«{r.text}»</blockquote>
                <figcaption className="mt-3 text-sm">
                  {r.author} · {t('home.masterOf')} {r.master.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="border-y border-line bg-bg-elevated">
        <div className="mx-auto max-w-screen px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
          <SectionHead title={faq.title} href="/contacts" link={t('nav.contacts')} />
          <div className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {faq.items.map(([question, answer]) => (
              <article key={question} className="border-t border-line-strong pt-5">
                <h3 className="font-serif text-xl text-text-primary">{question}</h3>
                <p className="mt-2 leading-relaxed">{answer}</p>
              </article>
            ))}
          </div>
          <Link href="/booking" className="mt-9 inline-flex items-center gap-2 text-sm font-medium text-gold-500 hover:text-gold-400">
            {t('nav.book')} <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* КОНТАКТЫ */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-screen gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-10">
          <div>
            <h2 className="section-title">{t('home.cta.title')}</h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed">{t('home.cta.text')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/booking"
                className="inline-flex h-14 items-center justify-center rounded-sm bg-gold-500 px-8 font-serif text-lg uppercase tracking-[0.06em] text-black hover:bg-gold-400"
              >
                {t('nav.book')}
              </Link>
              <Link
                href="/contacts"
                className="inline-flex h-14 items-center justify-center rounded-sm border border-line-strong px-8 font-serif text-lg uppercase tracking-[0.06em] text-text-primary hover:border-gold-500"
              >
                {t('home.cta.route')}
              </Link>
            </div>
          </div>
          <dl className="grid content-start gap-6 sm:grid-cols-2 lg:pt-3">
            <div>
              <dt className="text-sm">{t('checkout.phone')}</dt>
              <dd className="mt-1">
                <a href={BRAND.phoneHref} className="font-serif text-3xl text-text-primary hover:text-gold-500">
                  {BRAND.phone}
                </a>
              </dd>
            </div>
            {BRAND.hours.map((h, index) => (
              <div key={h.day}>
                <dt className="text-sm">{t(index === 0 ? 'hours.weekdays' : 'hours.sunday')}</dt>
                <dd className="mt-1 font-serif text-3xl text-text-primary">{index === 0 ? h.time : t('hours.closed')}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
