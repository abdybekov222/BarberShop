'use client';

import { useEffect, useState } from 'react';

/**
 * false на сервере и при гидратации, true после монтирования.
 * Корзина и избранное живут в localStorage — показываем их только после монтирования,
 * иначе HTML с сервера не совпадёт с клиентом (hydration mismatch).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
