'use client';

import Link from 'next/link';
import type { WizardState } from '../BookingWizard';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../lib/auth-context';
import { apiDownload } from '../../../lib/api';
import { useI18n } from '../../../i18n/I18nProvider';

interface Props {
  state: WizardState;
}

function formatDateTime(isoStr: string | null, locale: string) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bishkek',
  });
}

function googleCalendarUrl(state: WizardState, eventTitle: string): string | null {
  if (!state.bookedStart) return null;
  const duration = state.services
    .filter((s) => state.selectedServiceIds.includes(s.id))
    .reduce((a, s) => a + s.duration_min, 0);
  const start = new Date(state.bookedStart);
  const end = new Date(start.getTime() + duration * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: 'BARS Barber Club, Bishkek, Moskovskaya St 123',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function StepSuccess({ state }: Props) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : lang === 'ky' ? 'ky-KG' : 'ru-RU';
  const gcal = googleCalendarUrl(state, t('bk.calendarEvent'));

  const downloadIcs = async () => {
    if (!user || !state.bookingId) return;
    const token = await user.getIdToken();
    await apiDownload(`/api/bookings/${state.bookingId}/ics`, token, 'barbershop.ics').catch(() => {});
  };

  return (
    <div className="text-center py-8">
      <div className="mx-auto w-20 h-20 rounded-full border-2 border-gold-500 flex items-center justify-center mb-6">
        <svg
          className="success-check"
          width="36"
          height="28"
          viewBox="0 0 36 28"
          fill="none"
          stroke="#C9A24B"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 14L12 24L34 2" />
        </svg>
      </div>

      <h2 className="text-2xl font-serif text-text-primary mb-2">{t('bk.successTitle')}</h2>
      {state.bookedStart && (
        <p className="text-text-secondary mb-2 first-letter:uppercase">{formatDateTime(state.bookedStart, locale)}</p>
      )}
      <p className="text-sm text-text-secondary mb-8">
        {t('bk.successText')}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/account/bookings">
          <Button variant="gold" className="w-full">
            {t('bk.myBookings')}
          </Button>
        </Link>
        <Link href="/account/mirror">
          <Button variant="outline" className="w-full">
            {t('bk.tryMirror')}
          </Button>
        </Link>
      </div>

      {state.bookingId && (
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <button
            type="button"
            onClick={downloadIcs}
            className="text-text-secondary hover:text-text-primary underline min-h-[44px]"
          >
            {t('bk.addCal')}
          </button>
          {gcal && (
            <a
              href={gcal}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary underline min-h-[44px] inline-flex items-center"
            >
              {t('bk.gcal')}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
