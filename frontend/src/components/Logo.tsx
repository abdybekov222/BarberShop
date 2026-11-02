/**
 * Логотип BARS Barber Club: монограмма «B» в тонком круге под силуэтом гор Тянь-Шаня
 * (барс — символ Кыргызстана) + словесный знак. Только линии — читается в 16 px и в обеих темах.
 */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="30.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M14 22.5 L21 15.5 L25 19.5 L32 11 L39 19.5 L43 15.5 L50 22.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M25.5 27 H34.2 C37.6 27 39.6 28.9 39.6 31.6 C39.6 33.9 38.1 35.4 35.9 35.8 C38.6 36.2 40.6 38 40.6 40.8 C40.6 44 38.2 46 34.4 46 H25.5 Z M25.5 35.7 H34"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M22.5 27 H28.5 M22.5 46 H28.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={34} className="shrink-0 text-gold-500" />
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[24px] font-semibold uppercase tracking-[0.18em] text-text-primary">Bars</span>
        <span className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.38em] text-gold-500">Barber Club</span>
      </span>
    </span>
  );
}
