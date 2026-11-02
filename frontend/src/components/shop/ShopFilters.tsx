'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { CATEGORIES, CATEGORY_KEY, SORTS } from '../../lib/shop';
import { useI18n } from '../../i18n/I18nProvider';
import type { TKey } from '../../i18n/dictionaries';
import { Select } from '../ui/Select';

/** Поиск по имени, фильтр по категории/цене/наличию и сортировка. Состояние — в URL. */
export function ShopFilters() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [minPrice, setMin] = useState(params.get('minPrice') ?? '');
  const [maxPrice, setMax] = useState(params.get('maxPrice') ?? '');

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  // Поиск — с задержкой 400 мс после ввода (debounce)
  useEffect(() => {
    if (q === (params.get('q') ?? '')) return;
    const id = setTimeout(() => update({ q: q.trim() }), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const category = params.get('category') ?? '';
  const hasFilters = Boolean(params.get('q') || category || params.get('minPrice') || params.get('maxPrice') || params.get('inStock'));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('shop.search')}
            aria-label={t('shop.search')}
            className="h-12 w-full rounded-sm border border-line bg-bg-elevated pl-11 pr-10 text-base text-text-primary outline-none transition-colors placeholder:text-text-secondary/60 focus:border-gold-500"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label={t('common.close')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
              <X size={16} />
            </button>
          )}
        </label>
        <div className="flex gap-3">
          <input
            inputMode="numeric"
            value={minPrice}
            onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))}
            onBlur={() => update({ minPrice })}
            placeholder={t('shop.priceFrom')}
            aria-label={t('shop.priceFrom')}
            className="h-12 w-full rounded-sm border border-line bg-bg-elevated px-3 text-base text-text-primary outline-none focus:border-gold-500 lg:w-32"
          />
          <input
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))}
            onBlur={() => update({ maxPrice })}
            placeholder={t('shop.priceTo')}
            aria-label={t('shop.priceTo')}
            className="h-12 w-full rounded-sm border border-line bg-bg-elevated px-3 text-base text-text-primary outline-none focus:border-gold-500 lg:w-32"
          />
          <Select
            value={params.get('sort') ?? 'popular'}
            onChange={(v) => update({ sort: v === 'popular' ? '' : v })}
            label={t('shop.sort')}
            align="right"
            options={SORTS.map((s) => ({ value: s as string, label: t(`shop.sort.${s}` as TKey) }))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {['', ...CATEGORIES].map((c) => (
            <button
              key={c || 'all'}
              type="button"
              onClick={() => update({ category: c })}
              aria-pressed={category === c}
              className={`shrink-0 rounded-sm px-4 py-2.5 font-serif text-sm uppercase tracking-[0.06em] transition-colors ${
                category === c ? 'bg-gold-500 text-black' : 'border border-line text-text-secondary hover:text-text-primary'
              }`}
            >
              {c ? t(CATEGORY_KEY[c as keyof typeof CATEGORY_KEY]) : t('shop.all')}
            </button>
          ))}
        </div>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={params.get('inStock') === '1'}
            onChange={(e) => update({ inStock: e.target.checked ? '1' : '' })}
            className="h-4 w-4 accent-[var(--gold-500)]"
          />
          {t('shop.inStock')}
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setMin('');
              setMax('');
              router.replace(pathname, { scroll: false });
            }}
            className="text-sm text-gold-500 underline underline-offset-4"
          >
            {t('shop.reset')}
          </button>
        )}
      </div>
    </div>
  );
}
