'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from './Logo';

/**
 * Прелоадер (ТЗ §2.2): золотая линия прорисовывает логотип, затем шторка уходит вверх.
 * Только 1 раз за сессию, не дольше ~1.8 с, не блокирует SEO-контент (страница уже в DOM),
 * при prefers-reduced-motion не показывается.
 */
export function Preloader() {
  const [phase, setPhase] = useState<'hidden' | 'draw' | 'lift'>('hidden');

  useEffect(() => {
    try {
      if (sessionStorage.getItem('preloader-shown')) return;
      sessionStorage.setItem('preloader-shown', '1');
    } catch {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setPhase('draw');
    const t1 = setTimeout(() => setPhase('lift'), 1100);
    const t2 = setTimeout(() => setPhase('hidden'), 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === 'hidden') return null;
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-bg-primary transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        phase === 'lift' ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="flex flex-col items-center gap-5 text-gold-500">
        <LogoMark size={96} className="preloader-logo" />
        <span className="font-serif text-2xl tracking-[0.4em] text-text-primary">BARS</span>
      </div>
    </div>
  );
}
