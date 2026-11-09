import en from './en.json';
import kg from './kg.json';
import ru from './ru.json';

export const LANGS = ['ru', 'ky', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export type Dictionary = typeof ru;
export type TKey = keyof Dictionary;

export const LANG_LABELS: Record<Lang, string> = { ru: 'RU', ky: 'KG', en: 'EN' };
export const DICTIONARIES: Record<Lang, Dictionary> = {
  ru,
  ky: kg,
  en,
};
