'use client';

import { useRef, useState, type FormEvent } from 'react';
import { apiSend } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PhoneInput, phoneValue } from '../../components/ui/PhoneInput';
import { Turnstile, type TurnstileHandle } from '../../components/Turnstile';
import { useI18n } from '../../i18n/I18nProvider';

/** Форма обратной связи → Telegram владельцу (ТЗ §2.4 «Контакты»). */
export function FeedbackForm() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const hasPhone = phone.replace(/\D/g, '').length > 3;
    const normalized = hasPhone ? phoneValue(phone) : null;
    if (hasPhone && !normalized) return setError(t('phone.invalid'));
    setStatus('sending');
    try {
      const token = await captcha.current?.token();
      await apiSend(
        'POST',
        '/api/feedback',
        null,
        { name: name.trim(), phone: normalized ?? undefined, message: message.trim() },
        token ? { 'cf-turnstile-response': token } : {},
      );
      setStatus('sent');
    } catch (err) {
      setError((err as Error).message);
      setStatus('idle');
    }
  };

  if (status === 'sent') {
    return (
      <div className="rounded-3xl border border-gold-500/30 bg-bg-elevated p-6 text-center">
        <p className="mb-1 font-serif text-xl text-text-primary">{t('pg.contacts.thanks')}</p>
        <p className="text-sm text-text-secondary">{t('pg.contacts.sent')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fb-name" className="mb-2 block text-sm">
            {t('bk.name')}
          </label>
          <Input id="fb-name" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <PhoneInput id="fb-phone" label={t('bk.phone')} value={phone} onChange={setPhone} />
      </div>
      <div>
        <label htmlFor="fb-msg" className="mb-2 block text-sm">
          {t('pg.contacts.message')}
        </label>
        <Input
          id="fb-msg"
          as="textarea"
          placeholder={t('pg.contacts.question2')}
          required
          minLength={5}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="h-28 resize-none py-3"
        />
      </div>
      <Turnstile ref={captcha} />
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? t('pg.contacts.sending') : t('pg.contacts.send')}
      </Button>
    </form>
  );
}
