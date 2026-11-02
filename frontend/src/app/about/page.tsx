import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BRAND, PHOTOS } from '../../lib/brand';
import { getServerI18n } from '../../i18n/server';
import { ABOUT_COPY } from './copy';

export function generateMetadata(): Metadata {
  const c = ABOUT_COPY[getServerI18n().lang];
  return { title: c.title, description: c.lead };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getMasters(): Promise<{ id: string; slug: string; name: string; photo_url: string | null; experience_years: number | null }[]> {
  try {
    const res = await fetch(`${API}/api/masters`, { next: { revalidate: 3600 } });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

export default async function AboutPage() {
  const masters = await getMasters();
  const { t, lang } = getServerI18n();
  const c = ABOUT_COPY[lang];

  return (
    <>
      <section className="force-dark relative isolate overflow-hidden bg-bg-primary">
        <Image src={PHOTOS.interiorWide} alt="" fill priority sizes="100vw" className="-z-20 object-cover opacity-50" />
        {/* затемнение снизу и слева, чтобы текст читался поверх светлых ламп */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg-primary via-bg-primary/75 to-bg-primary/20 sm:bg-gradient-to-r sm:from-bg-primary sm:via-bg-primary/70 sm:to-transparent" aria-hidden="true" />
        <div className="mx-auto max-w-screen px-4 pb-16 pt-24 sm:px-6 sm:pt-32 lg:px-10">
          <div className="hero-reveal max-w-3xl">
            <h1 className="font-serif text-6xl sm:text-8xl">{c.title}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-primary [text-shadow:0_1px_12px_rgb(0_0_0/0.6)]">
              {c.lead}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-screen gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-10 lg:py-28">
        <div>
          <h2 className="section-title">{c.startTitle}</h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed">
            <p>{c.start[0]}</p>
            <p>{c.start[1]}</p>
          </div>
        </div>
        <ol className="relative space-y-8 border-l border-line pl-8">
          {c.timeline.map((e) => (
            <li key={e.year} className="relative">
              <span className="absolute -left-[37px] top-2 h-3 w-3 rounded-full border-2 border-gold-500 bg-bg-primary" aria-hidden="true" />
              <p className="font-serif text-3xl text-gold-500">{e.year}</p>
              <p className="mt-1 leading-relaxed">{e.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-bg-elevated">
        <div className="mx-auto max-w-screen px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <h2 className="section-title">{c.beliefTitle}</h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {c.principles.map((p, i) => (
              <div key={p.title} className="border-t border-line-strong pt-6">
                <p className="font-serif text-5xl text-gold-500">0{i + 1}</p>
                <h3 className="mt-4 font-serif text-2xl uppercase">{p.title}</h3>
                <p className="mt-3 leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-screen px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <div className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-3xl">
            <Image src={PHOTOS.interior} alt={c.photoAlts[0]} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
          {[PHOTOS.tools, PHOTOS.shave, PHOTOS.beard, PHOTOS.fade].map((src, i) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-3xl">
              <Image src={src} alt={c.photoAlts[i + 1]} fill sizes="25vw" className="object-cover" />
            </div>
          ))}
        </div>
      </section>

      {masters.length > 0 && (
        <section className="mx-auto max-w-screen px-4 pb-20 sm:px-6 lg:px-10 lg:pb-28">
          <div className="flex items-end justify-between border-b border-line pb-5">
            <h2 className="section-title">{c.team}</h2>
            <Link href="/team" className="inline-flex items-center gap-2 text-sm font-medium text-gold-500">
              {c.profiles} <ArrowRight size={15} />
            </Link>
          </div>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {masters.map((m) => (
              <li key={m.id}>
                <Link href={`/team/${m.slug}`} className="group flex items-center gap-4">
                  <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-bg-elevated-2">
                    {m.photo_url && <Image src={m.photo_url} alt={m.name} fill sizes="80px" className="object-cover" />}
                  </span>
                  <span>
                    <span className="block font-serif text-2xl uppercase group-hover:text-gold-500">{m.name}</span>
                    {m.experience_years && <span className="text-sm">{m.experience_years} · {c.exp}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-line">
        <div className="mx-auto flex max-w-screen flex-col gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <div>
            <h2 className="font-serif text-4xl uppercase">{c.visit}</h2>
            <p className="mt-2">{BRAND.address} · {c.hours}</p>
          </div>
          <Link
            href="/booking"
            className="inline-flex h-14 items-center justify-center whitespace-nowrap rounded-full bg-gold-500 px-8 text-base font-semibold text-black hover:bg-gold-400"
          >
            {t('nav.book')}
          </Link>
        </div>
      </section>
    </>
  );
}
