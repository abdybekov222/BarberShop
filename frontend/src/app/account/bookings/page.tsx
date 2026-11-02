'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import { apiDownload, apiGet, apiSend } from '../../../lib/api';
import { formatKgs } from '@barbershop/shared';
import { CalendarDays } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ReviewForm } from '../../../components/ReviewForm';
import { useI18n } from '../../../i18n/I18nProvider';
import type { TKey } from '../../../i18n/dictionaries';
import { useDialog } from '../../../components/ui/DialogProvider';

interface Booking {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  total_price: number;
  total_duration_min: number;
  master: { id: string; slug: string; name: string; photo_url: string | null };
  items: { service: { id: string; name: string } }[];
  review: { id: string; rating: number } | null;
}

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-gold-500/15 text-gold-500',
  confirmed: 'bg-success/15 text-success',
  completed: 'bg-subtle text-text-secondary',
  cancelled_by_client: 'bg-error/10 text-error',
  cancelled_by_salon: 'bg-error/10 text-error',
  no_show: 'bg-error/10 text-error',
};

function formatDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bishkek',
  });
}

export default function BookingsPage() {
  const { user, loading } = useAuth();
  const { t, lang } = useI18n();
  const dialog = useDialog();
  const locale = lang === 'en' ? 'en-GB' : lang === 'ky' ? 'ky-KG' : 'ru-RU';
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [scope, setScope] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/account/bookings');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    setBusy(true);
    user
      .getIdToken()
      .then((token) =>
        apiGet<Booking[]>(`/api/bookings/my?scope=${scope}`, token),
      )
      .then(setBookings)
      .catch(() => setBookings([]))
      .finally(() => setBusy(false));
  }, [user, scope, reload]);

  if (loading || !user) return null;

  const isActive = (b: Booking) =>
    ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at) > new Date();

  const cancel = async (id: string) => {
    if (!(await dialog.confirm({ title: t('dlg.bookingCancelTitle'), message: t('acc.cancelAsk'), danger: true }))) return;
    setMessage(null);
    try {
      await apiSend('DELETE', `/api/bookings/${id}`, await user.getIdToken(), {});
      setMessage(t('acc.cancelled'));
      setReload((n) => n + 1);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const downloadIcs = async (id: string) => {
    await apiDownload(`/api/bookings/${id}/ics`, await user.getIdToken(), 'barbershop.ics').catch(
      (e: Error) => setMessage(e.message),
    );
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 font-serif text-4xl text-text-primary sm:text-5xl">{t('acc.bookings')}</h1>

      {/* Табы */}
      <div className="mb-6 inline-flex gap-1 rounded-full bg-subtle p-1">
        {(['upcoming', 'past', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            aria-pressed={scope === s}
            className={`h-9 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${
              scope === s ? 'bg-gold-500 text-black font-semibold' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t(`acc.tab.${s}` as TKey)}
          </button>
        ))}
      </div>

      {message && (
        <p role="status" className="mb-4 rounded-2xl border border-line bg-bg-elevated p-3 text-sm text-text-secondary">
          {message}
        </p>
      )}

      {busy ? (
        <p className="text-text-secondary text-center py-10">{t('common.loading')}</p>
      ) : bookings.length === 0 ? (
        <div className="rounded-3xl border border-line bg-bg-elevated p-10 text-center">
          <CalendarDays size={36} strokeWidth={1.1} className="mx-auto mb-4 text-gold-500" />
          <p className="text-text-secondary mb-6">
            {scope === 'upcoming' ? t('acc.noUpcoming') : t('acc.noBookings')}
          </p>
          <Link href="/booking">
            <Button variant="gold">{t('acc.book')}</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const st = { text: t(`acc.st.${b.status}` as TKey), cls: STATUS_CLS[b.status] ?? 'bg-subtle text-text-secondary' };
            return (
              <li
                key={b.id}
                className="rounded-3xl border border-line bg-bg-elevated p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {b.master.name}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {b.items.map((i) => i.service.name).join(', ')}
                    </p>
                    <p className="text-xs text-text-secondary mt-1 first-letter:uppercase">
                      {formatDateTime(b.starts_at, locale)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gold-500">
                      {formatKgs(b.total_price)}
                    </p>
                    <p className={`mt-2 inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>{st.text}</p>
                  </div>
                </div>
                {b.status === 'completed' &&
                  (b.review ? (
                    <p className="mt-2 text-xs text-gold-500" aria-label={`${b.review.rating}/5`}>
                      {'★'.repeat(b.review.rating)}
                      <span className="text-text-secondary"> — {t('acc.thanksReview')}</span>
                    </p>
                  ) : (
                    <ReviewForm
                      onSubmit={async (rating, text) => {
                        await apiSend('POST', `/api/bookings/${b.id}/review`, await user.getIdToken(), {
                          rating,
                          text: text || undefined,
                        });
                        setMessage(t('acc.reviewSent'));
                        setReload((n) => n + 1);
                      }}
                    />
                  ))}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  {isActive(b) && (
                    <>
                      <button
                        type="button"
                        onClick={() => cancel(b.id)}
                        className="min-h-[44px] text-error/90 hover:text-error"
                      >
                        {t('acc.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadIcs(b.id)}
                        className="min-h-[44px] text-text-secondary hover:text-text-primary"
                      >
                        {t('bk.addCal')}
                      </button>
                    </>
                  )}
                  <Link
                    href={`/booking?master=${b.master.slug}`}
                    className="min-h-[44px] inline-flex items-center text-gold-500 hover:text-gold-400"
                  >
                    {isActive(b) ? t('acc.reschedule') : t('acc.repeat')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      
    </div>
  );
}
