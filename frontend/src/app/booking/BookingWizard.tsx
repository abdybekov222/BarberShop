'use client';

import { useEffect, useReducer, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { validatePhone } from '@barbershop/shared';
import { useAuth } from '../../lib/auth-context';
import { apiGet, apiSend } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import { formatKgPhone } from '../../components/ui/PhoneInput';
import { StepServices } from './steps/StepServices';
import { StepMaster } from './steps/StepMaster';
import { StepDateTime } from './steps/StepDateTime';
import { StepConfirm } from './steps/StepConfirm';
import { StepSuccess } from './steps/StepSuccess';

// ─── State ──────────────────────────────────────────────────────────────────

export interface Service {
  id: string;
  name: string;
  base_price: number;
  price_is_from: boolean;
  duration_min: number;
  is_combo: boolean;
  category: { id: string; slug: string; name: string };
}

export interface Master {
  id: string;
  slug: string;
  name: string;
  rank: string;
  photo_url: string | null;
  rating: number | null;
  master_services: { service: { id: string; name: string; duration_min: number } }[];
}

export interface DaySlots {
  date: string;
  slots: { start: string; end: string; available: boolean }[];
}

export interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  services: Service[];
  selectedServiceIds: string[];
  masters: Master[];
  selectedMasterId: string | null;
  slots: DaySlots[];
  selectedSlot: string | null; // ISO start
  comment: string;
  name: string;
  phone: string;
  aiGenerationId: string | null;
  bookingId: string | null;
  bookedStart: string | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'SET_STEP'; payload: WizardState['step'] }
  | { type: 'SET_SERVICES'; payload: Service[] }
  | { type: 'TOGGLE_SERVICE'; payload: string }
  | { type: 'SET_MASTERS'; payload: Master[] }
  | { type: 'SET_MASTER'; payload: string }
  | { type: 'SET_SLOTS'; payload: DaySlots[] }
  | { type: 'SET_SLOT'; payload: string }
  | { type: 'SET_COMMENT'; payload: string }
  | { type: 'SET_CONTACT'; payload: { name?: string; phone?: string } }
  | { type: 'RESTORE'; payload: Partial<WizardState> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_BOOKING'; payload: { id: string; start: string } };

export type WizardDispatch = React.Dispatch<Action>;

const init: WizardState = {
  step: 1,
  services: [],
  selectedServiceIds: [],
  masters: [],
  selectedMasterId: null,
  slots: [],
  selectedSlot: null,
  comment: '',
  name: '',
  phone: '',
  aiGenerationId: null,
  bookingId: null,
  bookedStart: null,
  loading: false,
  error: null,
};

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload, error: null };
    case 'SET_SERVICES':
      return { ...state, services: action.payload };
    case 'TOGGLE_SERVICE': {
      const id = action.payload;
      const has = state.selectedServiceIds.includes(id);
      return {
        ...state,
        selectedServiceIds: has
          ? state.selectedServiceIds.filter((s) => s !== id)
          : [...state.selectedServiceIds, id],
        selectedSlot: null,
      };
    }
    case 'SET_MASTERS':
      return { ...state, masters: action.payload };
    case 'SET_MASTER':
      return { ...state, selectedMasterId: action.payload, selectedSlot: null, slots: [] };
    case 'SET_SLOTS':
      return { ...state, slots: action.payload };
    case 'SET_SLOT':
      return { ...state, selectedSlot: action.payload };
    case 'SET_COMMENT':
      return { ...state, comment: action.payload };
    case 'SET_CONTACT':
      return { ...state, ...action.payload };
    case 'RESTORE':
      return { ...state, ...action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_BOOKING':
      return {
        ...state,
        bookingId: action.payload.id,
        bookedStart: action.payload.start,
        step: 5,
      };
    default:
      return state;
  }
}

/** «Любой свободный мастер». */
export const ANY_MASTER = 'any';

/** Ключ sessionStorage: состояние виджета переживает обновление страницы и вход (ТЗ §2.4). */
const STORAGE_KEY = 'booking-wizard-v1';
const PERSISTED = [
  'step',
  'selectedServiceIds',
  'selectedMasterId',
  'selectedSlot',
  'comment',
  'name',
  'phone',
  'aiGenerationId',
] as const;

// ─── Wizard ──────────────────────────────────────────────────────────────────

export function BookingWizard() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preService = searchParams.get('service');
  const preMaster = searchParams.get('master');
  const preAi = searchParams.get('ai');

  const [state, dispatch] = useReducer(reducer, init);
  const [restored, setRestored] = useState(false);

  // Восстановление состояния из sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw && !preService && !preMaster) {
        const saved = JSON.parse(raw) as Partial<WizardState>;
        if (saved.step === 5) saved.step = 1;
        dispatch({ type: 'RESTORE', payload: saved });
      }
    } catch {
      /* приватный режим — работаем без сохранения */
    }
    if (preAi) dispatch({ type: 'RESTORE', payload: { aiGenerationId: preAi } });
    setRestored(true);
  }, [preService, preMaster, preAi]);

  useEffect(() => {
    if (!restored) return;
    try {
      if (state.step === 5) sessionStorage.removeItem(STORAGE_KEY);
      else {
        const toSave = Object.fromEntries(PERSISTED.map((k) => [k, state[k]]));
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      }
    } catch {
      /* ignore */
    }
  }, [state, restored]);

  // Загрузка услуг при монтировании
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Service[]>('/api/services', null);
        dispatch({ type: 'SET_SERVICES', payload: data });
        if (preService && data.some((s) => s.id === preService)) {
          dispatch({ type: 'RESTORE', payload: { selectedServiceIds: [preService] } });
        }
      } catch {
        dispatch({ type: 'SET_ERROR', payload: t('common.error') });
      }
    })();
  }, [preService, t]);

  // Предзаполнение имени и телефона из профиля
  useEffect(() => {
    if (!user || !restored) return;
    user
      .getIdToken()
      .then((t) => apiGet<{ full_name: string; phone: string | null }>('/api/users/me', t))
      .then((p) =>
        dispatch({
          type: 'SET_CONTACT',
          payload: {
            ...(state.name || p.full_name === 'Клиент' ? {} : { name: p.full_name }),
            ...(state.phone || !p.phone ? {} : { phone: formatKgPhone(p.phone) }),
          },
        }),
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, restored]);

  // Загрузка мастеров (нужны на шагах 2–4)
  useEffect(() => {
    if (state.step < 2 || state.masters.length > 0) return;
    const showSpinner = state.step === 2;
    (async () => {
      if (showSpinner) dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const data = await apiGet<Master[]>('/api/masters', null);
        dispatch({ type: 'SET_MASTERS', payload: data });
        if (preMaster) {
          const m = data.find((x: Master) => x.slug === preMaster);
          if (m) dispatch({ type: 'SET_MASTER', payload: m.id });
        }
      } catch {
        dispatch({ type: 'SET_ERROR', payload: t('common.error') });
      } finally {
        if (showSpinner) dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, [state.step, state.masters.length, preMaster, t]);

  // Загрузка слотов на шаге 3
  const loadSlots = useCallback(async (masterId: string, duration: number, serviceIds: string[]) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const data = await apiGet<DaySlots[]>(
        `/api/slots?masterId=${masterId}&duration=${duration}&services=${serviceIds.join(',')}`,
        null,
      );
      dispatch({ type: 'SET_SLOTS', payload: data });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('common.error') });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [t]);

  const totalDuration = state.services
    .filter((s) => state.selectedServiceIds.includes(s.id))
    .reduce((acc, s) => acc + s.duration_min, 0);

  useEffect(() => {
    if (state.step !== 3 || !state.selectedMasterId || totalDuration === 0) return;
    loadSlots(state.selectedMasterId, totalDuration, state.selectedServiceIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.selectedMasterId, totalDuration, loadSlots]);

  // Подтверждение — отправка в API
  const handleConfirm = async () => {
    if (!user) {
      router.push('/auth?next=/booking');
      return;
    }
    if (!state.selectedMasterId || !state.selectedSlot || state.selectedServiceIds.length === 0) return;

    if (state.name.trim().length < 2) {
      dispatch({ type: 'SET_ERROR', payload: t('bk.needName') });
      return;
    }
    const phone = validatePhone(state.phone);
    if (!phone.ok) {
      dispatch({ type: 'SET_ERROR', payload: t('phone.invalid') });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const token = await user.getIdToken();
      const booking = await apiSend<{ id: string; starts_at: string }>('POST', '/api/bookings', token, {
        serviceIds: state.selectedServiceIds,
        masterId: state.selectedMasterId,
        startsAt: state.selectedSlot,
        name: state.name.trim(),
        phone: phone.value,
        comment: state.comment || undefined,
        aiGenerationId: state.aiGenerationId ?? undefined,
      });
      dispatch({ type: 'SET_BOOKING', payload: { id: booking.id, start: booking.starts_at } });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: (e as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // ─── Прогресс-бар ──────────────────────────────────────────────────

  const STEPS = [t('bk.step.service'), t('bk.step.master'), t('bk.step.time'), t('bk.step.confirm')];

  if (authLoading || !restored) {
    return <div className="text-text-secondary text-center py-16">{t('common.loading')}</div>;
  }

  return (
    <div>
      {state.aiGenerationId && state.step <= 4 && (
        <p className="mb-6 rounded-2xl border border-gold-500/30 bg-gold-500/5 px-4 py-2 text-sm text-text-secondary">
          {t('bk.aiAttached')}
        </p>
      )}

      {/* Progress bar (шаги 1–4) */}
      {state.step <= 4 && (
        <div className="mb-8" aria-label={t('bk.stepOf').replace('{step}', String(state.step))}>
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4;
              const active = state.step === n;
              const done = state.step > n;
              return (
                <div key={label} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                      done
                        ? 'bg-gold-500 border-gold-500 text-black'
                        : active
                          ? 'border-gold-500 text-gold-500'
                          : 'border-line text-text-secondary/50'
                    }`}
                    aria-current={active ? 'step' : undefined}
                  >
                    {done ? '✓' : n}
                  </div>
                  <span
                    className={`mt-1.5 whitespace-nowrap text-xs hidden sm:block ${
                      active ? 'text-text-primary' : 'text-text-secondary/50'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-px w-full bg-subtle">
            <div
              className="h-px bg-gold-500 transition-all duration-500"
              style={{ width: `${((state.step - 1) / 3) * 100}%` }}
            />
          </div>
        </div>
      )}

      {state.step === 1 && (
        <StepServices
          state={state}
          dispatch={dispatch}
          onNext={() => dispatch({ type: 'SET_STEP', payload: 2 })}
        />
      )}
      {state.step === 2 && (
        <StepMaster
          state={state}
          dispatch={dispatch}
          onBack={() => dispatch({ type: 'SET_STEP', payload: 1 })}
          onNext={() => dispatch({ type: 'SET_STEP', payload: 3 })}
        />
      )}
      {state.step === 3 && (
        <StepDateTime
          state={state}
          dispatch={dispatch}
          onBack={() => dispatch({ type: 'SET_STEP', payload: 2 })}
          onNext={() => dispatch({ type: 'SET_STEP', payload: 4 })}
        />
      )}
      {state.step === 4 && (
        <StepConfirm
          state={state}
          dispatch={dispatch}
          onBack={() => dispatch({ type: 'SET_STEP', payload: 3 })}
          onConfirm={handleConfirm}
          isAuth={!!user}
        />
      )}
      {state.step === 5 && <StepSuccess state={state} />}
    </div>
  );
}
