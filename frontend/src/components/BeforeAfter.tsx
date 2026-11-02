'use client';

import { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';

/** Слайдер-«штора» «До / После» (ТЗ §2.4). Управляется мышью, касанием и клавиатурой. */
export function BeforeAfter({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const { t } = useI18n();
  return (
    <div className="relative w-full overflow-hidden rounded-3xl select-none bg-bg-elevated aspect-[3/4]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={t('ba.after')} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={t('ba.before')} className="h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-px bg-gold-500" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-gold-500 bg-bg-primary/80 text-gold-500 text-xs flex items-center justify-center">
          ⇆
        </div>
      </div>
      <span className="absolute left-3 top-3 rounded bg-bg-primary/70 px-2 py-0.5 text-xs text-text-secondary">{t('ba.before')}</span>
      <span className="absolute right-3 top-3 rounded bg-bg-primary/70 px-2 py-0.5 text-xs text-gold-500">{t('ba.after')}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={t('ba.compare')}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
