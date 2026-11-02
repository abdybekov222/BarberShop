'use client';

import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useI18n } from '../i18n/I18nProvider';

/** Отзыв о завершённом визите: оценка 1–5 и текст. */
export function ReviewForm({ onSubmit }: { onSubmit: (rating: number, text: string) => Promise<void> }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(rating, text);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-gold-500/20 bg-gold-500/5 p-3">
      <p className="text-xs text-text-secondary mb-2">{t('rv.ask')}</p>
      <div className="flex gap-1 mb-3" role="radiogroup" aria-label={t('rv.rating')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}/5`}
            onClick={() => setRating(n)}
            className={`h-11 w-11 text-2xl leading-none ${n <= rating ? 'text-gold-500' : 'text-faint'}`}
          >
            ★
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <Input
            as="textarea"
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('rv.placeholder')}
            className="h-20 resize-none py-2 mb-3"
          />
          {error && <p className="text-xs text-error mb-2">{error}</p>}
          <Button onClick={submit} disabled={busy} className="!h-10 text-xs">
            {t('rv.send')}
          </Button>
        </>
      )}
    </div>
  );
}
