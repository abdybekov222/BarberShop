# BARS Barber Club — премиальный сайт с ИИ-примеркой причёсок

> Название, контакты, адрес и фото сайта собраны в `frontend/src/lib/brand.ts`, логотип —
> `frontend/src/components/Logo.tsx` (+ `public/icon.svg`). Фото — Unsplash (бесплатная
> лицензия) — замените на собственную съёмку перед запуском: фото мастеров, галереи и
> образов ИИ хранятся в БД (`prisma/seed.ts`, админка).

Монорепозиторий (pnpm workspaces) барбершопа для Кыргызстана с онлайн-записью и
виртуальным зеркалом (ИИ-примерка причёсок). Полное ТЗ — `docs/tz_barbershop.md`.

## Стек

| Слой | Технология |
|---|---|
| Фронтенд | Next.js 14 (App Router, TypeScript, Tailwind, shadcn-style UI) |
| Бэкенд | NestJS 10 (TypeScript, REST API) |
| База данных | PostgreSQL 15 (Neon) + Prisma ORM |
| Очереди | Redis + BullMQ (генерация ИИ) |
| Авторизация | Собственный JWT (HS256, scrypt-хэши паролей) + вход через Google (Firebase popup → обмен на JWT) |
| ИИ | Интерфейс AiProvider (Mock для dev, HuggingFace — резерв) |

## Структура

```
frontend/               Next.js 14 (App Router) — сайт, кабинет, админка
  src/app/              страницы (маршруты)
  src/components/       UI-компоненты
  src/store/            Redux Toolkit: корзина, избранное
  src/i18n/             переводы ru / ky / en
  src/lib/              API-клиент, авторизация, бренд
backend/                NestJS — REST API
  src/<модуль>/         booking, catalog, shop, orders, ai, admin, telegram…
  prisma/               схема БД, миграции, сиды
packages/shared/        общие утилиты: formatKgs(), валидация телефона +996
```

## Запуск в один клик (Windows)

Дважды щёлкните **`start.cmd`** в корне проекта. Скрипт сам:

1. проверит Node.js (нужен 22.13+ или 24 LTS — https://nodejs.org);
2. при первом запуске создаст `backend/.env` (с новыми секретами) и `frontend/.env.local`;
   если в `backend/.env` нет строки подключения к базе, откроет файл в Блокноте — вставьте
   `DATABASE_URL` и `DIRECT_URL` из Neon и запустите снова;
3. установит зависимости (только если их нет или изменился `pnpm-lock.yaml`);
4. применит миграции базы;
5. остановит прошлый запуск на портах 3000/3001 и очистит кэш Next.js (OneDrive его портит);
6. запустит API (http://localhost:3001) и сайт (http://localhost:3000) и откроет браузер.

Остановить — `Ctrl+C` в окне. Пустую базу можно заполнить демо-данными: `start.cmd -Seed`.

## Быстрый старт (вручную)

```bash
# 0. Если pnpm не установлен глобально
corepack enable

# 1. Установка (соберёт shared автоматически через postinstall)
pnpm install

# 2. Секреты — скопируйте и заполните
cp .env.example backend/.env      # DATABASE_URL, DIRECT_URL, JWT_SECRET, ADMIN_EMAILS, GEMINI_API_KEY, TELEGRAM_BOT_TOKEN
cp .env.example frontend/.env.local # NEXT_PUBLIC_API_URL; NEXT_PUBLIC_FIREBASE_* — только для кнопки Google

# 3. База данных (миграции + сиды)
pnpm db:migrate   # создаёт все таблицы в Neon + ограничения
pnpm db:seed      # заполняет: 5 категорий, 13 услуг, 3 мастера, 12 стилей, настройки

# 4. Запуск
pnpm dev   # web → http://localhost:3000, api → http://localhost:3001
```

> Redis опционален: без REDIS_URL ИИ-генерации выполняются прямо в процессе API,
> потолки час/сутки считаются по БД, а от двойной брони защищает exclusion
> constraint `no_overlap`. С Redis включаются BullMQ (concurrency 2, 1 повтор при
> сетевой ошибке), soft-lock слотов и лимит генераций с IP.
>
> Чтобы получить доступ к `/admin`, укажите свой email в `ADMIN_EMAILS` (backend/.env)
> и войдите на сайт — роль `owner` назначится автоматически.

### Как устроены ключевые гарантии

- **Лимит 3 ИИ-попытки** — резерв бюджета и списание попытки выполняются **одним
  SQL-оператором** (CTE + `FOR UPDATE` строки `ai_budget`), поэтому лимит соблюдается
  при параллельных кликах и работает через PgBouncer с `connection_limit=1` (Neon).
- **Возврат попытки при сбое** — строго один раз (условный `UPDATE ... WHERE
  quota_refunded_at IS NULL`), запись в `ai_quota_ledger`.
- **Кэш** — тот же (sha256 фото + стиль + версия модели) отдаётся без списания.
- **Kill switch** — вручную из админки, автоматически при исчерпании бюджета и при
  >30% ошибок провайдера за 10 минут; баннер «ИИ-зеркало на техобслуживании».
- **Фото** — согласие (+18) в журнале `consents`; проверка ≥512 px; сжатие до 1024 px,
  JPEG q85 без EXIF; приватное хранилище, подписанные ссылки на 10 мин;
  автоудаление исходников через 7 дней, результатов — через 14 (ежечасная задача).
- **Удаление аккаунта** — хэши Google ID / email / телефона попадают в
  `blocked_identities`: повторная регистрация не даёт новых бесплатных попыток.

### Отличия от ТЗ (осознанные упрощения MVP)

| ТЗ | Сейчас | Что нужно для полного соответствия |
|---|---|---|
| Вход по SMS-OTP (Smspro.kg) | Firebase: Google + email/пароль | Договор с SMS-провайдером, `SmsProvider` |
| S3/R2 + Lifecycle | Локальная папка + подписанные ссылки | Ключи R2, замена `StorageService` |
| fal.ai / Hairstyle API | `mock` (демо) и `hf` (резерв) | Выбор провайдера по итогам R&D |
| MediaPipe/NSFW-проверка фото | Проверка размера/пропорций | Подключить модель в `AiPhotosService` |
| Cloudflare Turnstile | Готово, включается ключами | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| Напоминания за 24 ч / 2 ч | Сводка владельцу в Telegram «кому напомнить» + клиенту, если привязан чат | Привязка Telegram клиента (бот) |

### Также реализовано

- **Отзывы**: после завершённого визита в «Мои записи»; рейтинг мастера пересчитывается;
  модерация в админке; блок отзывов на главной (только имя автора).
- **Команда**: ближайшее свободное окно у каждого мастера, фильтр «Сегодня есть окна»,
  сортировка по рангу.
- **Галерея**: «Записаться к этому мастеру» и «Хочу такую стрижку» (предвыбор образа в ИИ-зеркале).
- **Контакты**: карта OpenStreetMap, «Построить маршрут» (2GIS / Google), форма обратной связи → Telegram.
- **Защита**: rate limit по IP (запись 10/мин, ИИ 15/мин, форма 3/10 мин), заголовки
  безопасности (API и web), лимит «3 новых аккаунта с IP в сутки» для ИИ.
- Прелоадер (1 раз за сессию), анимация hero, брендированные 404 и 500.
- Админка: вкладки «Мастера» (скрыть, отпуск/больничный) и «Отзывы».

Деплой на Render и список обязательных настроек — [docs/render.md](docs/render.md). Dockerfile API также сохранён для самостоятельного размещения.

## Что реализовано

### Публичные страницы

| Маршрут | Описание |
|---|---|
| `/` | Hero, преимущества, топ-услуги, тизер ИИ, мастера-карусель, CTA |
| `/services` | Табы категорий, прайс в сомах, кнопка «Выбрать → /booking» |
| `/gallery` | Masonry-сетка, фильтры по тегу/мастеру, лайтбокс |
| `/team` | Сетка мастеров, фото b/w → цвет на hover |
| `/team/[slug]` | Профиль: bio, услуги, галерея, отзывы |
| `/contacts` | Контакты, расписание, заглушка карты |
| `/privacy` | Политика конфиденциальности |

### Авторизация и личный кабинет

| Маршрут | Описание |
|---|---|
| `/auth` | Вход/регистрация по email и паролю (JWT API), Google sign-in |
| `/account` | Профиль, квота ИИ, быстрые действия |
| `/account/bookings` | Мои записи: предстоящие / история, статусы |
| `/account/mirror` | ИИ-зеркало: 4-шаговый степпер |
| `/account/profile` | Имя, телефон, согласия, удаление аккаунта и данных |
| `/terms`, `/ai-consent` | Условия использования, согласие на обработку фото (RU/KY) |

### Онлайн-запись (`/booking`)

Пошаговый виджет (4 шага + успех):
1. **Услуги** — мультивыбор, суммарная панель
2. **Мастер** — карточки + «Любой свободный»
3. **Дата и время** — горизонтальный календарь, сетка слотов
4. **Подтверждение** — сводка, комментарий, политика отмены
5. **Успех** — золотая галочка, .ics для календаря

Защита от двойного бронирования: soft-lock Redis (5 мин) + exclusion constraint БД.

### ИИ-зеркало (`/account/mirror`)

- Загрузка фото (JPEG/PNG/WebP, до 10 МБ, валидация)
- Каталог стилей: Стрижки / Борода / Комбо (12 образов)
- Запуск генерации через BullMQ очередь
- Polling статуса каждые 2 секунды
- Результат с подписью «ИИ-визуализация»
- Лимит 3 попытки на аккаунт (атомарное списание в БД)
- Кэш по (sha256 + style + model_version) — без списания
- Возврат попытки при ошибке
- Бюджет $10, kill switch, потолки в час/сутки

### Админ-панель (`/admin`)

- Статистика: всего записей, ожидают, сегодня, клиентов
- Управление записями: фильтр по статусу, смена статуса
- ИИ-раздел: kill switch, прогресс бюджета, потолки
- Доступ: роли admin / owner (JWT + RolesGuard); владелец — email из `ADMIN_EMAILS`

## API эндпоинты

### Публичные
```
GET  /api/health                    — healthcheck
GET  /api/config                    — настройки салона + статус ИИ
GET  /api/services                  — услуги (?category=slug)
GET  /api/services/categories      — категории с услугами
GET  /api/masters                   — мастера
GET  /api/masters/:slug             — профиль мастера
GET  /api/gallery                   — галерея (?tag=&master=&skip=&take=)
GET  /api/slots                     — слоты (?masterId=&duration=&horizon=)
GET  /api/ai/styles                 — каталог ИИ-стилей (?type=)
GET  /api/slots/nearest             — ближайшее окно каждого мастера
GET  /api/reviews                   — последние отзывы
POST /api/feedback                  — форма обратной связи (→ Telegram)
```

### Авторизованные (Bearer JWT из `/api/auth/login` или `/api/auth/register`)
```
GET  /api/users/me                  — профиль + квота ИИ
POST /api/bookings                  — создать запись
GET  /api/bookings/my               — мои записи (?scope=upcoming|past|all)
GET  /api/bookings/:id              — детали записи
GET  /api/bookings/:id/ics           — .ics файл для календаря
DELETE /api/bookings/:id            — отмена записи
POST /api/bookings/:id/review       — отзыв о завершённом визите
PATCH /api/users/me                 — имя, телефон
DELETE /api/users/me                — удалить аккаунт и данные
POST /api/ai/consent                — согласие на обработку фото + 18+
POST /api/ai/photos                 — загрузка фото (multipart)
DELETE /api/ai/photos/:id           — досрочное удаление фото и результатов
POST /api/ai/generations            — запуск генерации (Idempotency-Key)
GET  /api/ai/generations            — список генераций
GET  /api/ai/generations/:id        — статус генерации (polling)
```

### Админ (admin/owner)
```
GET  /api/admin/bookings/stats     — статистика
GET  /api/admin/bookings            — список (?status=&masterId=&date=)
PATCH /api/admin/bookings/:id/status — смена статуса
GET  /api/admin/masters             — мастера
PATCH /api/admin/masters/:id/active — вкл/выкл мастера
GET  /api/admin/settings           — настройки салона
PUT  /api/admin/settings            — обновить настройку
GET  /api/admin/ai/status           — бюджет + kill switch
POST /api/admin/ai/kill-switch      — вкл/выкл ИИ
GET  /api/admin/ai/log              — abuse-лог
GET  /api/admin/ai/ledger           — журнал квот
PATCH /api/admin/ai/limits          — потолки час/сутки, бюджет, цена генерации
POST /api/admin/ai/grant            — бонусные попытки клиенту (admin_grant)
GET|POST|PATCH /api/admin/ai/styles — каталог образов
GET|POST|PATCH /api/admin/services  — услуги и цены
POST /api/admin/masters/:id/time-off — отпуск / больничный мастера
GET  /api/files?key&exp&sig         — приватные файлы по подписанной ссылке
```

## База данных (Neon)

Миграции: `prisma/migrations/`
- `init` — все таблицы (users, masters, services, bookings, ai_*, …)
- `db_constraints` — `no_overlap` exclusion constraint + `ai_quotas` CHECK

Сиды: `prisma/seed.ts`
- 13 настроек салона (timezone, slot_step, ai_free_limit, …)
- 5 категорий услуг, 13 услуг с ценами в KGS
- 3 мастера (chief/top/barber) с рабочим расписанием
- 12 ИИ-стилей (haircut/beard/combo)
- 1 строка ai_budget ($10, kill_switch=false)
- 4 элемента галереи

## Скрипты

| Команда | Описание |
|---|---|
| `pnpm dev` | Запуск web + api параллельно |
| `pnpm build` | Сборка всех пакетов |
| `pnpm typecheck` | Проверка типов |
| `pnpm db:migrate` | Применить миграции |
| `pnpm db:seed` | Заполнить БД данными |
| `pnpm db:studio` | Prisma Studio |
| `pnpm dev:api` | Только API |
| `pnpm dev:web` | Только web |

## Дизайн-система (ТЗ §2.1)

| Токен | Значение |
|---|---|
| `--bg-primary` | `#0A0A0A` |
| `--bg-elevated` | `#141414` / `#1C1C1C` |
| `--gold-500` | `#C9A24B` (≤10–15% площади) |
| `--text-primary` | `#FFFFFF` |
| `--text-secondary` | `#B8B8B8` |

- Mobile-first (360 → 390 → 768 → 1280+)
- Минимальная touch-зона 44×44 px
- `prefers-reduced-motion` поддержка
- Цены в сомах (KGS) через `formatKgs()` → «1 200 сом»
- Часовой пояс Asia/Bishkek (UTC+6), в БД — UTC
