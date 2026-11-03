import Link from 'next/link';
import { LogoMark } from '../components/Logo';
import { getServerI18n } from '../i18n/server';

export default async function NotFound() {
  const { t } = await getServerI18n();
  return (
    <div className="mx-auto flex min-h-[75dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <LogoMark size={64} className="text-gold-500" />
      <p className="mt-8 font-serif text-8xl text-text-primary">404</p>
      <h1 className="mt-3 font-serif text-3xl">{t('nf.title')}</h1>
      <p className="mt-3">{t('nf.text')}</p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href="/booking" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-full bg-gold-500 px-8 text-sm font-semibold text-black hover:bg-gold-400">
          {t('nav.book')}
        </Link>
        <Link href="/" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-full border hairline px-8 text-sm font-semibold text-text-primary hover:border-gold-500/50">
          {t('err.home')}
        </Link>
      </div>
    </div>
  );
}
