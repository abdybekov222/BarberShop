'use client';

import { useI18n } from '../../i18n/I18nProvider';
import type { TKey } from '../../i18n/dictionaries';

const RANKS = ['chief', 'top', 'senior', 'barber'];

export function RankBadge({ rank }: { rank: string }) {
  const { t } = useI18n();
  const label = RANKS.includes(rank) ? t(`rank.${rank}` as TKey) : rank;
  const isChief = rank === 'chief';
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border bg-bg-primary/70 px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${
        isChief ? 'border-gold-500/60 text-gold-400' : 'border-line-strong text-text-primary/80'
      }`}
    >
      {label}
    </span>
  );
}
