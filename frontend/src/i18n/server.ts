import { cookies } from 'next/headers';
import { DICTIONARIES, LANGS, type Lang, type TKey } from './dictionaries';

/** Язык и переводчик для серверных компонентов (cookie `lang`). */
export function getServerI18n(): { lang: Lang; t: (key: TKey) => string } {
  const raw = cookies().get('lang')?.value;
  const lang: Lang = (LANGS as readonly string[]).includes(raw ?? '') ? (raw as Lang) : 'ru';
  return { lang, t: (key) => DICTIONARIES[lang][key] ?? DICTIONARIES.ru[key] };
}
