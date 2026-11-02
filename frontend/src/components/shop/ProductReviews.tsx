'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { apiSend } from '../../lib/api';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Review {
  id: string;
  rating: number;
  text: string | null;
  created_at: string;
  author: string;
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= value ? 'fill-gold-500 text-gold-500' : 'text-faint'} />
      ))}
    </span>
  );
}

/** Отзывы о товаре и форма оценки (рейтинг пересчитывается на сервере). */
export function ProductReviews({ productId, reviews: initial }: { productId: string; reviews: Review[] }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = useState(initial);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !rating) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiSend('POST', `/api/products/${productId}/reviews`, await user.getIdToken(), { rating, text: text || undefined });
      // показываем отзыв сразу, не дожидаясь перерисовки страницы
      setReviews((list) => [
        { id: `local-${Date.now()}`, rating, text: text.trim() || null, created_at: new Date().toISOString(), author: user.full_name.split(' ')[0] ?? user.full_name },
        ...list,
      ]);
      setRating(0);
      setText('');
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        {reviews.length === 0 ? (
          <p>{t('shop.noReviews')}</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {reviews.map((r) => (
              <li key={r.id} className="py-5">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-text-primary">{r.author}</span>
                  <span className="text-xs text-text-secondary">
                    {new Date(r.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ky' ? 'ky-KG' : 'ru-RU')}
                  </span>
                </div>
                <div className="mt-1">
                  <Stars value={r.rating} />
                </div>
                {r.text && <p className="mt-2 leading-relaxed">{r.text}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="h-fit rounded-sm border border-line bg-bg-elevated p-6">
        <h3 className="font-serif text-xl uppercase">{t('shop.writeReview')}</h3>
        {!user ? (
          <Link href="/auth" className="mt-4 inline-block text-gold-500 underline underline-offset-4">
            {t('shop.loginToReview')}
          </Link>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex gap-1" role="radiogroup" aria-label={t('shop.rating')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n}`}
                  onClick={() => setRating(n)}
                  className="inline-flex h-10 w-10 items-center justify-center"
                >
                  <Star size={24} className={n <= rating ? 'fill-gold-500 text-gold-500' : 'text-faint'} />
                </button>
              ))}
            </div>
            <Input as="textarea" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} className="h-24 resize-none py-3" />
            {msg && <p className="text-sm text-error">{msg}</p>}
            <Button onClick={submit} disabled={!rating || busy} className="w-full">
              {t('shop.writeReview')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
