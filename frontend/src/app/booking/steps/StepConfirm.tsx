'use client';

import { formatKgs } from '@barbershop/shared';
import { ANY_MASTER, type WizardState, type WizardDispatch } from '../BookingWizard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { PhoneInput } from '../../../components/ui/PhoneInput';
import { useI18n } from '../../../i18n/I18nProvider';

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onBack: () => void;
  onConfirm: () => void;
  isAuth: boolean;
}

function formatDateTime(isoStr: string, locale: string) {
  return new Date(isoStr).toLocaleString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bishkek',
  });
}

export function StepConfirm({ state, dispatch, onBack, onConfirm, isAuth }: Props) {
  const {
    services,
    selectedServiceIds,
    masters,
    selectedMasterId,
    selectedSlot,
    comment,
    name,
    phone,
    loading,
    error,
  } = state;
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : lang === 'ky' ? 'ky-KG' : 'ru-RU';

  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const selectedMaster = masters.find((m) => m.id === selectedMasterId);
  const totalPrice = selectedServices.reduce((a, s) => a + s.base_price, 0);
  const totalDuration = selectedServices.reduce((a, s) => a + s.duration_min, 0);
  const hasFrom = selectedServices.some((s) => s.price_is_from);

  return (
    <div>
      <h2 className="text-xl font-serif text-text-primary mb-6">{t('bk.confirmTitle')}</h2>

      {/* Сводка */}
      <div className="rounded-2xl border border-line bg-bg-elevated p-5 space-y-4 mb-6">
        <div>
          <p className="text-xs text-text-secondary/60 uppercase tracking-wide mb-2">{t('bk.services')}</p>
          {selectedServices.map((s) => (
            <div key={s.id} className="flex justify-between gap-4 text-sm py-1">
              <span className="text-text-primary">{s.name}</span>
              <span className="text-text-secondary shrink-0">
                {s.price_is_from ? `${t('bk.from')} ` : ''}
                {formatKgs(s.base_price)}
              </span>
            </div>
          ))}
          <div className="gold-line w-full mt-2 mb-2" />
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-text-primary">{t('bk.total')}</span>
            <span className="text-gold-500">
              {hasFrom ? `${t('bk.from')} ` : ''}
              {formatKgs(totalPrice)} · {totalDuration} {t('bk.min')}
            </span>
          </div>
          <p className="text-xs text-text-secondary/60 mt-1">
            {t('bk.priceNote')}
          </p>
        </div>

        <div>
          <p className="text-xs text-text-secondary/60 uppercase tracking-wide mb-1">{t('bk.master')}</p>
          <p className="text-sm text-text-primary">
            {selectedMasterId === ANY_MASTER ? t('bk.anyMaster') : (selectedMaster?.name ?? '—')}
          </p>
        </div>

        {selectedSlot && (
          <div>
            <p className="text-xs text-text-secondary/60 uppercase tracking-wide mb-1">
              {t('bk.datetime')}
            </p>
            <p className="text-sm text-text-primary first-letter:uppercase">{formatDateTime(selectedSlot, locale)}</p>
            <p className="text-xs text-text-secondary mt-0.5">{t('bk.tz')}</p>
          </div>
        )}
      </div>

      {/* Контакты */}
      <div className="grid gap-4 mb-4 sm:grid-cols-2">
        <div>
          <label htmlFor="booking-name" className="block text-sm text-text-secondary mb-2">
            {t('bk.name')}
          </label>
          <Input
            id="booking-name"
            autoComplete="name"
            value={name}
            onChange={(e) => dispatch({ type: 'SET_CONTACT', payload: { name: e.target.value } })}
            placeholder={t('bk.name')}
          />
        </div>
        <PhoneInput
          id="booking-phone"
          label={t('bk.phone')}
          required
          value={phone}
          onChange={(v) => dispatch({ type: 'SET_CONTACT', payload: { phone: v } })}
        />
      </div>

      <div className="mb-6">
        <label htmlFor="booking-comment" className="block text-sm text-text-secondary mb-2">
          {t('bk.comment')}
        </label>
        <Input
          id="booking-comment"
          as="textarea"
          placeholder={t('bk.commentPh')}
          value={comment}
          maxLength={1000}
          onChange={(e) => dispatch({ type: 'SET_COMMENT', payload: e.target.value })}
          className="h-20 resize-none py-3"
        />
      </div>

      {!isAuth && (
        <div className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-4 mb-4 text-sm text-text-primary">
          {t('bk.loginToConfirm')}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-error mb-4 rounded-xl border border-error/30 bg-error/5 p-3">
          {error}
        </p>
      )}

      <p className="text-xs text-text-secondary mb-6">
        {t('bk.policy')}
      </p>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={loading}>
          ← {t('bk.back')}
        </Button>
        <Button onClick={onConfirm} disabled={loading} className="flex-1">
          {loading ? t('bk.submitting') : isAuth ? t('bk.confirm') : t('bk.loginConfirm')}
        </Button>
      </div>
    </div>
  );
}
