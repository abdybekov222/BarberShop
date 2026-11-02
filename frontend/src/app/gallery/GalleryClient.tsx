'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, ScanFace, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import type { TKey } from '../../i18n/dictionaries';
import { Select } from '../../components/ui/Select';

const TAGS: { value: string; label: TKey }[] = [
  { value: '', label: 'pg.gallery.all' },
  { value: 'fade', label: 'pg.tag.fade' },
  { value: 'classic', label: 'pg.tag.classic' },
  { value: 'crop', label: 'pg.tag.crop' },
  { value: 'undercut', label: 'pg.tag.undercut' },
  { value: 'pompadour', label: 'pg.tag.pompadour' },
  { value: 'beard', label: 'pg.tag.beard' },
  { value: 'combo', label: 'pg.tag.combo' },
];

export interface GalleryItem {
  id: string;
  image_url: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  style_tag: string | null;
  master: { id: string; slug: string; name: string } | null;
}

export function GalleryClient({
  initialItems,
  masters,
}: {
  initialItems: GalleryItem[];
  masters: { id: string; slug: string; name: string }[];
}) {
  const router = useRouter();
  const { t: tr } = useI18n();
  const params = useSearchParams();
  const tag = params.get('type') ?? '';
  const masterSlug = params.get('master') ?? '';
  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  const filtered = initialItems.filter(
    (i) => (!tag || i.style_tag === tag) && (!masterSlug || i.master?.slug === masterSlug),
  );
  const current = open !== null ? filtered[open] : null;

  // Состояние фильтра в URL (?type=fade&master=…), без перезагрузки (ТЗ §2.4)
  const setFilter = (key: 'type' | 'master', value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/gallery${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  const step = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + filtered.length) % filtered.length)),
    [filtered.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, step]);

  return (
    <>
      <div className="sticky top-[72px] z-30 border-b hairline bg-bg-primary/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-screen flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:px-10">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {TAGS.map((t) => (
              <button
                key={t.value}
                onClick={() => setFilter('type', t.value)}
                aria-pressed={tag === t.value}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  tag === t.value ? 'bg-gold-500 font-semibold text-black' : 'bg-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                {tr(t.label)}
              </button>
            ))}
          </div>
          {masters.length > 0 && (
            <Select
              value={masterSlug}
              onChange={(v) => setFilter('master', v)}
              label={tr('pg.gallery.allMasters')}
              align="right"
              className="lg:ml-auto"
              options={[{ value: '', label: tr('pg.gallery.allMasters') }, ...masters.map((m) => ({ value: m.slug, label: m.name }))]}
            />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-screen px-4 sm:px-6 lg:px-10 py-10">
        {filtered.length === 0 ? (
          <p className="py-20 text-center">{tr('pg.gallery.empty')}</p>
        ) : (
          <div className="columns-2 gap-2 md:columns-3 lg:columns-4 sm:gap-3">
            {filtered.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setOpen(i)}
                className="card-zoom group relative mb-2 block w-full overflow-hidden rounded-2xl bg-bg-elevated sm:mb-3"
                style={{ aspectRatio: `${item.width ?? 4} / ${item.height ?? 5}` }}
                aria-label={item.caption ?? tr('pg.gallery.title')}
              >
                <Image
                  src={item.image_url}
                  alt={item.caption ?? tr('pg.gallery.title')}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                  className="object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10 text-left opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <span className="block text-sm text-text-primary">{item.caption}</span>
                  {item.master && <span className="block text-[11px] uppercase tracking-[0.12em] text-gold-400">{item.master.name}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={tr('pg.gallery.title')}
          onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0]!.clientX - touchX.current;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs uppercase tracking-[0.14em]">
              {open! + 1} / {filtered.length}
            </span>
            <button onClick={() => setOpen(null)} aria-label={tr('common.close')} className="inline-flex h-11 w-11 items-center justify-center text-text-primary">
              <X size={24} strokeWidth={1.5} />
            </button>
          </div>
          <div className="relative flex-1" onClick={() => setOpen(null)}>
            <Image src={current.image_url} alt={current.caption ?? ''} fill sizes="100vw" className="object-contain" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              aria-label={tr('pg.gallery.prev')}
              className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-black/50 text-text-primary sm:inline-flex"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              aria-label={tr('pg.gallery.next')}
              className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-black/50 text-text-primary sm:inline-flex"
            >
              <ChevronRight size={22} />
            </button>
          </div>
          <div className="flex flex-col gap-4 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              {current.caption && <p className="font-serif text-2xl text-text-primary">{current.caption}</p>}
              {current.master && (
                <Link href={`/team/${current.master.slug}`} className="text-xs uppercase tracking-[0.14em] text-gold-400 hover:text-gold-500">
                  {tr('pg.gallery.master')} {current.master.name}
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={current.master ? `/booking?master=${current.master.slug}` : '/booking'}
                className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-full bg-gold-500 px-6 text-sm font-semibold text-black hover:bg-gold-400"
              >
                {tr('pg.gallery.bookMaster')}
              </Link>
              <Link
                href={current.style_tag ? `/account/mirror?style=${encodeURIComponent(current.style_tag)}` : '/account/mirror'}
                className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line-strong px-6 text-sm font-semibold text-text-primary hover:border-gold-500 hover:text-gold-400"
              >
                <ScanFace size={16} strokeWidth={1.5} /> {tr('pg.gallery.want')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
