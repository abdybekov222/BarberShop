import Link from 'next/link';
import { getServerI18n } from '../../../i18n/server';

export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  const { t } = await getServerI18n();
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold-500">
        <svg className="success-check" width="36" height="28" viewBox="0 0 36 28" fill="none" stroke="var(--gold-500)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 14L12 24L34 2" />
        </svg>
      </div>
      <h1 className="mt-8 font-serif text-5xl">{t('checkout.success')}</h1>
      {order && <p className="mt-2 font-serif text-2xl text-gold-500">№{order}</p>}
      <p className="mt-4">{t('checkout.successText')}</p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href="/account/orders" className="inline-flex h-12 items-center justify-center rounded-sm bg-gold-500 px-8 font-serif uppercase tracking-[0.08em] text-black hover:bg-gold-400">
          {t('checkout.myOrders')}
        </Link>
        <Link href="/shop" className="inline-flex h-12 items-center justify-center rounded-sm border border-line px-8 font-serif uppercase tracking-[0.08em] text-text-primary hover:border-gold-500">
          {t('cart.toShop')}
        </Link>
      </div>
    </div>
  );
}
