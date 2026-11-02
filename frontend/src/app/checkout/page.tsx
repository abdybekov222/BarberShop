'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, Lock, Store, Truck, Wallet } from 'lucide-react';
import { formatKgs, validatePhone } from '@barbershop/shared';
import { PhoneInput, formatKgPhone } from '../../components/ui/PhoneInput';
import { useAuth } from '../../lib/auth-context';
import { apiGet, apiSend } from '../../lib/api';
import { deliveryPrice } from '../../lib/shop';
import { useI18n } from '../../i18n/I18nProvider';
import { clearCart } from '../../store/cartSlice';
import { selectCartTotal, useAppDispatch, useAppSelector } from '../../store/store';
import { Input } from '../../components/ui/Input';
import { useMounted } from '../../lib/useMounted';

type Delivery = 'pickup' | 'courier';
type Payment = 'cash' | 'card_demo';

/** Тестовая карта демо-режима (как в Stripe test mode). Данные карты на сервер не отправляются. */
const TEST_CARD = '4242424242424242';

function Option({
  checked,
  onChange,
  icon,
  title,
  note,
}: {
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  title: string;
  note: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-4 rounded-sm border p-4 transition-colors ${checked ? 'border-gold-500 bg-gold-500/5' : 'border-line hover:border-line-strong'}`}
    >
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" />
      <span className="text-gold-500">{icon}</span>
      <span>
        <span className="block font-medium text-text-primary">{title}</span>
        <span className="block text-sm">{note}</span>
      </span>
    </label>
  );
}

export default function CheckoutPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.cart.items);
  const subtotal = useAppSelector(selectCartTotal);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [delivery, setDelivery] = useState<Delivery>('pickup');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [payment, setPayment] = useState<Payment>('cash');
  const [card, setCard] = useState({ number: '', exp: '', cvc: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Private route: без входа — на /auth, корзина сохранится в localStorage
  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/checkout');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    user
      .getIdToken()
      .then((tk) => apiGet<{ full_name: string; phone: string | null; email: string | null }>('/api/users/me', tk))
      .then((p) => {
        setName((v) => v || (p.full_name === 'Клиент' ? '' : p.full_name));
        setPhone((v) => v || (p.phone ? formatKgPhone(p.phone) : ''));
        setEmail((v) => v || p.email || '');
      })
      .catch(() => {});
  }, [user]);

  const mounted = useMounted();
  if (!mounted || loading || !user) return <p className="py-24 text-center">{t('common.loading')}</p>;
  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p>{t('cart.empty')}</p>
        <Link href="/shop" className="mt-4 inline-block text-gold-500 underline">
          {t('cart.toShop')}
        </Link>
      </div>
    );
  }

  const shipping = deliveryPrice(subtotal, delivery);
  const total = subtotal + shipping;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const p = validatePhone(phone);
    if (name.trim().length < 2) return setError(t('co.needName'));
    if (!p.ok) return setError(p.error);
    if (delivery === 'courier' && address.trim().length < 5) return setError(t('co.needAddress'));
    if (payment === 'card_demo') {
      if (card.number.replace(/\s/g, '') !== TEST_CARD) return setError(t('co.testCard'));
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.exp)) return setError(t('co.exp'));
      if (!/^\d{3}$/.test(card.cvc)) return setError(t('co.cvc'));
    }

    setBusy(true);
    try {
      const token = await user.getIdToken();
      const order = await apiSend<{ id: string; number: number }>('POST', '/api/orders', token, {
        items: items.map((i) => ({ productId: i.id, qty: i.qty })),
        name: name.trim(),
        phone: p.value,
        email: email.trim() || undefined,
        delivery,
        address: delivery === 'courier' ? address.trim() : undefined,
        comment: comment.trim() || undefined,
        payment,
      });
      if (payment === 'card_demo') {
        await apiSend('POST', `/api/orders/${order.id}/pay-demo`, token, {});
      }
      dispatch(clearCart());
      router.push(`/checkout/success?order=${order.number}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen px-4 pb-24 pt-10 sm:px-6 lg:px-10">
      <h1 className="font-serif text-5xl sm:text-6xl">{t('checkout.title')}</h1>
      <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-10">
          <section>
            <h2 className="font-serif text-2xl uppercase">{t('checkout.contacts')}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input aria-label={t('checkout.name')} placeholder={t('checkout.name')} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              <PhoneInput id="co-phone" value={phone} onChange={setPhone} required />
              <Input aria-label={t('checkout.email')} placeholder={t('checkout.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="sm:col-span-2" />
            </div>
          </section>

          <section>
            <h2 className="font-serif text-2xl uppercase">{t('checkout.delivery')}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Option checked={delivery === 'pickup'} onChange={() => setDelivery('pickup')} icon={<Store size={20} />} title={t('checkout.pickup')} note={t('checkout.pickupNote')} />
              <Option checked={delivery === 'courier'} onChange={() => setDelivery('courier')} icon={<Truck size={20} />} title={t('checkout.courier')} note={t('checkout.courierNote')} />
            </div>
            {delivery === 'courier' && (
              <Input aria-label={t('checkout.address')} placeholder={t('checkout.address')} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-3" />
            )}
            <Input as="textarea" aria-label={t('checkout.comment')} placeholder={t('checkout.comment')} value={comment} onChange={(e) => setComment(e.target.value)} className="mt-3 h-20 resize-none py-3" />
          </section>

          <section>
            <h2 className="font-serif text-2xl uppercase">{t('checkout.payment')}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Option checked={payment === 'cash'} onChange={() => setPayment('cash')} icon={<Wallet size={20} />} title={t('checkout.cash')} note={t('checkout.cashNote')} />
              <Option checked={payment === 'card_demo'} onChange={() => setPayment('card_demo')} icon={<CreditCard size={20} />} title={t('checkout.card')} note={t('checkout.cardNote')} />
            </div>
            {payment === 'card_demo' && (
              <div className="mt-3 rounded-2xl border border-line bg-bg-elevated p-4">
                <p className="mb-3 flex items-center gap-2 text-xs">
                  <Lock size={13} className="text-gold-500" /> {t('co.demoNote')}
                </p>
                <div className="grid gap-3 sm:grid-cols-[1fr_110px_90px]">
                  <Input
                    aria-label={t('co.cardNumber')}
                    placeholder="4242 4242 4242 4242"
                    inputMode="numeric"
                    autoComplete="off"
                    value={card.number}
                    onChange={(e) =>
                      setCard({ ...card, number: e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ') })
                    }
                  />
                  <Input
                    aria-label={t('co.expPh')}
                    placeholder="12/28"
                    inputMode="numeric"
                    autoComplete="off"
                    value={card.exp}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setCard({ ...card, exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d });
                    }}
                  />
                  <Input
                    aria-label="CVC"
                    placeholder="CVC"
                    inputMode="numeric"
                    autoComplete="off"
                    value={card.cvc}
                    onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-sm border border-line bg-bg-elevated p-6 lg:sticky lg:top-24">
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 text-sm">
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-bg-elevated-2">
                  <Image src={i.image_url} alt="" fill sizes="48px" className="object-cover" />
                </span>
                <span className="flex-1">
                  {i.name} <span className="text-text-secondary">× {i.qty}</span>
                </span>
                <span className="text-text-primary">{formatKgs(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
            <div className="flex justify-between">
              <dt>{t('cart.subtotal')}</dt>
              <dd className="text-text-primary">{formatKgs(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t('cart.delivery')}</dt>
              <dd className="text-text-primary">{shipping ? formatKgs(shipping) : t('cart.free')}</dd>
            </div>
          </dl>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="font-serif text-xl uppercase">{t('cart.total')}</span>
            <span className="font-serif text-3xl text-text-primary">{formatKgs(total)}</span>
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-sm border border-error/40 p-3 text-sm text-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-6 flex h-14 w-full items-center justify-center rounded-sm bg-gold-500 font-serif text-lg uppercase tracking-[0.08em] text-black hover:bg-gold-400 disabled:opacity-50"
          >
            {busy ? t('common.loading') : payment === 'card_demo' ? `${t('checkout.submit')} · ${formatKgs(total)}` : t('checkout.submit')}
          </button>
        </aside>
      </form>
    </div>
  );
}
