'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

/** Переключатель «день / ночь». Выбор хранится в localStorage, начальная тема ставится скриптом в <head>. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      title={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:text-gold-500 ${className}`}
    >
      {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
    </button>
  );
}

/** Скрипт для <head>: применяет сохранённую тему до отрисовки (без мигания). */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`;
