'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../i18n/I18nProvider';
import { LogoMark } from '../../components/Logo';
import { PhoneInput, phoneValue } from '../../components/ui/PhoneInput';

function nextUrl(): string {
  const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
}

const inputCls =
  'h-12 w-full rounded-xl border border-line bg-bg-elevated px-4 text-base text-text-primary outline-none transition-colors placeholder:text-text-secondary/50 focus:border-gold-500';

export default function AuthPage() {
  const { t } = useI18n();
  const { user, loading, login, register, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'form' | 'google' | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace(nextUrl());
  }, [loading, user, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'up') {
      if (!agreed) return setError(t('auth.consentRequired'));
      if (phone.replace(/\D/g, '').length > 3 && !phoneValue(phone)) return setError(t('phone.invalid'));
    }
    setBusy('form');
    try {
      if (mode === 'in') await login(email.trim(), password);
      else await register({ name: name.trim(), email: email.trim(), password, phone: phoneValue(phone) ?? undefined });
      router.replace(nextUrl());
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const google = async () => {
    setError(null);
    setBusy('google');
    try {
      await loginWithGoogle();
      router.replace(nextUrl());
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(code.includes('popup-closed') ? null : (err as Error).message.startsWith('Firebase') ? t('auth.googleFailed') : (err as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-72px)] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-3xl border border-line bg-bg-elevated p-6 shadow-lift sm:p-8">
        <LogoMark size={48} className="mx-auto text-gold-500" />
        <div className="mt-6 grid grid-cols-2 rounded-xl bg-subtle p-1" role="tablist">
          {(['in', 'up'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`h-10 rounded-lg text-sm font-semibold transition-colors ${mode === m ? 'bg-bg-primary text-text-primary shadow-soft' : 'text-text-secondary'}`}
            >
              {m === 'in' ? t('auth.login') : t('auth.register')}
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-sm">{mode === 'in' ? t('auth.loginLead') : t('auth.registerLead')}</p>

        <button
          type="button"
          onClick={google}
          disabled={busy !== null}
          className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-bg-primary text-sm font-semibold text-text-primary transition-colors hover:border-line-strong disabled:opacity-50"
        >
          {busy === 'google' ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
          {t('auth.google')}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-text-secondary/70">
          <span className="h-px flex-1 bg-line" /> {t('auth.or')} <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'up' && (
            <input className={inputCls} placeholder={t('auth.name')} aria-label={t('auth.name')} autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className={inputCls} type="email" placeholder={t('auth.email')} aria-label={t('auth.email')} autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="relative">
            <input
              className={`${inputCls} pr-12`}
              type={showPw ? 'text' : 'password'}
              placeholder={t('auth.password')}
              aria-label={t('auth.password')}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={t('auth.show')} className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center text-text-secondary">
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {mode === 'up' && (
            <>
              <p className="-mt-1 text-xs text-text-secondary/70">{t('auth.passwordHint')}</p>
              <PhoneInput id="reg-phone" label={t('auth.phoneOpt')} value={phone} onChange={setPhone} />
              <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold-500)]" />
                <span>
                  <Link href="/privacy" className="underline underline-offset-2">
                    {t('auth.consent')}
                  </Link>
                </span>
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="rounded-xl border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy !== null}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold-500 text-sm font-semibold uppercase tracking-wider text-black transition-colors hover:bg-gold-400 disabled:opacity-50"
          >
            {busy === 'form' && <Loader2 size={18} className="animate-spin" />}
            {mode === 'in' ? t('auth.submitLogin') : t('auth.submitRegister')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          {mode === 'in' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
          <button type="button" className="font-semibold text-gold-500" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? t('auth.register') : t('auth.login')}
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.5l6.3 5.3C40 35.5 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}
