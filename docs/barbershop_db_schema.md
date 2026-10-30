# База данных барбершопа (PostgreSQL) по ТЗ

Сводная схема из разделов 1.3–1.5 и 3 ТЗ. Объекты, которых в ТЗ нет, но которые нужны для работы, помечены **🆕**. Противоречия ТЗ вынесены в конец.

## 1. Общие правила

- Первичные ключи: `uuid` (v7).
- У всех таблиц есть `created_at` и `updated_at`.
- Мягкое удаление (`deleted_at`) только у `users` и `bookings`.
- Время хранится в UTC. Часовой пояс салона `Asia/Bishkek` лежит в `salon_settings`.
- Деньги в сомах (KGS) хранятся целыми числами, `numeric(10,0)`. Исключение: суммы в долларах в ИИ-таблицах (`numeric(6,4)` и т. п.).
- Индексы нужны на всех внешних ключах и на полях фильтрации.

## 2. Обзор таблиц и связей

| Блок | Таблицы |
|---|---|
| Пользователи и доступ | `users`, `otp_codes`, `refresh_tokens`, `consents`, `blocked_identities` 🆕 |
| Каталог и расписание | `masters`, `service_categories`, `services`, `master_services`, `working_hours`, `time_off`, `gallery_items`, `salon_settings` |
| Записи | `bookings`, `booking_items`, `reviews` |
| ИИ-зеркало | `ai_quotas`, `ai_photos`, `hair_styles`, `ai_generations`, `ai_quota_ledger`, `ai_budget`, `ai_abuse_log` |

**Связи:**

- `users` 1—1 `ai_quotas`
- `users` 1—N `bookings`, `ai_photos`, `ai_generations`, `consents`, `refresh_tokens`, `ai_quota_ledger`, `reviews`
- `users` 1—0..1 `masters` (мастер может быть привязан к учётной записи)
- `masters` N—M `services` через `master_services`
- `masters` 1—N `working_hours`, `time_off`, `bookings`, `gallery_items`, `reviews`
- `service_categories` 1—N `services` и `gallery_items`
- `bookings` 1—N `booking_items`
- `bookings` 1—0..1 `reviews`
- `bookings` N—0..1 `ai_generations` (образ, с которым записались)
- `ai_photos` 1—N `ai_generations`
- `hair_styles` 1—N `ai_generations`
- `hair_styles` N—0..1 `services` (связь образа с услугой)
- `ai_generations` 1—N `ai_quota_ledger`

## 3. Пользователи и авторизация

### `users`

| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| phone | varchar(16) UNIQUE, **NULL** | E.164, формат `+996` и 9 цифр. Пусто у Google-пользователей, пока они не указали номер при записи |
| phone_verified_at | timestamptz NULL | Заполняется после подтверждения OTP |
| email | varchar(255) UNIQUE NULL | |
| google_id | varchar(64) UNIQUE NULL | Привязка Google (только с `email_verified = true`) |
| full_name | varchar(120) | |
| avatar_url | text NULL | |
| role | enum: `client`, `master`, `admin`, `owner` | По умолчанию `client` |
| locale | varchar(5) | По умолчанию `ru` |
| consent_pd_at | timestamptz | Согласие на обработку ПДн |
| consent_ai_at | timestamptz NULL | Согласие на обработку фото для ИИ |
| is_blocked | bool | |
| telegram_chat_id 🆕 | bigint NULL | Для уведомлений и алертов через Telegram-бота |
| signup_ip 🆕 | inet NULL | Нужен для лимита «3 новых аккаунта с IP в сутки» |
| deleted_at | timestamptz NULL | Мягкое удаление |

Ограничение: у пользователя должен быть хотя бы один способ входа (`phone` или `google_id`).

### `otp_codes`

| Поле | Описание |
|---|---|
| id | |
| phone | Номер получателя |
| code_hash | Хранится только хэш 6-значного кода |
| expires_at | TTL 5 минут |
| attempts | Максимум 5 попыток |
| consumed_at | |
| ip | Для лимитов 3 SMS/час и 5/сутки на номер, 5/сутки на IP |

Старые записи удаляются по TTL.

### `refresh_tokens`

Поля: id, user_id (FK), token_hash, user_agent, ip, expires_at, revoked_at. При каждом обновлении токен ротируется.

### `consents` (журнал согласий)

| Поле | Описание |
|---|---|
| id, user_id (FK) | |
| type | `personal_data` или `biometric_ai` |
| text_version, text_hash | Версия и хэш показанного текста (ru/ky) |
| ip, user_agent | |
| created_at, revoked_at | Момент согласия и отзыва |

### `blocked_identities` 🆕

Нужна, чтобы после удаления аккаунта нельзя было получить новые 3 попытки повторной регистрацией. Таблица упомянута в ТЗ, но поля не описаны.

| Поле | Описание |
|---|---|
| id | |
| identity_hash | Хэш Google ID или телефона (UNIQUE) |
| type | `google` или `phone` |
| reason | `account_deleted`, `abuse`, `manual` |
| created_at | |

## 4. Каталог и расписание

### `masters`

| Поле | Тип / описание |
|---|---|
| id, user_id (FK NULL) | |
| slug | UNIQUE |
| name | |
| rank | enum (см. замечание в разделе 8) |
| bio | |
| experience_years | int |
| photo_url | |
| specialties | text[] (3 тега) |
| rating | numeric(2,1), пересчитывается из `reviews` |
| is_active | |
| sort_order | |

### `service_categories`

Поля: id, slug, name, sort_order. Примеры: Стрижки, Бритьё, Борода, Комплексные услуги, Уход/Детям.

### `services`

| Поле | Описание |
|---|---|
| id, category_id (FK) | |
| name, description | |
| base_price | numeric(10,0), в сомах |
| price_is_from 🆕 | bool, показывать ли «от» |
| duration_min | int |
| is_combo | bool |
| is_active, sort_order | |

### `master_services`

PK: (master_id, service_id). Поля: price_override NULL, duration_override NULL. Индивидуальные цена и длительность мастера.

### `working_hours`

Поля: id, master_id (FK), weekday (0–6), start_time, end_time, break_start NULL, break_end NULL.

### `time_off`

Поля: id, master_id (FK), starts_at, ends_at, reason (отпуск, больничный, исключение).

### `gallery_items`

Поля: id, master_id (FK NULL), service_category_id (FK NULL), style_tag, image_url, width, height, blurhash, caption, is_published, sort_order.

### `salon_settings` (ключ — значение)

| Ключ | Назначение |
|---|---|
| timezone | `Asia/Bishkek` |
| slot_step_min | Шаг слотов: 15 или 30 |
| cancel_window_hours | Окно отмены, N часов |
| booking_horizon_days | Горизонт записи: 14–30 дней |
| soft_lock_minutes | Резерв слота на время оформления: 5 мин |
| ai_free_limit | 3 бесплатные попытки |
| ai_provider | `fal`, `hairapi` или `hf` |
| ai_ip_new_accounts_per_day | 3 |
| ai_ip_generations_per_day | 9 |
| ai_uploads_per_day | 5 |
| kg_operator_codes | Допустимые коды операторов |
| ai_photo_ttl_days / ai_result_ttl_days | 7 и 14 |

## 5. Записи

### `bookings`

| Поле | Тип / описание |
|---|---|
| id | uuid PK |
| user_id (FK) | Клиент |
| master_id (FK) | |
| starts_at, ends_at | timestamptz, с учётом суммарной длительности |
| status | `pending`, `confirmed`, `completed`, `cancelled_by_client`, `cancelled_by_salon`, `no_show` |
| total_price | numeric(10,0), цена фиксируется на момент записи |
| total_duration_min | int |
| client_comment | text NULL |
| ai_generation_id | FK NULL, образ, с которым записались |
| source | `web`, `admin`, `telegram` |
| cancelled_at, cancel_reason | |
| reminder_24h_sent_at, reminder_2h_sent_at | timestamptz NULL |
| confirmed_by 🆕 | FK на `users` NULL. Администратор, который подтвердил запись (для Google-пользователей без SMS) |
| deleted_at | Мягкое удаление |

**Защита от двойного бронирования (на уровне БД).** Это ограничение исключения (exclusion constraint) на `bookings`. Для одного `master_id` не могут пересекаться временные диапазоны `starts_at – ends_at`. Проверяются только записи со статусами `pending` и `confirmed`. Для этого нужно расширение `btree_gist`. Дополнительно используется soft-lock слота в Redis на 5 минут.

### `booking_items` (снимок услуг в записи)

Поля: id, booking_id (FK), service_id (FK), price, duration_min.

### `reviews`

Поля: id, booking_id (FK, UNIQUE), user_id, master_id, rating (1–5), text, is_published.

## 6. ИИ-зеркало

Принцип: обработка фото не списывает попытку, а запуск генерации списывает. Лимит хранится отдельно и меняется только на сервере, атомарно.

### `ai_quotas` (1:1 с пользователем)

| Поле | Описание |
|---|---|
| user_id | PK и FK |
| free_limit | smallint, по умолчанию 3 (берётся из настроек при создании) |
| used_count | smallint, списанные попытки |
| bonus_count | smallint, задел под платные и промо-попытки |
| updated_at | |

Проверка: `used_count ≥ 0` и `used_count ≤ free_limit + bonus_count`.
Остаток = `free_limit + bonus_count − used_count`.

### `ai_photos`

| Поле | Описание |
|---|---|
| id, user_id (FK) | |
| storage_key | Путь в приватном S3, обнуляется после удаления |
| status | `uploaded`, `validating`, `approved`, `rejected` |
| reject_reason | `no_face`, `multiple_faces`, `bad_angle`, `low_resolution`, `nsfw`, `too_large` |
| face_meta | jsonb: ключевые точки, угол, маска волос |
| sha256 | Дедупликация и ключ кэша |
| expires_at | Загрузка + 7 дней |
| deleted_at 🆕 | Когда файл реально удалён |

### `hair_styles` (каталог образов, 12–20 штук)

Поля: id, type (`haircut`, `beard`, `combo`), name, preview_url, prompt, negative_prompt, seed 🆕 (фиксированный), model_params (jsonb), linked_service_id (FK NULL), is_active, sort_order.

### `ai_generations`

| Поле | Описание |
|---|---|
| id, user_id, photo_id, style_id | FK |
| status | `queued`, `processing`, `succeeded`, `failed`, `refunded` |
| provider, provider_job_id | `fal`, `hairapi`, `hf` и id задачи у провайдера |
| model_version 🆕 | Часть ключа кэша: sha256 фото + стиль + версия модели |
| result_key | Путь к результату в S3 |
| result_expires_at 🆕 | Загрузка + 14 дней |
| quota_charged | bool |
| quota_refunded_at | NULL, возврат строго один раз |
| error_code | |
| cost_usd | Фактическая стоимость |
| reserved_cost_usd | Зарезервированная стоимость |
| cache_hit | bool, при попадании в кэш попытка и бюджет не тратятся |
| idempotency_key | UNIQUE |
| started_at, finished_at | |

### `ai_quota_ledger` (журнал, только добавление записей)

| Поле | Описание |
|---|---|
| id, user_id | |
| generation_id | FK NULL |
| delta | −1 списание, +1 возврат, +N бонус |
| reason | `generation`, `refund`, `admin_grant`, `promo` |
| balance_after | |
| created_at | |

### `ai_budget` (всегда ровно одна строка)

| Поле | Описание |
|---|---|
| budget_usd | 10.00 |
| spent_usd | Потрачено фактически |
| reserved_usd | Зарезервировано под текущие задачи |
| est_cost_usd | Максимальная цена одной генерации |
| hourly_cap | 5 |
| daily_cap | 15 |
| kill_switch | bool |
| kill_reason | `manual`, `budget`, `daily_cap`, `provider_errors` |
| updated_at | |

Остаток = `budget_usd − spent_usd − reserved_usd`.

### `ai_abuse_log`

Поля: id, user_id (NULL), ip, device_id, rule (`ip_accounts`, `ip_generations`, `turnstile_failed`, `cap_hour`, `cap_day`), created_at.

## 7. Правила, которые БД должна обеспечивать

1. **Двойная бронь невозможна**: exclusion constraint по мастеру и диапазону времени.
2. **Лимит попыток**: списание и резерв бюджета идут в одной транзакции. Условие списания: `used_count < free_limit + bonus_count`. Условие резерва: `spent + reserved + est_cost ≤ budget` и `kill_switch = false`. Если не прошло любое из условий, транзакция откатывается.
3. **Возврат попытки** при сбое делается один раз: только если `quota_refunded_at IS NULL`. Одновременно уменьшается `used_count`, освобождается резерв и пишется строка в ledger.
4. **Идемпотентность**: `idempotency_key` в `ai_generations` уникален.
5. **Один аккаунт или телефон — одна квота**: связь 1:1 `ai_quotas`. Квота не сбрасывается при удалении фото и повторном входе, а после удаления аккаунта действует `blocked_identities`.
6. **Автоудаление**: фото через 7 дней, результаты через 14. Это делают Lifecycle-правило S3 и ночной cron. После удаления `storage_key` и `result_key` обнуляются.
7. **Хранение секретов**: OTP и refresh-токены только в виде хэшей.
8. **Кэш ИИ**: уникальность по (sha256 фото, style_id, model_version).

## 8. Противоречия и пробелы в ТЗ

| № | Что не так | Как предлагаю решить |
|---|---|---|
| 1 | `users.phone` в ТЗ `UNIQUE` и «основной идентификатор», но Google-пользователи вводят номер только при записи | Сделать `phone` nullable с уникальностью только по непустым значениям |
| 2 | `bookings.total_price` указан как `numeric(10,2)`, а в 1.3 цены целые, `numeric(10,0)` | Использовать `numeric(10,0)` везде |
| 3 | Ранги мастеров: в странице «Команда» это Шеф-барбер, Топ-барбер, Барбер, а в схеме есть ещё `senior` | Определиться: либо добавить «Старший барбер» в интерфейс, либо убрать `senior` |
| 4 | Срок хранения результата (14 дней) указан, но поля для него нет: `expires_at` есть только у `ai_photos` | Добавить `result_expires_at` в `ai_generations` |
| 5 | `blocked_identities` упомянута, но не описана | Описана выше |
| 6 | Нет места для Telegram-уведомлений и подтверждения записи администратором | Добавлены `telegram_chat_id` и `confirmed_by` |
| 7 | Лимит «3 аккаунта с IP за сутки» нечем посчитать в БД | Добавлен `users.signup_ip` (счётчики можно держать и в Redis) |
| 8 | Таблица `salon_settings` — набор ключей без фиксированных названий | Список ключей дан в разделе 4 |
