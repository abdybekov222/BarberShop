import type { TKey } from '../i18n/dictionaries';

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: ProductCategory;
  description: string;
  usage: string | null;
  volume: string | null;
  price: number;
  old_price: number | null;
  image_url: string;
  stock: number;
  rating: string | null;
  reviews_count: number;
  is_active: boolean;
  is_featured: boolean;
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const CATEGORIES = ['styling', 'beard', 'shave', 'care', 'tools', 'gift'] as const;
export type ProductCategory = (typeof CATEGORIES)[number];
export const CATEGORY_KEY: Record<ProductCategory, TKey> = {
  styling: 'shop.cat.styling',
  beard: 'shop.cat.beard',
  shave: 'shop.cat.shave',
  care: 'shop.cat.care',
  tools: 'shop.cat.tools',
  gift: 'shop.cat.gift',
};

export const SORTS = ['popular', 'price_asc', 'price_desc', 'new', 'rating'] as const;

export const COURIER_PRICE = 200;
export const FREE_DELIVERY_FROM = 3000;

export function deliveryPrice(subtotal: number, delivery: 'pickup' | 'courier'): number {
  return delivery === 'courier' && subtotal < FREE_DELIVERY_FROM ? COURIER_PRICE : 0;
}

/** Подписи статусов заказа. */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  new: 'Принят',
  paid: 'Оплачен',
  processing: 'Собирается',
  ready: 'Готов к выдаче',
  completed: 'Выдан',
  cancelled: 'Отменён',
};
