import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidPhone, validatePhone } from './phone';

describe('normalizePhone', () => {
  it('приводит 0555123456 к E.164', () => {
    expect(normalizePhone('0555123456')).toBe('+996555123456');
  });

  it('приводит 996555123456 к E.164', () => {
    expect(normalizePhone('996555123456')).toBe('+996555123456');
  });

  it('приводит +996 555 12 34 56 к E.164', () => {
    expect(normalizePhone('+996 555 12 34 56')).toBe('+996555123456');
  });

  it('приводит (996) 555-12-34-56 к E.164', () => {
    expect(normalizePhone('(996) 555-12-34-56')).toBe('+996555123456');
  });

  it('идемпотентен: повторная нормализация не меняет результат', () => {
    const once = normalizePhone('0555123456');
    expect(normalizePhone(once)).toBe(once);
  });

  it('бросает ошибку для невалидного ввода', () => {
    expect(() => normalizePhone('abc')).toThrow();
    expect(() => normalizePhone('123')).toThrow();
    expect(() => normalizePhone('')).toThrow();
  });
});

describe('isValidPhone', () => {
  it('принимает валидный мобильный номер', () => {
    expect(isValidPhone('+996555123456')).toBe(true);
    expect(isValidPhone('+996700123456')).toBe(true);
    expect(isValidPhone('+996995123456')).toBe(true);
    expect(isValidPhone('+996222123456')).toBe(true);
  });

  it('отклоняет стационарные номера (префикс 3xx)', () => {
    expect(isValidPhone('+996312123456')).toBe(false);
    expect(isValidPhone('+996355123456')).toBe(false);
  });

  it('отклоняет не-E.164 формат', () => {
    expect(isValidPhone('0555123456')).toBe(false);
    expect(isValidPhone('+996555')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });
});

describe('validatePhone (интеграционная)', () => {
  it('успех для мобильного', () => {
    const r = validatePhone('+996 555 12 34 56');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('+996555123456');
  });

  it('отказ для стационарного', () => {
    const r = validatePhone('+996312123456');
    expect(r.ok).toBe(false);
  });

  it('отказ для мусора', () => {
    const r = validatePhone('hello');
    expect(r.ok).toBe(false);
  });
});
