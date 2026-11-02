/**
 * Бренд и контакты салона — единственное место, где их нужно менять.
 * Фото: Unsplash (бесплатная лицензия, коммерческое использование разрешено).
 * Перед запуском замените на собственную съёмку салона и мастеров (медиа-гайд, ТЗ §4).
 */
export const BRAND = {
  name: 'BARS',
  full: 'BARS Barber Club',
  tagline: 'Барбер-клуб · Бишкек',
  address: 'г. Бишкек, ул. Московская, 123',
  addressShort: 'ул. Московская, 123',
  phone: '+996 555 000 000',
  phoneHref: 'tel:+996555000000',
  whatsapp: 'https://wa.me/996555000000',
  telegram: 'https://t.me/bars_barberclub',
  telegramLabel: '@bars_barberclub',
  instagram: 'https://instagram.com/bars.barberclub',
  instagramLabel: '@bars.barberclub',
  email: 'hello@bars.kg',
  hours: [
    { day: 'Понедельник — Суббота', time: '10:00 – 20:00' },
    { day: 'Воскресенье', time: 'Выходной' },
  ],
  geo: { lat: 42.8746, lon: 74.5698 },
} as const;

const u = (id: string, w: number, h?: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=${w}${h ? `&h=${h}` : ''}`;

export const PHOTOS = {
  hero: u('photo-1503951914875-452162b0f3f1', 2000),
  interior: u('photo-1585747860715-2ba37e788b70', 1600),
  interiorWide: u('photo-1536520002442-39764a41e987', 1600),
  tools: u('photo-1621605815971-fbc98d665033', 1200),
  shave: u('photo-1517832606299-7ae9b720a186', 1200),
  beard: u('photo-1599011176306-4a96f1516d4d', 1200),
  fade: u('photo-1593702275687-f8b402bf1fb5', 1200),
  mirrorBefore: u('photo-1562004760-aceed7bb0fe3', 900, 1200),
  mirrorAfter: u('photo-1618049049816-43a00d5b0c3d', 900, 1200),
} as const;
