'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { CART_KEY, FAV_KEY, makeStore, type AppStore } from './store';
import { hydrateCart, type CartItem } from './cartSlice';
import { hydrateFavorites } from './favoritesSlice';

/** Redux-провайдер: один store на вкладку, восстановление корзины и избранного из localStorage. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) storeRef.current = makeStore();

  useEffect(() => {
    const store = storeRef.current!;
    try {
      const cart = JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as CartItem[];
      const fav = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as string[];
      if (Array.isArray(cart)) store.dispatch(hydrateCart(cart));
      if (Array.isArray(fav)) store.dispatch(hydrateFavorites(fav));
    } catch {
      /* повреждённые данные — начинаем с пустой корзины */
    }
    // Синхронизация между вкладками
    const onStorage = (e: StorageEvent) => {
      try {
        if (e.key === CART_KEY) store.dispatch(hydrateCart(JSON.parse(e.newValue ?? '[]')));
        if (e.key === FAV_KEY) store.dispatch(hydrateFavorites(JSON.parse(e.newValue ?? '[]')));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}
