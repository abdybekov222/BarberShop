'use client';

import type { WizardState, WizardDispatch, Service } from '../BookingWizard';
import { Button } from '../../../components/ui/Button';
import { formatKgs } from '@barbershop/shared';
import { useI18n } from '../../../i18n/I18nProvider';

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onNext: () => void;
}

export function StepServices({ state, dispatch, onNext }: Props) {
  const { services, selectedServiceIds } = state;
  const { t } = useI18n();

  // Группируем услуги по категории
  const grouped = services.reduce<Record<string, { name: string; items: Service[] }>>(
    (acc, s) => {
      const slug = s.category.slug;
      if (!acc[slug]) acc[slug] = { name: s.category.name, items: [] };
      acc[slug]!.items.push(s);
      return acc;
    },
    {},
  );

  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const totalPrice = selectedServices.reduce((acc, s) => acc + s.base_price, 0);
  const totalDuration = selectedServices.reduce((acc, s) => acc + s.duration_min, 0);

  return (
    <div>
      <h2 className="text-xl font-serif text-text-primary mb-4">
        {t('bk.chooseServices')}
      </h2>

      {Object.values(grouped).map((group) => (
        <div key={group.name} className="mb-6">
          <p className="text-xs uppercase tracking-wide text-text-secondary/60 mb-2">
            {group.name}
          </p>
          <ul className="space-y-2">
            {group.items.map((s) => {
              const selected = selectedServiceIds.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    onClick={() =>
                      dispatch({ type: 'TOGGLE_SERVICE', payload: s.id })
                    }
                    aria-pressed={selected}
                    className={`w-full flex items-start justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? 'border-gold-500 bg-gold-500/5'
                        : 'border-line bg-bg-elevated hover:border-gold-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                          selected ? 'border-gold-500 bg-gold-500' : 'border-line-strong'
                        }`}
                        aria-hidden="true"
                      >
                        {selected && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path
                              d="M1 4L3.5 6.5L9 1"
                              stroke="black"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-text-primary">
                          {s.name}
                          {s.is_combo && (
                            <span className="ml-2 text-xs text-gold-500 font-normal">
                              {t('bk.hit')}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-text-secondary mt-0.5">
                          {s.duration_min} {t('bk.min')}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gold-500 shrink-0 ml-4">
                      {s.price_is_from && (
                        <span className="text-xs font-normal text-text-secondary mr-1">
                          {t('bk.from')}
                        </span>
                      )}
                      {formatKgs(s.base_price)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* Итоговая нижняя панель */}
      {selectedServiceIds.length > 0 && (
        <div className="sticky bottom-4 mt-6 rounded-2xl border border-gold-500/30 bg-bg-elevated/95 p-4 shadow-lift backdrop-blur flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="text-text-primary font-medium">
              {formatKgs(totalPrice)}
            </p>
            <p className="text-text-secondary text-xs">{totalDuration} {t('bk.min')}</p>
          </div>
          <Button onClick={onNext} className="shrink-0">
            {t('bk.next')} →
          </Button>
        </div>
      )}
    </div>
  );
}
