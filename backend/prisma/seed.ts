/* eslint-disable no-console */
import 'dotenv/config';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Детерминированный UUID из строки — для идемпотентного сида. */
function stableId(namespace: string, key: string): string {
  const h = createHash('sha1').update(`${namespace}:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Фото — Unsplash (бесплатная лицензия, коммерческое использование разрешено).
 * Перед запуском замените на собственную съёмку салона и мастеров.
 */
const photo = (id: string, w: number, h: number): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=faces&q=80&w=${w}&h=${h}`;

/** Описания образов для ИИ-модели (английский — модели понимают его точнее). */
const STYLE_PROMPTS: Record<string, string> = {
  "Классическая": "a classic short gentleman's haircut, neat side part, tapered sides, combed hair",
  "Фейд (Fade)": "a modern skin fade haircut: sides faded down to the skin, a few centimetres of textured hair on top",
  "Андеркат (Undercut)": "an undercut: very short clipped sides and back, long hair on top slicked back",
  "Френч Кроп (Crop)": "a textured French crop: short faded sides, short textured top with a straight blunt fringe",
  "Помпадур": "a pompadour: high volume swept up and back on top, short tapered sides, glossy finish",
  "Бокс / Полубокс": "a very short classic boxer haircut: clipped sides, slightly longer short top",
  "Эспаньолка": "a neat goatee beard with a connected moustache, clean-shaven cheeks",
  "Голливудская борода": "a full well-groomed boxed beard with clean cheek and neck lines",
  "Щетина 3 дня": "an even three-day stubble across the jaw, cheeks and moustache",
  "Стрижка + короткая борода": "a short tapered haircut together with a short trimmed full beard",
  "Фейд + бородка": "a skin fade haircut together with a neat short beard blended into the fade",
  "Андеркат + густая борода": "an undercut with long slicked-back top together with a thick full beard"
};

async function main() {
  console.log('🌱 Seeding barbershop database…');

  // ─── salon_settings (значения из админки при повторном сиде не перезаписываются) ───
  const settings: Record<string, string> = {
    timezone: 'Asia/Bishkek',
    slot_step_min: '30',
    cancel_window_hours: '3',
    booking_horizon_days: '21',
    soft_lock_minutes: '5',
    ai_free_limit: '3',
    ai_provider: 'mock',
    ai_ip_new_accounts_per_day: '3',
    ai_ip_generations_per_day: '9',
    ai_uploads_per_day: '5',
    kg_operator_codes: JSON.stringify(['2', '5', '7', '9']),
    ai_photo_ttl_days: '7',
    ai_result_ttl_days: '14',
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.salonSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log(`  ✓ salon_settings (${Object.keys(settings).length} ключей)`);

  // ─── ai_budget (одна строка) ─────────────────────────────────────
  await prisma.aiBudget.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      budget_usd: 10,
      spent_usd: 0,
      reserved_usd: 0,
      est_cost_usd: 0.05,
      hourly_cap: 5,
      daily_cap: 15,
      kill_switch: false,
    },
    update: {},
  });
  console.log('  ✓ ai_budget ($10)');

  // ─── service_categories ──────────────────────────────────────────
  const categories = [
    { slug: 'strizhki', name: 'Стрижки', sort_order: 0 },
    { slug: 'britye', name: 'Бритьё', sort_order: 1 },
    { slug: 'boroda', name: 'Борода', sort_order: 2 },
    { slug: 'kompleksnye', name: 'Комплексы', sort_order: 3 },
    { slug: 'uhod', name: 'Уход и тонирование', sort_order: 4 },
  ];
  for (const c of categories) {
    await prisma.serviceCategory.upsert({
      where: { slug: c.slug },
      create: { id: stableId('category', c.slug), ...c },
      update: { name: c.name, sort_order: c.sort_order },
    });
  }
  console.log(`  ✓ service_categories (${categories.length})`);

  // ─── services ────────────────────────────────────────────────────
  // Цены — в сомах (KGS), целые. `key` фиксирует id услуги (не меняйте — на него
  // ссылаются записи клиентов); название и цену можно менять свободно.
  const services = [
    // Стрижки
    { key: 'Мужская стрижка', cat: 'strizhki', name: 'Мужская стрижка', desc: 'Консультация, стрижка ножницами и машинкой, мытьё головы, укладка', price: 1500, from: false, dur: 60, combo: false, sort: 0 },
    { key: 'Стрижка + укладка', cat: 'strizhki', name: 'Удлинённая стрижка', desc: 'Для длины от 10 см: ножничная техника, мытьё и укладка', price: 1800, from: false, dur: 75, combo: false, sort: 1 },
    { key: 'Стрижка машинкой', cat: 'strizhki', name: 'Стрижка машинкой', desc: 'Одна-две насадки, окантовка, мытьё головы', price: 900, from: false, dur: 30, combo: false, sort: 2 },
    { key: 'Детская стрижка', cat: 'strizhki', name: 'Детская стрижка', desc: 'Для мальчиков до 12 лет', price: 1000, from: false, dur: 40, combo: false, sort: 3 },
    // Бритьё
    { key: 'Бритьё опасной бритвой', cat: 'britye', name: 'Королевское бритьё', desc: 'Опасная бритва, распаривание горячими полотенцами, уход после бритья', price: 1500, from: false, dur: 45, combo: false, sort: 0 },
    { key: 'Бритьё головы', cat: 'britye', name: 'Бритьё головы', desc: 'Опасной бритвой или шейвером, горячее полотенце', price: 1200, from: false, dur: 40, combo: false, sort: 1 },
    // Борода
    { key: 'Коррекция бороды', cat: 'boroda', name: 'Моделирование бороды', desc: 'Форма под тип лица, окантовка опасной бритвой, масло для бороды', price: 1200, from: false, dur: 40, combo: false, sort: 0 },
    { key: 'Бритьё + оформление бороды', cat: 'boroda', name: 'Камуфляж бороды', desc: 'Тонирование седины в бороде — естественный оттенок без эффекта краски', price: 1000, from: false, dur: 30, combo: false, sort: 1 },
    // Комплексы (экономия указана в описании)
    { key: 'Стрижка + борода', cat: 'kompleksnye', name: 'Стрижка + борода', desc: 'Полный образ: стрижка и моделирование бороды. Экономия 300 сом', price: 2400, from: false, dur: 90, combo: true, sort: 0 },
    { key: 'Стрижка + бритьё', cat: 'kompleksnye', name: 'Стрижка + королевское бритьё', desc: 'Стрижка и бритьё опасной бритвой с горячими полотенцами. Экономия 300 сом', price: 2700, from: false, dur: 105, combo: true, sort: 1 },
    { key: 'Отец + сын', cat: 'kompleksnye', name: 'Отец + сын', desc: 'Мужская и детская стрижка в одно время. Экономия 300 сом', price: 2200, from: false, dur: 90, combo: true, sort: 2 },
    // Уход и тонирование
    { key: 'Камуфляж седины', cat: 'uhod', name: 'Камуфляж седины', desc: 'Тонирование седых волос без осветления, 5–6 недель стойкости', price: 1500, from: false, dur: 40, combo: false, sort: 0 },
    { key: 'Маска для волос', cat: 'uhod', name: 'SPA для кожи головы', desc: 'Пилинг, маска и массаж кожи головы', price: 900, from: false, dur: 25, combo: false, sort: 1 },
    { key: 'Мытьё головы', cat: 'uhod', name: 'Укладка', desc: 'Мытьё головы и укладка профессиональной косметикой', price: 600, from: false, dur: 20, combo: false, sort: 2 },
  ];
  const serviceId = (key: string) => {
    const s = services.find((x) => x.key === key)!;
    // id исторически строился из исходной категории и названия
    const originalCat = key === 'Мытьё головы' || key === 'Маска для волос' || key === 'Камуфляж седины' ? 'uhod' : s.cat;
    return stableId('service', `${originalCat}:${key}`);
  };

  for (const s of services) {
    const id = serviceId(s.key);
    const data = {
      category_id: stableId('category', s.cat),
      name: s.name,
      description: s.desc,
      base_price: s.price,
      price_is_from: s.from,
      duration_min: s.dur,
      is_combo: s.combo,
      is_active: true,
      sort_order: s.sort,
    };
    await prisma.service.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  console.log(`  ✓ services (${services.length})`);

  // ─── masters ─────────────────────────────────────────────────────
  const allKeys = services.map((s) => s.key);
  const masters = [
    {
      slug: 'azamat-karyev',
      name: 'Азамат Карыев',
      rank: 'chief' as const,
      bio: '12 лет в профессии, обучался в Barber Academy Istanbul и London School of Barbering. Основатель BARS. Мастер классических мужских стрижек, фейдов и королевского бритья. Судья городского чемпионата барберов 2025.',
      exp: 12,
      specialties: ['Фейд', 'Классика', 'Опасная бритва'],
      rating: 4.9,
      photo: photo('photo-1585581905588-9e91f63bdd47', 900, 1200),
      services: allKeys,
    },
    {
      slug: 'erlan-tashtanbekov',
      name: 'Эрлан Таштанбеков',
      rank: 'top' as const,
      bio: '8 лет опыта. Специализируется на текстурных стрижках и бороде: подбирает форму под тип лица и рост волос. Финалист Kyrgyz Barber Battle 2024.',
      exp: 8,
      specialties: ['Борода', 'Текстурные стрижки', 'Укладка'],
      rating: 4.8,
      photo: photo('photo-1553521041-d168abd31de3', 900, 1200),
      services: [
        'Мужская стрижка',
        'Стрижка + укладка',
        'Стрижка машинкой',
        'Коррекция бороды',
        'Бритьё + оформление бороды',
        'Бритьё опасной бритвой',
        'Стрижка + борода',
        'Стрижка + бритьё',
        'Камуфляж седины',
        'Мытьё головы',
      ],
    },
    {
      slug: 'nurbek-zhumabekov',
      name: 'Нурбек Жумабеков',
      rank: 'barber' as const,
      bio: '4 года в профессии, 3 года в команде BARS. Аккуратные машинные стрижки, детские стрижки и уходовые процедуры. Находит подход к самым маленьким гостям.',
      exp: 4,
      specialties: ['Детские стрижки', 'Машинка', 'Уход'],
      rating: 4.7,
      photo: photo('photo-1598524374912-6b0b0bab43dd', 900, 1200),
      services: [
        'Мужская стрижка',
        'Стрижка машинкой',
        'Детская стрижка',
        'Бритьё головы',
        'Отец + сын',
        'Маска для волос',
        'Мытьё головы',
      ],
    },
  ];

  for (const m of masters) {
    const masterId = stableId('master', m.slug);
    const data = {
      slug: m.slug,
      name: m.name,
      rank: m.rank,
      bio: m.bio,
      experience_years: m.exp,
      photo_url: m.photo,
      specialties: m.specialties,
      sort_order: m.rank === 'chief' ? 0 : m.rank === 'top' ? 1 : 2,
    };
    await prisma.master.upsert({
      where: { id: masterId },
      create: { id: masterId, ...data, rating: m.rating, is_active: true },
      // rating пересчитывается из отзывов — сид его не трогает
      update: data,
    });

    // working_hours: пн–сб 10:00–20:00, перерыв 13:00–14:00
    for (const weekday of [1, 2, 3, 4, 5, 6]) {
      const whId = stableId('wh', `${m.slug}:${weekday}`);
      await prisma.workingHour.upsert({
        where: { id: whId },
        create: {
          id: whId,
          master_id: masterId,
          weekday,
          start_time: '10:00',
          end_time: '20:00',
          break_start: '13:00',
          break_end: '14:00',
        },
        update: {},
      });
    }

    for (const key of m.services) {
      const sid = serviceId(key);
      await prisma.masterService.upsert({
        where: { master_id_service_id: { master_id: masterId, service_id: sid } },
        create: { master_id: masterId, service_id: sid },
        update: {},
      });
    }
  }
  console.log(`  ✓ masters (${masters.length}) + working_hours + master_services`);

  // ─── hair_styles (каталог ИИ-образов, 12 шт.) ─────────────────────
  const hairStyles = [
    { key: 'Классическая', type: 'haircut' as const, name: 'Классика (Classic)', img: 'photo-1627100232173-acf3733f02bc', sort: 0 },
    { key: 'Фейд (Fade)', type: 'haircut' as const, name: 'Фейд (Fade)', img: 'photo-1578390432942-d323db577792', sort: 1 },
    { key: 'Андеркат (Undercut)', type: 'haircut' as const, name: 'Андеркат (Undercut)', img: 'photo-1568339434343-2a640a1a9946', sort: 2 },
    { key: 'Френч Кроп (Crop)', type: 'haircut' as const, name: 'Френч Кроп (Crop)', img: 'photo-1622286342621-4bd786c2447c', sort: 3 },
    { key: 'Помпадур', type: 'haircut' as const, name: 'Помпадур (Pompadour)', img: 'photo-1562004760-aceed7bb0fe3', sort: 4 },
    { key: 'Бокс / Полубокс', type: 'haircut' as const, name: 'Бокс / Полубокс', img: 'photo-1593702275687-f8b402bf1fb5', sort: 5 },
    { key: 'Эспаньолка', type: 'beard' as const, name: 'Эспаньолка', img: 'photo-1629189784191-9afdcbcb0398', sort: 6 },
    { key: 'Голливудская борода', type: 'beard' as const, name: 'Голливудская борода', img: 'photo-1630827020718-3433092696e7', sort: 7 },
    { key: 'Щетина 3 дня', type: 'beard' as const, name: 'Щетина 3 дня', img: 'photo-1618049049816-43a00d5b0c3d', sort: 8 },
    { key: 'Стрижка + короткая борода', type: 'combo' as const, name: 'Стрижка + короткая борода', img: 'photo-1633601851802-ad8eb2bcf1f4', sort: 9 },
    { key: 'Фейд + бородка', type: 'combo' as const, name: 'Фейд + бородка', img: 'photo-1599351431202-1e0f0137899a', sort: 10 },
    { key: 'Андеркат + густая борода', type: 'combo' as const, name: 'Андеркат + густая борода', img: 'photo-1517832606299-7ae9b720a186', sort: 11 },
  ];
  for (const hs of hairStyles) {
    const id = stableId('hairstyle', `${hs.type}:${hs.key}`);
    const data = { type: hs.type, name: hs.name, prompt: STYLE_PROMPTS[hs.key] ?? null, preview_url: photo(hs.img, 600, 600), sort_order: hs.sort };
    await prisma.hairStyle.upsert({
      where: { id },
      create: { id, ...data, is_active: true },
      update: data,
    });
  }
  console.log(`  ✓ hair_styles (${hairStyles.length})`);

  // ─── gallery_items (работы мастеров) ─────────────────────────────
  await prisma.galleryItem.deleteMany({ where: { image_url: { startsWith: 'https://placehold.co' } } });
  const gallery = [
    { master: 'azamat-karyev', cat: 'strizhki', caption: 'Скин-фейд с текстурой', tag: 'fade', img: 'photo-1593702275687-f8b402bf1fb5', w: 900, h: 1200 },
    { master: 'erlan-tashtanbekov', cat: 'boroda', caption: 'Моделирование бороды', tag: 'beard', img: 'photo-1599011176306-4a96f1516d4d', w: 900, h: 1100 },
    { master: 'azamat-karyev', cat: 'kompleksnye', caption: 'Фейд и окантовка бритвой', tag: 'fade', img: 'photo-1599351431202-1e0f0137899a', w: 900, h: 900 },
    { master: 'erlan-tashtanbekov', cat: 'strizhki', caption: 'Френч кроп', tag: 'crop', img: 'photo-1622286342621-4bd786c2447c', w: 900, h: 1200 },
    { master: 'azamat-karyev', cat: 'strizhki', caption: 'Помпадур', tag: 'pompadour', img: 'photo-1562004760-aceed7bb0fe3', w: 900, h: 1100 },
    { master: 'erlan-tashtanbekov', cat: 'boroda', caption: 'Густая борода, форма «лопата»', tag: 'beard', img: 'photo-1630827020718-3433092696e7', w: 900, h: 1200 },
    { master: 'nurbek-zhumabekov', cat: 'strizhki', caption: 'Андеркат с дизайном', tag: 'undercut', img: 'photo-1568339434343-2a640a1a9946', w: 900, h: 900 },
    { master: 'azamat-karyev', cat: 'britye', caption: 'Королевское бритьё', tag: 'beard', img: 'photo-1517832606299-7ae9b720a186', w: 900, h: 1100 },
    { master: 'erlan-tashtanbekov', cat: 'kompleksnye', caption: 'Текстурный кроп и борода', tag: 'combo', img: 'photo-1618049049816-43a00d5b0c3d', w: 900, h: 1200 },
    { master: 'nurbek-zhumabekov', cat: 'strizhki', caption: 'Классический фейд', tag: 'fade', img: 'photo-1578390432942-d323db577792', w: 900, h: 1100 },
    { master: 'azamat-karyev', cat: 'strizhki', caption: 'Классика с пробором', tag: 'classic', img: 'photo-1627100232173-acf3733f02bc', w: 900, h: 1200 },
    { master: 'erlan-tashtanbekov', cat: 'kompleksnye', caption: 'Фейд и короткая борода', tag: 'combo', img: 'photo-1633601851802-ad8eb2bcf1f4', w: 900, h: 1100 },
  ];
  for (const [i, g] of gallery.entries()) {
    const id = stableId('gallery', `${g.master}:${g.img}`);
    const data = {
      master_id: stableId('master', g.master),
      service_category_id: stableId('category', g.cat),
      style_tag: g.tag,
      image_url: photo(g.img, g.w, g.h),
      width: g.w,
      height: g.h,
      caption: g.caption,
      is_published: true,
      sort_order: i,
    };
    await prisma.galleryItem.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  console.log(`  ✓ gallery_items (${gallery.length})`);

  // ─── products (магазин) ──────────────────────────────────────────
  // Остаток (stock) задаётся только при создании — повторный сид не сбрасывает склад.
  const products = [
    { slug: 'bars-matte-clay', name: 'Матовая глина', brand: 'BARS', category: 'styling' as const, volume: '100 мл', price: 1400, old: null, img: 'photo-1587909209111-5097ee578ec3', stock: 24, featured: true,
      desc: 'Сильная фиксация без блеска. Подходит для текстурных стрижек, кропа и небрежной укладки. Легко смывается водой.',
      usage: 'Разотрите небольшое количество между ладонями и распределите по сухим волосам от корней к кончикам.' },
    { slug: 'bars-classic-pomade', name: 'Помада для укладки «Классика»', brand: 'BARS', category: 'styling' as const, volume: '100 мл', price: 1300, old: null, img: 'photo-1775126250995-8d2364537089', stock: 18, featured: false,
      desc: 'Средняя фиксация и естественный блеск — для зачёсов назад, помпадура и пробора. На водной основе.',
      usage: 'Наносите на слегка влажные волосы, затем уложите расчёской.' },
    { slug: 'bars-texture-paste', name: 'Паста для текстуры', brand: 'BARS', category: 'styling' as const, volume: '75 мл', price: 1200, old: 1400, img: 'photo-1621605810691-86520f5b5262', stock: 9, featured: false,
      desc: 'Лёгкая фиксация и подвижность. Хороша для коротких стрижек, где нужна текстура, но не «шлем».',
      usage: 'Небольшое количество на сухие волосы, моделируйте пальцами.' },
    { slug: 'beard-oil-cedar', name: 'Масло для бороды «Кедр и бергамот»', brand: 'BARS', category: 'beard' as const, volume: '30 мл', price: 950, old: null, img: 'photo-1673350963997-fc802e774580', stock: 30, featured: true,
      desc: 'Смягчает жёсткую бороду и убирает зуд у кожи под ней. Аргановое и жожоба, без силиконов.',
      usage: '3–5 капель на ладонь, вотрите в бороду и кожу под ней после душа.' },
    { slug: 'beard-oil-citrus', name: 'Масло для бороды «Цитрус»', brand: 'BARS', category: 'beard' as const, volume: '30 мл', price: 950, old: null, img: 'photo-1627876280688-24a58ba02f2c', stock: 14, featured: false,
      desc: 'Лёгкое масло со свежим запахом апельсина и грейпфрута. Не утяжеляет, быстро впитывается.',
      usage: '3–5 капель ежедневно, затем расчешите бороду.' },
    { slug: 'beard-balm', name: 'Бальзам для бороды', brand: 'BARS', category: 'beard' as const, volume: '60 мл', price: 1100, old: null, img: 'photo-1515377905703-c4788e51af15', stock: 12, featured: false,
      desc: 'Ухаживает и слегка фиксирует форму. Для бороды от 1 см, когда волоски торчат в разные стороны.',
      usage: 'Разогрейте в ладонях и распределите по бороде, придайте форму расчёской.' },
    { slug: 'beard-conditioner', name: 'Кондиционер для бороды', brand: 'BARS', category: 'care' as const, volume: '150 мл', price: 850, old: null, img: 'photo-1672761431764-61b8d9a00dbb', stock: 20, featured: false,
      desc: 'Делает бороду мягкой и облегчает расчёсывание. Используйте после шампуня 2–3 раза в неделю.',
      usage: 'Нанесите на влажную бороду на 1–2 минуты, смойте.' },
    { slug: 'safety-razor', name: 'Т-образный станок', brand: 'Bishkek Steel', category: 'shave' as const, volume: null, price: 2200, old: null, img: 'photo-1629261651616-00c3e07ca6e8', stock: 8, featured: true,
      desc: 'Классический станок под сменные лезвия. Бреет чище картриджей и меньше раздражает кожу. В комплекте 5 лезвий.',
      usage: 'Держите под углом 30°, без нажима, по росту волос.' },
    { slug: 'shaving-cream', name: 'Крем для бритья', brand: 'BARS', category: 'shave' as const, volume: '100 мл', price: 750, old: null, img: 'photo-1506029214967-eef911357d1b', stock: 26, featured: false,
      desc: 'Плотная пена со стеарином и маслом ши — бритва скользит мягко, кожа не стягивается.',
      usage: 'Взбейте помазком или ладонями, нанесите на распаренную кожу.' },
    { slug: 'after-shave-tonic', name: 'Лосьон после бритья', brand: 'BARS', category: 'shave' as const, volume: '100 мл', price: 900, old: null, img: 'photo-1504457315922-966b2a1e65e7', stock: 15, featured: false,
      desc: 'Успокаивает кожу после бритья, без спирта — не щиплет. Лёгкий древесный аромат.',
      usage: 'Похлопывающими движениями на сухую кожу сразу после бритья.' },
    { slug: 'beard-trimmer', name: 'Триммер для бороды', brand: 'Bishkek Steel', category: 'tools' as const, volume: null, price: 3900, old: 4500, img: 'photo-1646376241249-f261e72c2029', stock: 6, featured: true,
      desc: 'Беспроводной триммер с 5 насадками от 1 до 12 мм. Работает до 90 минут, заряжается по USB-C.',
      usage: 'Начинайте с длинной насадки и постепенно уменьшайте.' },
    { slug: 'pro-clipper', name: 'Машинка для стрижки Pro', brand: 'Bishkek Steel', category: 'tools' as const, volume: null, price: 6500, old: null, img: 'photo-1621605810368-f698685efbe1', stock: 4, featured: false,
      desc: 'Та же модель, с которой работают наши мастера. Мощный мотор, стальные ножи, 8 насадок.',
      usage: 'Подходит для фейдов и стрижки под насадку дома.' },
    { slug: 'gift-set-home-barber', name: 'Набор «Барбер дома»', brand: 'BARS', category: 'gift' as const, volume: null, price: 3200, old: 3800, img: 'photo-1627875777314-da35433c0c8e', stock: 10, featured: true,
      desc: 'Глина для укладки, масло для бороды, шампунь и деревянная расчёска в подарочной коробке.',
      usage: null },
    { slug: 'gift-set-beard', name: 'Набор для бороды', brand: 'BARS', category: 'gift' as const, volume: null, price: 2700, old: 3050, img: 'photo-1621605816839-5b9e37588814', stock: 7, featured: false,
      desc: 'Масло, бальзам и кондиционер для бороды + щётка из натуральной щетины.',
      usage: null },
  ];
  for (const [i, p] of products.entries()) {
    const id = stableId('product', p.slug);
    const data = {
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      category: p.category,
      description: p.desc,
      usage: p.usage,
      volume: p.volume,
      price: p.price,
      old_price: p.old,
      image_url: photo(p.img, 900, 900),
      is_featured: p.featured,
      sort_order: i,
    };
    await prisma.product.upsert({ where: { id }, create: { id, ...data, stock: p.stock }, update: data });
  }
  console.log(`  ✓ products (${products.length})`);

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
