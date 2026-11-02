'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DICTIONARIES, type Lang, type TKey } from './dictionaries';

interface I18nValue {
  lang: Lang;
  t: (key: TKey) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue>({
  lang: 'ru',
  t: (k) => DICTIONARIES.ru[k],
  setLang: () => {},
});

/**
 * Язык интерфейса хранится в cookie `lang`, чтобы серверные страницы тоже рендерились
 * на выбранном языке. Смена языка — router.refresh() без перезагрузки.
 */
export function I18nProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const router = useRouter();

  const setLang = useCallback(
    (next: Lang) => {
      document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next === 'ky' ? 'ky' : next;
      setLangState(next);
      router.refresh();
    },
    [router],
  );

  const t = useCallback((key: TKey) => DICTIONARIES[lang][key] ?? DICTIONARIES.ru[key], [lang]);

  return <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
