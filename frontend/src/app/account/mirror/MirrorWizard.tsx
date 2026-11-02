'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Check, Scissors, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import { ApiError, apiGet, apiSend, type SalonConfig } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { AiMaintenanceBanner } from '../../../components/AiMaintenanceBanner';
import { BeforeAfter } from '../../../components/BeforeAfter';
import { Turnstile, type TurnstileHandle } from '../../../components/Turnstile';
import { useI18n } from '../../../i18n/I18nProvider';
import type { TKey } from '../../../i18n/dictionaries';
import { useDialog } from '../../../components/ui/DialogProvider';

// ─── Типы ──────────────────────────────────────────────────────────────────

interface Style {
  id: string;
  type: 'haircut' | 'beard' | 'combo';
  name: string;
  preview_url: string | null;
  sort_order: number;
}

interface Quota {
  free_limit: number;
  used_count: number;
  bonus_count: number;
  remaining: number;
}

interface Profile {
  consent_ai_at: string | null;
  ai_quota: Quota | null;
}

interface Generation {
  id: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  style: { id: string; name: string; type: string } | null;
  result_url: string | null;
  cache_hit: boolean;
  refunded: boolean;
  error_code: string | null;
  created_at: string;
}

type Step = 'loading' | 'consent' | 'upload' | 'styles' | 'confirm' | 'generating' | 'result' | 'exhausted' | 'off';

const STYLE_TYPE_LABELS = { haircut: 'mr.type.haircut', beard: 'mr.type.beard', combo: 'mr.type.combo' } as const;

/** Понятные клиенту сообщения вместо кодов сервера (без слов «ошибка бюджета», ТЗ §1.5). */
function humanize(e: unknown, t: (k: TKey) => string): string {
  const msg = e instanceof Error ? e.message : String(e);
  switch (msg) {
    case 'AI_BUSY':
      return t('mr.err.busy');
    case 'CAPTCHA_FAILED':
      return t('mr.err.captcha');
    case 'AI_IP_LIMIT':
      return t('mr.err.ip');
    case 'AI_CONSENT_REQUIRED':
      return t('mr.err.consent');
    default:
      return msg;
  }
}

// ─── Wizard ────────────────────────────────────────────────────────────────

export function MirrorWizard() {
  const { user } = useAuth();
  const { t: tr } = useI18n();
  const dialog = useDialog();
  const [demo, setDemo] = useState(false);
  const [step, setStep] = useState<Step>('loading');
  const [quota, setQuota] = useState<Quota | null>(null);
  const [styles, setStyles] = useState<Style[]>([]);
  const [history, setHistory] = useState<Generation[]>([]);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [activeStyleType, setActiveStyleType] = useState<keyof typeof STYLE_TYPE_LABELS>('haircut');
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const captchaRef = useRef<TurnstileHandle>(null);

  const token = useCallback(async () => (user ? user.getIdToken() : null), [user]);

  const refreshProfile = useCallback(async () => {
    const t = await token();
    const p = await apiGet<Profile>('/api/users/me', t);
    if (p.ai_quota) setQuota(p.ai_quota);
    return p;
  }, [token]);

  const refreshHistory = useCallback(async () => {
    const list = await apiGet<Generation[]>('/api/ai/generations', await token()).catch(() => []);
    setHistory(list.filter((g) => g.status === 'succeeded' && g.result_url));
  }, [token]);

  const deleteLook = async (item: Generation) => {
    if (!(await dialog.confirm({ title: tr('dlg.lookDeleteTitle'), message: tr('dlg.lookDeleteMessage'), danger: true, confirmLabel: tr('mr.delete') }))) return;
    setDeletingHistoryId(item.id);
    try {
      await apiSend('DELETE', `/api/ai/generations/${item.id}`, await token());
      setHistory((current) => current.filter((entry) => entry.id !== item.id));
    } catch (e) {
      setError(humanize(e, tr));
    } finally {
      setDeletingHistoryId(null);
    }
  };

  // Начальная загрузка: статус ИИ, профиль (согласие, квота), стили, история
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [config, profile, st] = await Promise.all([
          apiGet<SalonConfig>('/api/config', null),
          refreshProfile(),
          apiGet<Style[]>('/api/ai/styles', null),
        ]);
        setStyles(st);
        // «Хочу такую стрижку» из галереи: ?style=fade → предвыбор подходящего образа
        const wanted = new URLSearchParams(window.location.search).get('style')?.toLowerCase();
        const match = wanted ? st.find((s) => s.name.toLowerCase().includes(wanted)) : undefined;
        if (match) {
          setActiveStyleType(match.type);
          setSelectedStyle(match);
        }
        await refreshHistory();
        setDemo(Boolean((config as SalonConfig & { ai_demo?: boolean }).ai_demo));
        if (!config.ai_enabled) setStep('off');
        else if (profile.ai_quota && profile.ai_quota.remaining <= 0) setStep('exhausted');
        else if (!profile.consent_ai_at) setStep('consent');
        else setStep('upload');
      } catch (e) {
        setError(humanize(e, tr));
        setStep('upload');
      }
    })();
  }, [user, refreshProfile, refreshHistory]);

  // ─── Polling результата (каждые 2 с; переживает сворачивание вкладки) ───
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  const startPolling = useCallback(
    (genId: string) => {
      stopPolling();
      try {
        sessionStorage.setItem('mirror-pending', genId);
      } catch {
        /* ignore */
      }
      pollRef.current = setInterval(async () => {
        try {
          const gen = await apiGet<Generation>(`/api/ai/generations/${genId}`, await token());
          if (gen.status === 'succeeded') {
            stopPolling();
            sessionStorage.removeItem('mirror-pending');
            setGeneration(gen);
            setStep('result');
            await Promise.all([refreshProfile(), refreshHistory()]);
          } else if (gen.status === 'failed' || gen.status === 'refunded') {
            stopPolling();
            sessionStorage.removeItem('mirror-pending');
            await refreshProfile();
            setError(
              gen.error_code === 'GEMINI_QUOTA_EXCEEDED'
                ? tr('mr.err.providerQuota')
                : gen.refunded
                  ? tr('mr.failed')
                  : tr('mr.failedNoRefund'),
            );
            setStep('styles');
          }
        } catch {
          // сетевая ошибка — продолжаем опрос, статус восстановится по jobId
        }
      }, 2000);
    },
    [token, refreshProfile, refreshHistory],
  );

  // Восстановление незавершённой генерации после перезагрузки
  useEffect(() => {
    if (!user) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem('mirror-pending');
    } catch {
      /* ignore */
    }
    if (pending) {
      setStep('generating');
      startPolling(pending);
    }
    return stopPolling;
  }, [user, startPolling]);

  // ─── Согласие ─────────────────────────────────────────────────────

  const giveConsent = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend('POST', '/api/ai/consent', await token(), { consent: true, adult: true });
      setStep('upload');
    } catch (e) {
      setError(humanize(e, tr));
    } finally {
      setBusy(false);
    }
  };

  // ─── Загрузка фото ────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setError(null);

    // Клиентская предпроверка: формат, размер, разрешение (бесплатно)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(tr('mr.err.format'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(tr('mr.err.size'));
      return;
    }
    const localUrl = URL.createObjectURL(file);
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = localUrl;
    });
    if (Math.min(dims.w, dims.h) < 512) {
      URL.revokeObjectURL(localUrl);
      setError(tr('mr.err.res'));
      return;
    }

    setBusy(true);
    setPhotoPreview(localUrl);
    try {
      const form = new FormData();
      form.append('photo', file);
      const captcha = await captchaRef.current?.token();
      const data = await apiSend<{ id: string; preview_url: string }>(
        'POST',
        '/api/ai/photos',
        await token(),
        form,
        captcha ? { 'cf-turnstile-response': captcha } : {},
      );
      setPhotoId(data.id);
      setStep('styles');
    } catch (err) {
      if (err instanceof ApiError && err.message === 'AI_CONSENT_REQUIRED') setStep('consent');
      setError(humanize(err, tr));
      setPhotoPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const deletePhoto = async () => {
    if (!photoId) return;
    await apiSend('DELETE', `/api/ai/photos/${photoId}`, await token()).catch(() => {});
    setPhotoId(null);
    setPhotoPreview(null);
    setSelectedStyle(null);
    setGeneration(null);
    setStep('upload');
    await refreshHistory();
  };

  // ─── Запуск генерации ─────────────────────────────────────────────

  const idemKey = useRef<string | null>(null);
  const handleGenerate = async () => {
    if (!user || !photoId || !selectedStyle) return;
    setError(null);
    setBusy(true);
    // Ключ живёт до ответа сервера: двойной клик не спишет вторую попытку
    idemKey.current ??= crypto.randomUUID();
    try {
      const captcha = await captchaRef.current?.token();
      const gen = await apiSend<Generation>(
        'POST',
        '/api/ai/generations',
        await token(),
        { photoId, styleId: selectedStyle.id },
        {
          'Idempotency-Key': idemKey.current,
          ...(captcha ? { 'cf-turnstile-response': captcha } : {}),
        },
      );
      idemKey.current = null;
      if (gen.status === 'succeeded') {
        setGeneration(gen);
        setStep('result');
        await Promise.all([refreshProfile(), refreshHistory()]);
        return;
      }
      setGeneration(gen);
      setStep('generating');
      startPolling(gen.id);
    } catch (e) {
      idemKey.current = null;
      if (e instanceof ApiError && e.status === 402) setStep('exhausted');
      else if (e instanceof ApiError && e.message === 'AI_UNAVAILABLE') setStep('off');
      else {
        setError(humanize(e, tr));
        setStep('styles');
      }
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!generation?.result_url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'BARS — AI mirror', url: generation.result_url });
      } else {
        await navigator.clipboard.writeText(generation.result_url);
        setError(tr('mr.linkCopied'));
      }
    } catch {
      /* пользователь закрыл диалог */
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  if (step === 'loading') {
    return <p className="py-16 text-center text-text-secondary">{tr('common.loading')}</p>;
  }

  if (step === 'off') {
    return (
      <>
        <AiMaintenanceBanner />
        <History items={history} tr={tr} onDelete={deleteLook} deletingId={deletingHistoryId} />
      </>
    );
  }

  if (step === 'exhausted') {
    return (
      <div>
        <div className="rounded-3xl border border-gold-500/20 bg-bg-elevated p-10 text-center">
          <div className="gold-line w-10 mx-auto mb-6" />
          <h2 className="text-xl font-serif text-text-primary mb-2">{tr('mr.exhaustedTitle')}</h2>
          <p className="text-text-secondary mb-6">
            {tr('mr.exhaustedText')}
          </p>
          <Link href="/booking">
            <Button variant="gold">{tr('nav.book')}</Button>
          </Link>
        </div>
        <History items={history} tr={tr} onDelete={deleteLook} deletingId={deletingHistoryId} />
      </div>
    );
  }

  const total = quota ? quota.free_limit + quota.bonus_count : null;

  return (
    <div>
      {demo && (
        <p className="mb-4 rounded-2xl border border-line bg-subtle px-4 py-3 text-sm text-text-secondary">{tr('mr.demo')}</p>
      )}
      {quota && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-gold-500/30 bg-gold-500/5 px-4 py-3 text-sm">
          <span className="text-text-secondary">{tr('mr.left')}</span>
          <span className="font-semibold text-gold-500">
            {quota.remaining} / {total}
          </span>
        </div>
      )}

      {/* Согласие на обработку биометрии — отдельный, не предзаполненный чекбокс (ТЗ §1.5) */}
      {step === 'consent' && (
        <div className="rounded-3xl border border-line bg-bg-elevated p-6">
          <h2 className="text-xl font-serif text-text-primary mb-3">{tr('mr.consentTitle')}</h2>
          <p className="text-sm text-text-secondary mb-4 leading-relaxed">
            {tr('mr.consentText')}{' '}
            <Link href="/ai-consent" className="text-gold-500 underline">
              {tr('mr.consentFull')}
            </Link>
          </p>
          <label className="flex items-start gap-3 text-sm text-text-primary mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#C9A24B]"
            />
            {tr('mr.consentAgree')}
          </label>
          <label className="flex items-start gap-3 text-sm text-text-primary mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#C9A24B]"
            />
            {tr('mr.adult')}
          </label>
          {error && <p role="alert" className="text-error text-sm mb-3">{error}</p>}
          <Button onClick={giveConsent} disabled={!consent || !adult || busy} className="w-full">
            {tr('mr.continue')}
          </Button>
        </div>
      )}

      {/* Шаг 1 — загрузка фото */}
      {step === 'upload' && (
        <div>
          <h2 className="text-xl font-serif text-text-primary mb-4">{tr('mr.step')} 1. {tr('mr.step1')}</h2>
          <div className="rounded-3xl border border-dashed border-line-strong bg-bg-elevated p-6 sm:p-8 text-center mb-4">
            <ul className="text-sm text-text-secondary mb-6 space-y-1 text-left inline-block">
              <li>• {tr('mr.tip1')}</li>
              <li>• {tr('mr.tip2')}</li>
              <li>• {tr('mr.tip3')}</li>
              <li>• {tr('mr.tip4')}</li>
            </ul>
            <p className="text-xs text-text-secondary/60 mb-6">{tr('mr.formats')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => cameraRef.current?.click()} disabled={busy}>
                <Camera size={16} strokeWidth={1.5} /> {tr('mr.camera')}
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? tr('mr.checking') : tr('mr.gallery')}
              </Button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="user"
              className="sr-only"
              onChange={handleFileChange}
              aria-label={tr('mr.camera')}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleFileChange}
              aria-label={tr('mr.gallery')}
            />
          </div>
          {error && <p role="alert" className="text-error text-sm mb-2">{error}</p>}
          <p className="flex items-center gap-2 text-xs text-text-secondary/70"><ShieldCheck size={14} className="text-gold-500" /> {tr('mr.freeCheck')}</p>
          <History items={history} tr={tr} onDelete={deleteLook} deletingId={deletingHistoryId} />
        </div>
      )}

      {/* Шаг 2 — выбор образа */}
      {step === 'styles' && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            {photoPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt={tr('mr.yourPhoto')} className="w-14 h-14 rounded-full object-cover border border-gold-500/40" />
            )}
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-success"><Check size={15} /> {tr('mr.accepted')}</p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setStep('upload');
                    setSelectedStyle(null);
                  }}
                  className="text-xs text-text-secondary hover:text-text-primary min-h-[32px]"
                >
                  {tr('mr.another')}
                </button>
                <button onClick={deletePhoto} className="text-xs text-text-secondary hover:text-error min-h-[32px]">
                  {tr('mr.deletePhoto')}
                </button>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-serif text-text-primary mb-4">{tr('mr.step')} 2. {tr('mr.step2')}</h2>

          <div className="flex gap-2 mb-4" role="tablist">
            {(Object.keys(STYLE_TYPE_LABELS) as (keyof typeof STYLE_TYPE_LABELS)[]).map((ty) => (
              <button
                key={ty}
                role="tab"
                onClick={() => setActiveStyleType(ty)}
                aria-selected={activeStyleType === ty}
                className={`whitespace-nowrap rounded-full px-4 h-9 text-xs transition-colors ${
                  activeStyleType === ty
                    ? 'bg-gold-500 text-black font-semibold'
                    : 'border border-line text-text-secondary hover:border-gold-500/50'
                }`}
              >
                {tr(STYLE_TYPE_LABELS[ty])}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {styles
              .filter((s) => s.type === activeStyleType)
              .map((s) => {
                const sel = selectedStyle?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStyle(s)}
                    aria-pressed={sel}
                    className={`rounded-2xl overflow-hidden border transition-all ${
                      sel ? 'border-gold-500 ring-2 ring-gold-500/30' : 'border-line hover:border-gold-500/40'
                    }`}
                  >
                    <div className="aspect-square bg-bg-elevated-2">
                      {s.preview_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.preview_url} alt={s.name} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gold-500/60" aria-hidden="true"><Scissors size={28} strokeWidth={1.2} /></div>
                      )}
                    </div>
                    <p className="text-xs py-2 px-2 text-center text-text-secondary truncate">{s.name}</p>
                  </button>
                );
              })}
          </div>

          {error && <p role="alert" className="text-error text-sm mb-3">{error}</p>}

          <Button onClick={() => setStep('confirm')} disabled={!selectedStyle} className="w-full">
            {tr('mr.tryThis')} →
          </Button>
        </div>
      )}

      {/* Подтверждение списания попытки */}
      {step === 'confirm' && selectedStyle && (
        <div className="rounded-3xl border border-gold-500/30 bg-bg-elevated p-6 text-center">
          <h2 className="text-xl font-serif text-text-primary mb-2">{selectedStyle.name}</h2>
          <p className="text-text-secondary mb-6">
            {tr('mr.confirmUse')} {quota?.remaining ?? '…'}. {tr('mr.refundNote')}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('styles')} disabled={busy}>
              ← {tr('bk.back')}
            </Button>
            <Button onClick={handleGenerate} disabled={busy} className="flex-1">
              {busy ? tr('mr.starting') : tr('mr.yes')}
            </Button>
          </div>
        </div>
      )}

      {/* Генерация */}
      {step === 'generating' && (
        <div className="text-center py-12">
          <div className="mirror-shimmer mx-auto mb-6 h-56 w-44 rounded-3xl border border-gold-500/30" aria-hidden="true" />
          <h2 className="text-xl font-serif text-text-primary mb-2" aria-live="polite">
            {tr('mr.generating')}
          </h2>
          <p className="text-text-secondary text-sm">
            {tr('mr.generatingNote')}
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              // перестаём ждать; сервер может досчитать — результат попадёт в историю
              stopPolling();
              sessionStorage.removeItem('mirror-pending');
              setStep('styles');
              setError(tr('mr.cancelNote'));
              void refreshHistory();
            }}
          >
            {tr('mr.cancel')}
          </Button>
        </div>
      )}

      {/* Результат */}
      {step === 'result' && generation?.result_url && (
        <div>
          <h2 className="text-xl font-serif text-text-primary mb-4">
            {generation.style?.name ?? tr('mr.yourLook')} — {tr('mr.ready')}
          </h2>
          {photoPreview ? (
            <BeforeAfter before={photoPreview} after={generation.result_url} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={generation.result_url} alt={tr('mr.yourLook')} className="w-full rounded-3xl" />
          )}
          <p className="text-xs text-text-secondary/70 mt-2 mb-6 text-center">
            {tr('mr.disclaimer')}
            {generation.cache_hit ? ` · ${tr('mr.cached')}` : ''}
          </p>

          <div className="flex flex-col gap-3">
            <Link href={`/booking?ai=${generation.id}`}>
              <Button variant="gold" className="w-full">
                {tr('mr.bookWith')}
              </Button>
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <a href={generation.result_url} download="obraz.jpg" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full">
                  {tr('mr.save')}
                </Button>
              </a>
              <Button variant="outline" onClick={share}>
                {tr('mr.share')}
              </Button>
            </div>
            {(quota?.remaining ?? 0) > 0 ? (
              <Button
                variant="text"
                onClick={() => {
                  setStep('styles');
                  setSelectedStyle(null);
                  setGeneration(null);
                  setError(null);
                }}
              >
                {tr('mr.tryAnother')} ({quota?.remaining})
              </Button>
            ) : (
              <p className="text-center text-xs text-text-secondary">{tr('mr.noAttempts')}</p>
            )}
          </div>
          {error && <p className="text-text-secondary text-sm mt-3 text-center">{error}</p>}
        </div>
      )}

      {/* Капча нужна перед загрузкой фото и перед запуском генерации */}
      {['upload', 'styles', 'confirm'].includes(step) && <Turnstile ref={captchaRef} />}
    </div>
  );
}

function History({ items, tr, onDelete, deletingId }: { items: Generation[]; tr: (k: TKey) => string; onDelete: (item: Generation) => void; deletingId: string | null }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-10">
      <h3 className="text-sm uppercase tracking-wide text-text-secondary/70 mb-3">{tr('mr.history')}</h3>
      <ul className="grid grid-cols-3 gap-3">
        {items.slice(0, 9).map((g) => (
          <li key={g.id} className="rounded-2xl overflow-hidden border border-line bg-bg-elevated">
            <a href={g.result_url!} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.result_url!} alt={g.style?.name ?? tr('mr.yourLook')} loading="lazy" className="aspect-square w-full object-cover" />
            </a>
            <div className="p-2">
              <p className="text-xs text-text-secondary truncate">{g.style?.name}</p>
              <Link href={`/booking?ai=${g.id}`} className="text-xs text-gold-500 hover:text-gold-400">
                {tr('mr.bookShort')} →
              </Link>
              <button
                type="button"
                onClick={() => onDelete(g)}
                disabled={deletingId === g.id}
                aria-label={tr('mr.delete')}
                className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs text-error hover:text-error/80 disabled:opacity-50"
              >
                <Trash2 size={14} /> {deletingId === g.id ? tr('mr.deleting') : tr('mr.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-text-secondary/60">{tr('mr.historyNote')}</p>
    </section>
  );
}
