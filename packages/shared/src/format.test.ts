import { describe, it, expect } from 'vitest';
import { formatKgs } from './format';

describe('formatKgs', () => {
  it('форматирует целое число сомов с разделителем тысяч', () => {
    expect(formatKgs(1200)).toBe('1\xa0200 сом');
    expect(formatKgs(0)).toBe('0 сом');
    expect(formatKgs(999)).toBe('999 сом');
    expect(formatKgs(50000)).toBe('50\xa0000 сом');
    expect(formatKgs(99999999)).toBe('99\xa0999\xa0999 сом');
  });

  it('выбрасывает TypeError для нецелых чисел', () => {
    expect(() => formatKgs(1200.5)).toThrow(TypeError);
    expect(() => formatKgs(0.1)).toThrow(TypeError);
    expect(() => formatKgs(NaN)).toThrow(TypeError);
    expect(() => formatKgs(Infinity)).toThrow(TypeError);
  });

  it('выбрасывает TypeError для отрицательных', () => {
    expect(() => formatKgs(-100)).toThrow(TypeError);
  });
});
