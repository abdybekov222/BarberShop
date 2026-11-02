'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { apiGet, apiSend } from '../../../lib/api';
import { useI18n } from '../../../i18n/I18nProvider';
import { PhoneInput, formatKgPhone, phoneValue } from '../../../components/ui/PhoneInput';

interface Profile {
  email: string | null;
  phone: string | null;
  full_name: string;
  google_linked: boolean;
  telegram_linked: boolean;
  consent_pd_at: string | null;
  consent_ai_at: string | null;
}

export default function ProfilePage() {
  const { user, signOut, refreshUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    user
      .getIdToken()
      .then((tk) => apiGet<Profile>('/api/users/me', tk))
      .then((p) => {
        setProfile(p);
        setName(p.full_name);
        setPhone(p.phone ? formatKgPhone(p.phone) : '');
      })
      .catch((e: Error) => setMsg({ ok: false, text: e.message }));
  }, [user]);

  if (!user) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const hasPhone = phone.replace(/\D/g, '').length > 3;
    const normalized = hasPhone ? phoneValue(phone) : '';
    if (hasPhone && !normalized) return setMsg({ ok: false, text: t('phone.invalid') });
    setBusy(true);
    try {
      const p = await apiSend<Profile>('PATCH', '/api/users/me', await user.getIdToken(), { full_name: name.trim(), phone: normalized ?? '' });
      setProfile(p);
      refreshUser({ full_name: p.full_name });
      setMsg({ ok: true, text: '✓ ' + t('acc.saved') });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    if (!window.confirm(t('acc.deleteAsk'))) return;
    setBusy(true);
    try {
      await apiSend('DELETE', '/api/users/me', await user.getIdToken());
      await signOut();
      router.push('/');
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
      setBusy(false);
    }
  };

  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { timeZone: 'Asia/Bishkek' }) : '—');

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-4xl sm:text-5xl">{t('acc.profile')}</h1>

      <form onSubmit={save} className="mt-8 space-y-5 rounded-3xl border border-line bg-bg-elevated p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-name" className="mb-2 block text-sm">
              {t('auth.name')}
            </label>
            <input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              required
              autoComplete="name"
              className="h-12 w-full rounded-xl border border-line bg-bg-primary px-4 text-base text-text-primary outline-none focus:border-gold-500"
            />
          </div>
          <PhoneInput id="pf-phone" label={t('bk.phone')} value={phone} onChange={setPhone} />
        </div>
        <dl className="grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-secondary/70">Email</dt>
            <dd className="mt-1 break-words text-text-primary">{profile?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-secondary/70">Google · Telegram</dt>
            <dd className="mt-1 text-text-primary">
              {profile?.google_linked ? 'Google ✓' : 'Google —'} · {profile?.telegram_linked ? 'Telegram ✓' : 'Telegram —'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-secondary/70">{t('acc.consentPd')}</dt>
            <dd className="mt-1 text-text-primary">{date(profile?.consent_pd_at ?? null)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-secondary/70">{t('acc.consentAi')}</dt>
            <dd className="mt-1 text-text-primary">{date(profile?.consent_ai_at ?? null)}</dd>
          </div>
        </dl>
        {msg && <p className={`text-sm ${msg.ok ? 'text-success' : 'text-error'}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="inline-flex h-12 items-center gap-2 rounded-full bg-gold-500 px-7 text-sm font-semibold text-black hover:bg-gold-400 disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />}
          {t('common.save')}
        </button>
      </form>

      <div className="mt-6 rounded-3xl border border-error/30 p-6">
        <h2 className="font-serif text-2xl">{t('acc.deleteTitle')}</h2>
        <p className="mt-2 text-sm">{t('acc.deleteText')}</p>
        <button type="button" onClick={removeAccount} disabled={busy} className="mt-4 inline-flex h-11 items-center rounded-full border border-error px-6 text-sm font-semibold text-error hover:bg-error/10">
          {t('acc.deleteBtn')}
        </button>
      </div>
    </div>
  );
}
