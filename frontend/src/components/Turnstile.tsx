'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useI18n } from '../i18n/I18nProvider';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  getResponse: (id: string) => string | undefined;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileHandle {
  /** Одноразовый токен для заголовка cf-turnstile-response (пустая строка, если капча выключена). */
  token: () => Promise<string>;
}

/**
 * Cloudflare Turnstile (ТЗ §1.3, §3.5). Без NEXT_PUBLIC_TURNSTILE_SITE_KEY ничего не рендерит,
 * а token() возвращает пустую строку — сервер в этом режиме капчу тоже не проверяет.
 */
export const Turnstile = forwardRef<TurnstileHandle>(function Turnstile(_props, ref) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    const mount = () => {
      if (window.turnstile && box.current && !widgetId.current) {
        widgetId.current = window.turnstile.render(box.current, { sitekey: SITE_KEY, theme: 'dark' });
      }
    };
    if (window.turnstile) mount();
    else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
      const s = existing ?? document.createElement('script');
      if (!existing) {
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.dataset.turnstile = '1';
        document.head.appendChild(s);
      }
      s.addEventListener('load', mount);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    token: async () => {
      if (!SITE_KEY) return '';
      for (let i = 0; i < 40; i++) {
        const t = widgetId.current ? window.turnstile?.getResponse(widgetId.current) : undefined;
        if (t) {
          // токен одноразовый — сразу готовим следующий
          window.turnstile?.reset(widgetId.current!);
          return t;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error(t('captcha.required'));
    },
  }), [t]);

  if (!SITE_KEY) return null;
  return <div ref={box} className="my-3 min-h-[65px]" />;
});
