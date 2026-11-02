/**
 * Форматирование цен в сомах (KGS).
 *
 * Правило (ТЗ): все цены — целые числа, вывод через formatKgs() → «1 200 сом».
 * Разделитель тысяч — пробел (ru-RU использует U+00A0, читается как пробел).
 */

/**
 * Форматирует целое число сомов в строку вида «1 200 сом».
 *
 * @throws TypeError если передано нецелое значение.
 */
export function formatKgs(price: number): string {
  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 0) {
    throw new TypeError(
      `formatKgs: ожидается неотрицательное целое число (сомы), получено ${String(price)}`,
    );
  }
  const grouped = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(price);
  return `${grouped} сом`;
}
