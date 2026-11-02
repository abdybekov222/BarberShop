import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import cart, { addToCart, clearCart, removeFromCart, setQty } from './cartSlice';
import favorites, { toggleFavorite } from './favoritesSlice';

export const CART_KEY = 'bars-cart-v1';
export const FAV_KEY = 'bars-favorites-v1';

/** Сохраняем корзину и избранное в localStorage после каждого изменения (listener middleware). */
const persist = createListenerMiddleware();

persist.startListening({
  matcher: isAnyOf(addToCart, setQty, removeFromCart, clearCart),
  effect: (_action, api) => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify((api.getState() as RootState).cart.items));
    } catch {
      /* приватный режим */
    }
  },
});

persist.startListening({
  actionCreator: toggleFavorite,
  effect: (_action, api) => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify((api.getState() as RootState).favorites.ids));
    } catch {
      /* приватный режим */
    }
  },
});

export const makeStore = () =>
  configureStore({
    reducer: { cart, favorites },
    middleware: (getDefault) => getDefault().prepend(persist.middleware),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/** Селекторы */
export const selectCartCount = (s: RootState) => s.cart.items.reduce((a, i) => a + i.qty, 0);
export const selectCartTotal = (s: RootState) => s.cart.items.reduce((a, i) => a + i.qty * i.price, 0);
export const selectIsFavorite = (id: string) => (s: RootState) => s.favorites.ids.includes(id);
export const selectInCart = (id: string) => (s: RootState) => s.cart.items.find((i) => i.id === id)?.qty ?? 0;
