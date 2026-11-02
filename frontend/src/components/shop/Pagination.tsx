import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Пагинация каталога: ссылки сохраняют текущие фильтры. */
export function Pagination({
  page,
  pages,
  params,
  labels,
}: {
  page: number;
  pages: number;
  params: Record<string, string | undefined>;
  labels: { prev: string; next: string; page: string };
}) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') q.set(k, v);
    if (p > 1) q.set('page', String(p));
    return `/shop${q.size ? `?${q}` : ''}`;
  };
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  const cell = 'inline-flex h-11 min-w-[44px] items-center justify-center rounded-sm border px-3 text-sm transition-colors';

  return (
    <nav className="mt-14 flex items-center justify-center gap-2" aria-label={labels.page}>
      {page > 1 ? (
        <Link href={href(page - 1)} className={`${cell} border-line hover:border-gold-500`} aria-label={labels.prev}>
          <ChevronLeft size={16} />
        </Link>
      ) : (
        <span className={`${cell} border-line opacity-30`} aria-hidden="true">
          <ChevronLeft size={16} />
        </span>
      )}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - nums[i - 1]! > 1 && <span className="text-text-secondary">…</span>}
          <Link
            href={href(n)}
            aria-current={n === page ? 'page' : undefined}
            className={`${cell} ${n === page ? 'border-gold-500 bg-gold-500 font-semibold text-black' : 'border-line hover:border-gold-500'}`}
          >
            {n}
          </Link>
        </span>
      ))}
      {page < pages ? (
        <Link href={href(page + 1)} className={`${cell} border-line hover:border-gold-500`} aria-label={labels.next}>
          <ChevronRight size={16} />
        </Link>
      ) : (
        <span className={`${cell} border-line opacity-30`} aria-hidden="true">
          <ChevronRight size={16} />
        </span>
      )}
    </nav>
  );
}
