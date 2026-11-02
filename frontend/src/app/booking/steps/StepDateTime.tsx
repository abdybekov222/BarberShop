'use client';

import { useEffect, useState } from 'react';
import type { WizardState, WizardDispatch, DaySlots } from '../BookingWizard';
import { Button } from '../../../components/ui/Button';
import { useI18n } from '../../../i18n/I18nProvider';

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onBack: () => void;
  onNext: () => void;
}

const LOCALE = { ru: 'ru-RU', ky: 'ky-KG', en: 'en-GB' } as const;

function formatTime(isoStr: string, locale: string) {
  // Сервер возвращает UTC, переводим в Asia/Bishkek (+6)
  const d = new Date(isoStr);
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bishkek',
  });
}

function parseDateStr(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y!, (m! - 1), d!);
}

export function StepDateTime({ state, dispatch, onBack, onNext }: Props) {
  const { slots, selectedSlot, loading } = state;
  const [activeDate, setActiveDate] = useState<string>('');
  const { t, lang } = useI18n();

  // После загрузки слотов — день выбранного слота или первый доступный
  useEffect(() => {
    if (slots.length === 0) return;
    if (slots.some((d) => d.date === activeDate)) return;
    const withSelected = selectedSlot
      ? slots.find((d) => d.slots.some((s) => s.start === selectedSlot))
      : undefined;
    setActiveDate((withSelected ?? slots[0]!).date);
  }, [slots, selectedSlot, activeDate]);

  const activeDaySlots: DaySlots | undefined = slots.find(
    (d) => d.date === activeDate,
  );

  if (loading) {
    return (
      <div className="py-16 text-center text-text-secondary">
        {t('bk.loadingSlots')}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div>
        <p className="text-text-secondary py-10 text-center">
          {t('bk.noSlots')}
        </p>
        <Button variant="outline" onClick={onBack}>
          ← {t('bk.back')}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-serif text-text-primary mb-4">{t('bk.chooseTime')}</h2>

      {/* Горизонтальный календарь */}
      <div className="overflow-x-auto pb-2 mb-6">
        <div className="flex gap-2 w-max">
          {slots.map((d) => {
            const date = parseDateStr(d.date);
            const wd = date.toLocaleDateString(LOCALE[lang], { weekday: 'short' });
            const day = date.getDate();
            const mon = date.toLocaleDateString(LOCALE[lang], { month: 'short' });
            const isActive = d.date === activeDate;
            return (
              <button
                key={d.date}
                onClick={() => setActiveDate(d.date)}
                className={`flex flex-col items-center px-3 py-2 rounded-2xl border min-w-[56px] transition-colors ${
                  isActive
                    ? 'border-gold-500 bg-gold-500/10 text-text-primary'
                    : 'border-line bg-bg-elevated text-text-secondary hover:border-gold-500/30'
                }`}
              >
                <span className="text-xs">{wd}</span>
                <span className="text-base font-semibold">{day}</span>
                <span className="text-xs">{mon}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Сетка слотов */}
      {activeDaySlots ? (
        <div>
          <p className="text-xs text-text-secondary mb-3 uppercase tracking-wide">
            {t('bk.tz')}
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {activeDaySlots.slots.map((slot) => {
              const isSelected = selectedSlot === slot.start;
              return (
                <button
                  key={slot.start}
                  onClick={() => {
                    if (!slot.available) return;
                    dispatch({ type: 'SET_SLOT', payload: slot.start });
                  }}
                  disabled={!slot.available}
                  aria-pressed={isSelected}
                  className={`h-10 rounded-full text-sm transition-colors ${
                    !slot.available
                      ? 'opacity-30 cursor-not-allowed bg-subtle text-text-secondary/50 line-through'
                      : isSelected
                      ? 'bg-gold-500 text-black font-semibold'
                      : 'border border-line text-text-secondary hover:border-gold-500/50 hover:text-text-primary'
                  }`}
                >
                  {formatTime(slot.start, LOCALE[lang])}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex gap-3">
        <Button variant="outline" onClick={onBack}>
          ← {t('bk.back')}
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedSlot}
          className="flex-1"
        >
          {t('bk.next')} →
        </Button>
      </div>
    </div>
  );
}
