/**
 * Нормализация и валидация номера телефона Кыргызстана.
 *
 * Формат E.164: +996 и 9 цифр, например +996555123456.
 * Принимаются входные формы: 0555123456, 996555123456, +996 555 12 34 56 и т.п.
 * Стационарные номера (префикс 3xx) и номера с недопустимым кодом отклоняются.
 *
 * Список допустимых семейств кодов операторов настраивается; по умолчанию
 * мобильные семейства КР: 2, 5, 7, 9 (первая цифра после +996).
 */
import { z } from 'zod';

const E164 = /^\+996[0-9]{9}$/;

/** Семейства мобильных операторов Кыргызстана (первая цифра префикса). */
const DEFAULT_MOBILE_FAMILIES = new Set(['2', '5', '7', '9']);

export type PhoneValidateResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * Приводит любой распознаваемый входной формат к E.164 (+996XXXXXXXXX).
 * Идемпотентен: повторная нормализация уже нормализованного номера возвращает то же.
 * @throws Error('INVALID_PHONE_FORMAT') если не удаётся извлечь 9 цифр.
 */
export function normalizePhone(input: string): string {
  let s = input.replace(/[\s\-()]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  let digits = s;
  if (digits.startsWith('996')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    // локальный формат с префиксом 0
    digits = digits.slice(1);
  }
  if (!/^\d{9}$/.test(digits)) {
    const m = digits.match(/\d{9}$/);
    if (!m) throw new Error('INVALID_PHONE_FORMAT');
    digits = m[0];
  }
  return `+996${digits}`;
}

/**
 * Проверяет нормализованный номер: формат E.164 + допустимый код оператора.
 */
export function isValidPhone(
  normalized: string,
  families: Set<string> = DEFAULT_MOBILE_FAMILIES,
): boolean {
  if (!E164.test(normalized)) return false;
  const family = normalized.charAt(4); // первая цифра после +996
  return families.has(family);
}

/**
 * Полная валидация: нормализует и проверяет.
 */
export function validatePhone(
  input: string,
  families?: Set<string>,
): PhoneValidateResult {
  try {
    const value = normalizePhone(input);
    return isValidPhone(value, families)
      ? { ok: true, value }
      : { ok: false, error: 'Недопустимый код оператора (стационарный номер?)' };
  } catch {
    return { ok: false, error: 'Неверный формат номера (Кыргызстан, +996)' };
  }
}

/**
 * Zod-схема телефона: принимает строку, нормализует и проверяет.
 */
export const phoneSchema = z
  .string()
  .min(1, 'Введите номер телефона')
  .transform((v) => {
    try {
      return normalizePhone(v);
    } catch {
      return v; // провалит refine ниже
    }
  })
  .refine((v) => isValidPhone(v), {
    message: 'Неверный формат номера (Кыргызстан, +996XXXXXXXXX)',
  });

export const DEFAULT_OPERATOR_FAMILIES = DEFAULT_MOBILE_FAMILIES;
