import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Позиция корзины — снимок товара на момент добавления (цену сервер всё равно пересчитает). */
export interface CartItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  image_url: string;
  stock: number;
  qty: number;
}

export interface CartState {
  items: CartItem[];
}

const initialState: CartState = { items: [] };

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart(state, action: PayloadAction<Omit<CartItem, 'qty'> & { qty?: number }>) {
      const { qty = 1, ...product } = action.payload;
      const existing = state.items.find((i) => i.id === product.id);
      if (existing) {
        existing.qty = Math.min(existing.qty + qty, product.stock, 20);
        existing.price = product.price;
      } else if (product.stock > 0) {
        state.items.push({ ...product, qty: Math.min(qty, product.stock) });
      }
    },
    setQty(state, action: PayloadAction<{ id: string; qty: number }>) {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (!item) return;
      item.qty = Math.max(1, Math.min(action.payload.qty, item.stock, 20));
    },
    removeFromCart(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
    clearCart(state) {
      state.items = [];
    },
    hydrateCart(state, action: PayloadAction<CartItem[]>) {
      state.items = action.payload;
    },
  },
});

export const { addToCart, setQty, removeFromCart, clearCart, hydrateCart } = cartSlice.actions;
export default cartSlice.reducer;
