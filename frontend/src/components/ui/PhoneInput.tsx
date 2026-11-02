'use client';

import { useState } from 'react';
import { validatePhone } from '@barbershop/shared';
import { useI18n } from '../../i18n/I18nProvider';

/** Маска «+996 XXX XXX XXX» из любых введённых цифр (0555…, 996555…, +996 555…). */
export function formatKgPhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('996')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  d = d.slice(0, 9);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  return `+996${parts.length ? ' ' + parts.join(' ') : ''}`;
}

/** Нормализованный номер (+996XXXXXXXXX) или null, если номер невалиден. */
export function phoneValue(masked: string): string | null {
  const r = validatePhone(masked);
  return r.ok ? r.value : null;
}

/**
 * Поле телефона Кыргызстана: маска, проверка формата и кода оператора
 * (общая валидация из packages/shared — та же, что на сервере).
 */
export function PhoneInput({
  value,
  onChange,
  id,
  required,
  label,
}: {
  value: string;
  onChange: (masked: string) => void;
  id?: string;
  required?: boolean;
  label?: string;
}) {
  const { t } = useI18n();
  const [touched, setTouched] = useState(false);
  const digits = value.replace(/\D/g, '').replace(/^996/, '');
  const result = digits.length ? validatePhone(value) : null;
  const showError = touched && digits.length > 0 && result && !result.ok;
  const ok = result?.ok;

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-2 block text-sm">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={required}
          value={value || ''}
          placeholder="+996 555 123 456"
          onFocus={() => !value && onChange('+996 ')}
          onChange={(e) => onChange(formatKgPhone(e.target.value))}
          onBlur={() => {
            setTouched(true);
            if (value.replace(/\D/g, '') === '996') onChange('');
          }}
          aria-invalid={showError ? true : undefined}
          aria-describedby={id ? `${id}-hint` : undefined}
          className={`h-12 w-full rounded-xl border bg-bg-elevated px-4 text-base tracking-wide text-text-primary outline-none transition-colors placeholder:text-text-secondary/50 focus:border-gold-500 ${
            showError ? 'border-error' : ok ? 'border-success/60' : 'border-line'
          }`}
        />
        {ok && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-success">✓</span>}
      </div>
      <p id={id ? `${id}-hint` : undefined} className={`mt-1.5 text-xs ${showError ? 'text-error' : 'text-text-secondary/70'}`}>
        {showError && result && !result.ok ? t('phone.invalid') : t('phone.hint')}
      </p>
    </div>
  );
}
