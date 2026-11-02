'use client';

import { ANY_MASTER, type WizardState, type WizardDispatch } from '../BookingWizard';
import { Scissors } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { RankBadge } from '../../../components/ui/Badge';
import { StarRating } from '../../../components/ui/StarRating';
import { useI18n } from '../../../i18n/I18nProvider';

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onBack: () => void;
  onNext: () => void;
}

export function StepMaster({ state, dispatch, onBack, onNext }: Props) {
  const { masters, selectedMasterId, selectedServiceIds, loading } = state;
  const { t } = useI18n();

  // Показываем только мастеров, выполняющих все выбранные услуги (ТЗ §2.4)
  const eligible = masters.filter((m) =>
    selectedServiceIds.every((id) => m.master_services.some((ms) => ms.service.id === id)),
  );

  return (
    <div>
      <h2 className="text-xl font-serif text-text-primary mb-1">{t('bk.chooseMaster')}</h2>
      <p className="text-text-secondary text-sm mb-6">
        {t('bk.masterLead')}
      </p>

      {loading ? (
        <div className="text-text-secondary py-10 text-center">
          {t('common.loading')}
        </div>
      ) : (
        <ul className="space-y-3">
          {/* Опция «Любой» */}
          <li>
            <button
              onClick={() => dispatch({ type: 'SET_MASTER', payload: ANY_MASTER })}
              aria-pressed={selectedMasterId === ANY_MASTER}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                selectedMasterId === ANY_MASTER
                  ? 'border-gold-500 bg-gold-500/5'
                  : 'border-line bg-bg-elevated hover:border-gold-500/30'
              }`}
            >
              <p className="text-sm font-medium text-text-primary">
                {t('bk.anyMaster')}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {t('bk.anyMasterNote')}
              </p>
            </button>
          </li>

          {eligible.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => dispatch({ type: 'SET_MASTER', payload: m.id })}
                aria-pressed={selectedMasterId === m.id}
                className={`w-full flex items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  selectedMasterId === m.id
                    ? 'border-gold-500 bg-gold-500/5'
                    : 'border-line bg-bg-elevated hover:border-gold-500/30'
                }`}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-bg-elevated-2 shrink-0">
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photo_url}
                      alt={m.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gold-500/60"><Scissors size={20} strokeWidth={1.2} /></div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{m.name}</p>
                  <div className="mt-0.5">
                    <RankBadge rank={m.rank} />
                  </div>
                </div>
                {m.rating && (
                  <div className="shrink-0">
                    <StarRating value={Number(m.rating)} />
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex gap-3">
        <Button variant="outline" onClick={onBack}>
          ← {t('bk.back')}
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedMasterId}
          className="flex-1"
        >
          {t('bk.next')} →
        </Button>
      </div>
    </div>
  );
}
