import Image from 'next/image';
import type { ReactNode } from 'react';

/** Шапка внутренней страницы: подпись, заголовок, описание; опционально — фото на фоне. */
export function PageHeader({
  eyebrow,
  title,
  children,
  photo,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  photo?: string;
}) {
  return (
    <section className={`relative isolate overflow-hidden border-b border-line ${photo ? 'force-dark min-h-[320px] bg-bg-primary sm:min-h-[400px]' : ''}`}>
      {photo && (
        <>
          <Image src={photo} alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/70 to-[#0b0b0b]/35" />
        </>
      )}
      <div className={`mx-auto max-w-screen px-4 sm:px-6 lg:px-10 ${photo ? 'pt-24 pb-14 sm:pt-32' : 'pt-14 pb-12 sm:pt-20'}`}>
        <div className="hero-reveal max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-serif text-5xl sm:text-7xl">{title}</h1>
          {children && <div className="mt-5 max-w-xl text-base leading-relaxed sm:text-lg">{children}</div>}
        </div>
      </div>
    </section>
  );
}
