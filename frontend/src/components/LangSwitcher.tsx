'use client';

import { ChevronDown, Globe } from 'lucide-react';
import { LANGS, type Lang } from '../i18n/dictionaries';
import { useI18n } from '../i18n/I18nProvider';
import { Dropdown } from './ui/Dropdown';

const NAMES: Record<Lang, string> = { ru: 'Русский', ky: 'Кыргызча', en: 'English' };
const SHORT: Record<Lang, string> = { ru: 'RU', ky: 'KG', en: 'EN' };

/** Переключатель языка KG / RU / EN — выпадающее меню. */
export function LangSwitcher({ inline = false }: { inline?: boolean }) {
  const { lang, setLang, t } = useI18n();

  if (inline) {
    return (
      <div role="group" aria-label={t('lang.label')} className="inline-flex rounded-xl bg-subtle p-1">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={`h-9 rounded-lg px-4 text-sm font-semibold ${lang === l ? 'bg-gold-500 text-black' : 'text-text-secondary'}`}
          >
            {SHORT[l]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Dropdown
      label={t('lang.label')}
      trigger={
        <span className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary">
          <Globe size={16} strokeWidth={1.6} /> {SHORT[lang]} <ChevronDown size={14} />
        </span>
      }
      items={LANGS.map((l) => ({
        label: NAMES[l],
        hint: SHORT[l],
        onClick: () => setLang(l),
        icon: <span className={`block h-2 w-2 rounded-full ${l === lang ? 'bg-gold-500' : 'bg-transparent'}`} />,
      }))}
    />
  );
}
