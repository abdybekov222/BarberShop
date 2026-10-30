# Requirements Document

## Introduction

Данный документ описывает требования к функционалу «Foundation + Auth» — этап 4 дорожной карты разработки премиального сайта барбершопа для Кыргызстана. Этап включает создание технического фундамента проекта: монорепозитория с pnpm workspaces, инфраструктуры для локальной разработки (docker-compose), CI/CD в GitHub Actions, полной Prisma-схемы базы данных со всеми таблицами из раздела 3 ТЗ, миграциями и сидами, а также системы авторизации с двумя способами входа (Google OAuth 2.0 и SMS-OTP), защитой от ботов (Cloudflare Turnstile), ролевой моделью (client/master/admin/owner) и JWT-токенами с ротацией. Дополнительно создаётся каркас фронтенда на Next.js с дизайн-токенами, self-hosted шрифтами, базовыми UI-компонентами, страницей входа /auth и заглушкой защищённого личного кабинета /account.

Вне объёма данного спека: публичные страницы (главная, услуги, галерея, команда, контакты), онлайн-запись, ИИ-модуль «Виртуальное зеркало», админ-панель. Структура БД для этих модулей создаётся на этапе Foundation, но бизнес-логика не реализуется.

## Glossary

- **Монорепозиторий**: единый Git-репозиторий, управляемый pnpm workspaces, содержащий приложения apps/web, apps/api и общий пакет packages/shared.
- **API**: приложение apps/api — бэкенд на NestJS (TypeScript), предоставляющий REST API.
- **Веб-клиент**: приложение apps/web — фронтенд на Next.js 14+ (App Router, TypeScript).
- **packages/shared**: общий пакет монорепозитория, содержащий Zod-схемы, TypeScript-типы и утилиты (включая formatKgs), используемые как API, так и Веб-клиентом.
- **Prisma**: ORM для работы с PostgreSQL; включает файл схемы (schema.prisma), миграции и сиды.
- **PostgreSQL**: реляционная СУБД версии 15, основная база данных проекта.
- **docker-compose**: конфигурация локальной среды разработки, запускающая PostgreSQL, Redis и MinIO в контейнерах.
- **GitHub Actions**: система CI/CD, запускающая пайплайн проверки кода при pull request.
- **OTP**: одноразовый пароль (one-time password) из 6 цифр, отправляемый по SMS для подтверждения номера телефона.
- **SmsProvider**: интерфейс в API для отправки SMS; реализации — MockSmsProvider, SmsproProvider и SmsCenterProvider.
- **MockSmsProvider**: тестовая реализация SmsProvider, выводящая OTP-код в лог сервера вместо отправки реального SMS.
- **E.164**: международный формат номера телефона (например, +996XXXXXXXXX).
- **JWT**: JSON Web Token — access-токен сроком 15 минут для аутентификации запросов к API.
- **Refresh-токен**: долгоживущий токен обновления, хранится в httpOnly Secure SameSite cookie, используется для получения нового JWT.
- **Turnstile**: Cloudflare Turnstile — антибот-проверка; токен проверяется на сервере через siteverify.
- **Turnstile_Guard**: переиспользуемый NestJS guard, проверяющий валидность токена Turnstile через Cloudflare siteverify.
- **RolesGuard**: NestJS guard для проверки ролей пользователя при доступе к защищённым эндпоинтам.
- **formatKgs**: функция в packages/shared, форматирующая целочисленную цену в строку вида «1 200 сом».
- **ai_quotas**: таблица лимитов ИИ-генераций; на этапе Foundation создаётся структура и автосоздание записи с free_limit = 3 при регистрации.
- **blocked_identities**: таблица хэшей удалённых идентификаторов (Google ID или телефон), предотвращающая повторное получение бесплатных ИИ-попыток.
- **exclusion constraint**: ограничение исключения в PostgreSQL (no_overlap) для защиты от двойного бронирования; требует расширение btree_gist.
- **salon_settings**: таблица ключ-значение для настроек салона (часовой пояс, шаг слотов, лимиты ИИ и др.).
- **Набор_тестов**: набор юнит-тестов на Vitest/Jest для проверки бизнес-логики.
- **E2E-тест**: сквозной тест на Playwright, проверяющий полный пользовательский сценарий.

## Requirements

### Requirement 1: Структура монорепозитория и инструментирование

**User Story:** Как разработчик, я хочу единую структуру монорепозитория с pnpm workspaces и общим инструментированием, чтобы все части проекта находились в одном репозитории и разделяли зависимости, конфигурацию линтинга и типы.

#### Acceptance Criteria

1. THE Монорепозиторий SHALL содержать директории apps/web, apps/api и packages/shared, управляемые pnpm workspaces.
2. THE packages/shared SHALL экспортировать Zod-схемы, TypeScript-типы и функцию formatKgs для использования в API и Веб-клиенте.
3. WHERE добавляется новая зависимость, THE pnpm workspaces SHALL устанавливать зависимость в соответствующий workspace без дублирования в корневом node_modules.
4. THE Монорепозиторий SHALL включать TypeScript strict mode во всех workspace: apps/web, apps/api, packages/shared.
5. THE Монорепозиторий SHALL включать ESLint и Prettier с едиными правилами во всех workspace.
6. THE Монорепозиторий SHALL содержать корневой package.json со скриптами для запуска lint, typecheck, test и build во всех workspace.

### Requirement 2: Локальная среда через docker-compose

**User Story:** Как разработчик, я хочу локальную среду с PostgreSQL, Redis и MinIO через docker-compose, чтобы запускать проект локально без ручной установки сервисов.

#### Acceptance Criteria

1. THE Монорепозиторий SHALL содержать docker-compose.yml с сервисами postgres (PostgreSQL 15), redis и minio (S3-совместимое хранилище).
2. WHEN разработчик выполняет docker-compose up, THE docker-compose SHALL запустить все сервисы с портами и томами, заданными в .env.example.
3. THE docker-compose SHALL сохранять данные PostgreSQL, Redis и MinIO в named volumes для сохранения состояния между перезапусками контейнеров.

### Requirement 3: CI/CD пайплайн в GitHub Actions

**User Story:** Как разработчик, я хочу CI-пайплайн в GitHub Actions, который запускает lint, typecheck, test и build при каждом pull request, чтобы предотвратить попадание некорректного кода в основную ветку.

#### Acceptance Criteria

1. WHEN создан pull request в основную ветку, THE GitHub Actions SHALL запустить последовательность этапов: lint → typecheck → test → build.
2. IF любой из этапов lint, typecheck, test или build завершается с ошибкой, THEN THE GitHub Actions SHALL остановить пайплайн и отметить проверку как проваленную.
3. THE GitHub Actions SHALL кэшировать зависимости pnpm между запусками для ускорения сборки.
4. THE GitHub Actions SHALL запустить миграции Prisma и сиды перед этапом test с использованием тестовой базы данных.

### Requirement 4: Управление секретами через .env

**User Story:** Как разработчик, я хочу файл .env.example со всеми переменными окружения и запрет на хардкод секретов, чтобы секреты не попадали в репозиторий.

#### Acceptance Criteria

1. THE Монорепозиторий SHALL содержать .env.example в корне со всеми переменными окружения, необходимыми для API, Веб-клиента и docker-compose.
2. THE .env.example SHALL включать переменные для подключения к PostgreSQL, Redis, MinIO, Google OAuth (client_id, client_secret), Cloudflare Turnstile (site_key, secret_key) и SMS-провайдеров.
3. THE .env.example SHALL содержать значения-заглушки, а не реальные секреты.
4. THE Монорепозиторий SHALL содержать .gitignore, исключающий .env и файлы с реальными секретами из контроля версий.
5. THE API и Веб-клиент SHALL загружать секреты исключительно из переменных окружения, а не из строковых литералов в исходном коде.

### Requirement 5: Prisma-схема — таблицы пользователей и авторизации

**User Story:** Как бэкенд-разработчик, я хочу Prisma-схему с таблицами users, otp_codes, refresh_tokens, consents и blocked_identities, чтобы поддержать систему авторизации с двумя способами входа и хранение согласий.

#### Acceptance Criteria

1. THE Prisma SHALL содержать модель users с полями: id (uuid PK), phone (varchar, nullable, уникальность только по непустым значениям), phone_verified_at, email (nullable, unique), google_id (nullable, unique), full_name, avatar_url, role (enum client/master/admin/owner, по умолчанию client), locale (по умолчанию ru), consent_pd_at, consent_ai_at, is_blocked, telegram_chat_id, signup_ip (inet), deleted_at.
2. THE Prisma SHALL содержать модель otp_codes с полями: id, phone, code_hash, expires_at (TTL 5 минут), attempts (максимум 5), consumed_at, ip.
3. THE Prisma SHALL содержать модель refresh_tokens с полями: id, user_id (FK), token_hash, user_agent, ip, expires_at, revoked_at.
4. THE Prisma SHALL содержать модель consents с полями: id, user_id (FK), type (personal_data или biometric_ai), text_version, text_hash, ip, user_agent, created_at, revoked_at.
5. THE Prisma SHALL содержать модель blocked_identities с полями: id, identity_hash (unique), type (google или phone), reason (account_deleted, abuse или manual), created_at.
6. WHEN пользователь создаётся через Google без указания телефона, THE Prisma SHALL позволять записать NULL в поле phone.
7. THE Prisma SHALL обеспечивать, что у каждого пользователя есть хотя бы один способ входа: поле phone или поле google_id заполнено.

### Requirement 6: Prisma-схема — каталог, расписание и записи

**User Story:** Как бэкенд-разработчик, я хочу Prisma-схему с таблицами каталога услуг, расписания мастеров и записей, чтобы заложить структуру данных для будущих этапов разработки (публичные страницы и онлайн-запись).

#### Acceptance Criteria

1. THE Prisma SHALL содержать модель masters с полями: id, user_id (FK, nullable), slug (unique), name, rank (enum chief/top/senior/barber), bio, experience_years, photo_url, specialties (text[]), rating (numeric(2,1)), is_active, sort_order.
2. THE Prisma SHALL содержать модели service_categories, services (base_price numeric(10,0)), master_services (PK master_id и service_id, price_override, duration_override), working_hours, time_off, gallery_items и salon_settings.
3. THE Prisma SHALL содержать модель bookings с полями: id, user_id, master_id, starts_at, ends_at, status (enum pending/confirmed/completed/cancelled_by_client/cancelled_by_salon/no_show), total_price (numeric(10,0)), total_duration_min, client_comment, ai_generation_id (FK, nullable), source (enum web/admin/telegram), cancelled_at, cancel_reason, reminder_24h_sent_at, reminder_2h_sent_at, confirmed_by (FK, nullable), deleted_at.
4. THE Prisma SHALL содержать модель booking_items с полями: id, booking_id (FK), service_id (FK), price, duration_min.
5. THE Prisma SHALL содержать модель reviews с полями: id, booking_id (FK, unique), user_id, master_id, rating (1–5), text, is_published.
6. THE Prisma SHALL хранить все денежные суммы в сомах (KGS) как целые числа в полях типа numeric(10,0).
7. THE Prisma SHALL хранить все временные метки в UTC; часовой пояс салона Asia/Bishkek SHALL храниться в salon_settings.

### Requirement 7: Prisma-схема — ИИ-таблицы

**User Story:** Как бэкенд-разработчик, я хочу Prisma-схему с ИИ-таблицами, чтобы заложить структуру данных для ИИ-модуля «Виртуальное зеркало», который будет реализован в будущих этапах.

#### Acceptance Criteria

1. THE Prisma SHALL содержать модель ai_quotas с полями: user_id (PK и FK, связь 1:1 с users), free_limit (smallint, по умолчанию 3), used_count (smallint), bonus_count (smallint), updated_at; с CHECK-ограничением used_count >= 0 AND used_count <= free_limit + bonus_count.
2. THE Prisma SHALL содержать модели ai_photos, hair_styles, ai_generations (с полем result_expires_at), ai_quota_ledger, ai_budget (одна строка с полями budget_usd, spent_usd, reserved_usd, est_cost_usd, hourly_cap, daily_cap, kill_switch, kill_reason), ai_abuse_log.
3. THE Prisma SHALL обеспечивать уникальность ai_generations по полю idempotency_key.
4. THE Prisma SHALL обеспечивать уникальность кэша ИИ-генераций по комбинации sha256 фото, style_id и model_version.

### Requirement 8: Защита от двойного бронирования на уровне БД

**User Story:** Как бэкенд-разработчик, я хочу ограничение исключения (exclusion constraint) на уровне БД, чтобы гарантировать невозможность двойного бронирования одного слота одним мастером.

#### Acceptance Criteria

1. THE Prisma SHALL создать миграцию, включающую расширение btree_gist.
2. THE Prisma SHALL создать ограничение no_overlap на таблице bookings, исключающее пересечение временных диапазонов (tstzrange от starts_at до ends_at) для одного master_id, где status IN ('pending', 'confirmed').
3. IF два запроса пытаются создать бронирование с пересекающимся временным диапазоном для одного мастера, THEN THE PostgreSQL SHALL отклонить второй запрос с ошибкой нарушения ограничения no_overlap.

### Requirement 9: Сиды базы данных

**User Story:** Как разработчик, я хочу сиды базы данных с демо-данными, чтобы сразу после настройки локальной среды иметь категории, услуги, мастеров и стили для разработки и тестирования.

#### Acceptance Criteria

1. WHEN выполняется команда прогона сидов, THE Prisma SHALL создать категории услуг (Стрижки, Бритьё, Борода, Комплексные услуги, Уход/Детям) в таблице service_categories.
2. THE Prisma SHALL создать от 10 до 15 демо-услуг в таблице services с ценами в сомах (KGS), представленными целыми числами.
3. THE Prisma SHALL создать 3 мастера в таблице masters с разными рангами (chief, top, barber) и заполненными записями working_hours.
4. THE Prisma SHALL создать 12 заглушек в таблице hair_styles с типами haircut, beard и combo.
5. THE Prisma SHALL заполнить salon_settings значениями по умолчанию: timezone = Asia/Bishkek, slot_step_min, cancel_window_hours, booking_horizon_days, soft_lock_minutes, ai_free_limit = 3, ai_provider.

### Requirement 10: Валидация и нормализация номера телефона

**User Story:** Как разработчик, я хочу общую функцию нормализации и валидации номера телефона в packages/shared, чтобы все части проекта использовали единый формат E.164 и единые правила проверки.

#### Acceptance Criteria

1. WHEN вводится номер в форматах 0555123456, 996555123456 или +996 555 12 34 56, THE packages/shared SHALL нормализовать номер в формат E.164 (+996555123456).
2. THE packages/shared SHALL валидировать нормализованный номер по регулярному выражению ^[+]996[0-9]{9}$.
3. IF вводится номер, не соответствующий формату Кыргызстана (не 9 цифр после кода страны, стационарный номер, недопустимый код оператора), THEN THE packages/shared SHALL вернуть ошибку валидации.
4. THE packages/shared SHALL обеспечивать идемпотентность нормализации: повторная нормализация уже нормализованного номера возвращает тот же результат.
5. THE packages/shared SHALL обеспечивать, что все эквивалентные входные записи номера (0555123456, 996555123456, +996 555 12 34 56) нормализуются в одинаковый результат в формате E.164.
6. THE packages/shared SHALL предоставлять Zod-схему для валидации номера телефона, которую используют как API, так и Веб-клиент.

### Requirement 11: Интерфейс SMS-провайдеров

**User Story:** Как бэкенд-разработчик, я хочу интерфейс SmsProvider с реализацией MockSmsProvider и заготовками под Smspro.kg и СМС-ЦЕНТР, чтобы иметь возможность отправлять OTP-коды в разработке и подготовить интеграцию с реальными провайдерами.

#### Acceptance Criteria

1. THE API SHALL определять интерфейс SmsProvider с методом send, принимающим номер получателя и текст сообщения.
2. WHERE активный провайдер — MockSmsProvider, THE MockSmsProvider SHALL выводить OTP-код в лог сервера вместо отправки реального SMS.
3. THE API SHALL содержать заготовки реализаций SmsproProvider и SmsCenterProvider, реализующие интерфейс SmsProvider, но выбрасывающие ошибку NotImplementedError до полной интеграции.
4. WHERE провайдер меняется через переменную окружения, THE API SHALL переключать активную реализацию SmsProvider без изменения исходного кода.
5. THE API SHALL регистрировать SmsProvider через механизм dependency injection NestJS.

### Requirement 12: Генерация, хранение и лимиты OTP

**User Story:** Как бэкенд-разработчик, я хочу систему OTP-кодов с лимитами отправки и проверкой, чтобы защититься от злоупотреблений и подтвердить номер телефона пользователя.

#### Acceptance Criteria

1. WHEN пользователь запрашивает OTP, THE API SHALL сгенерировать 6-значный код, сохранить только хэш кода в таблице otp_codes с TTL 5 минут и отправить код через SmsProvider.
2. THE API SHALL ограничивать отправку OTP не более 3 раз в час и не более 5 раз в сутки на один номер телефона.
3. THE API SHALL ограничивать отправку OTP не более 5 раз в сутки на один IP-адрес.
4. IF с момента последней отправки OTP прошло менее 60 секунд, THEN THE API SHALL отклонить запрос на повторную отправку.
5. WHEN пользователь вводит OTP-код, THE API SHALL сверить хэш введённого кода с сохранённым хэшем, уменьшить счётчик attempts и отметить код как consumed при совпадении.
6. IF введён неверный OTP-код, THEN THE API SHALL увеличить счётчик attempts и отклонить проверку до достижения 5 попыток.
7. WHEN счётчик attempts достигает 5, THE API SHALL отклонять любые дальнейшие попытки ввода для данного кода.
8. WHEN OTP-код подтверждён, THE API SHALL записать phone_verified_at в таблице users.
9. THE API SHALL хранить в таблице otp_codes только хэш OTP-кода, а не сам код.

### Requirement 13: Авторизация через Google OAuth 2.0

**User Story:** Как пользователь, я хочу войти через Google OAuth 2.0, чтобы быстро и безопасно авторизоваться без ввода номера телефона.

#### Acceptance Criteria

1. WHEN пользователь нажимает кнопку «Войти через Google» на странице /auth, THE Веб-клиент SHALL перенаправить пользователя на страницу авторизации Google OAuth 2.0.
2. WHEN Google возвращает токен с email_verified = true, THE API SHALL создать или найти пользователя по google_id и выдать JWT и refresh-токен.
3. IF Google-аккаунт имеет email_verified = false, THEN THE API SHALL отклонить вход с сообщением о необходимости подтверждения email.
4. WHEN новый пользователь входит через Google, THE API SHALL создать запись в users с google_id, email и role = client.
5. WHEN новый пользователь регистрируется через Google или SMS-OTP, THE API SHALL автоматически создать запись в ai_quotas с free_limit = 3, used_count = 0 и bonus_count = 0.

### Requirement 14: JWT access-токен и refresh-токен с ротацией

**User Story:** Как бэкенд-разработчик, я хочу систему JWT access-токенов (15 минут) и refresh-токенов с ротацией в httpOnly cookie, чтобы обеспечить безопасную аутентификацию и обновление сессии.

#### Acceptance Criteria

1. WHEN пользователь успешно входит, THE API SHALL выдать JWT access-токен сроком 15 минут и refresh-токен, сохранённый в httpOnly, Secure, SameSite cookie.
2. THE API SHALL хранить в базе данных только хэш refresh-токена, а не сам токен.
3. WHEN клиент обращается к защищённому эндпоинту с истёкшим access-токеном, THE API SHALL принять refresh-токен из cookie, проверить хэш в базе и выдать новый access-токен и новый refresh-токен.
4. WHEN refresh-токен используется для получения нового access-токена, THE API SHALL отозвать старый refresh-токен (записать revoked_at) и создать новый refresh-токен.
5. IF использованный refresh-токен уже помечен как отозванный (revoked_at заполнено), THEN THE API SHALL отклонить запрос и отозвать все refresh-токены этого пользователя.
6. THE API SHALL обеспечивать, что каждый успешный refresh создаёт новый refresh-токен, отличающийся от использованного.
7. WHEN пользователь выходит, THE API SHALL отозвать текущий refresh-токен и очистить cookie.

### Requirement 15: Cloudflare Turnstile Guard

**User Story:** Как бэкенд-разработчик, я хочу переиспользуемый NestJS guard для проверки Cloudflare Turnstile, чтобы защитить чувствительные эндпоинты (отправка OTP, вход) от ботов.

#### Acceptance Criteria

1. THE API SHALL содержать переиспользуемый Turnstile_Guard, проверяющий токен Turnstile через Cloudflare siteverify.
2. IF запрос к защищённому эндпоинту не содержит валидный токен Turnstile, THEN THE Turnstile_Guard SHALL отклонить запрос с кодом 403 и сообщением CAPTCHA_FAILED.
3. WHERE Turnstile отключён через переменную окружения в режиме разработки, THE Turnstile_Guard SHALL пропускать запросы без проверки токена.
4. THE Turnstile_Guard SHALL быть применимым к любому эндпоинту через декоратор без дублирования логики проверки.

### Requirement 16: Роли и RolesGuard

**User Story:** Как бэкенд-разработчик, я хочу ролевую модель (client/master/admin/owner) и RolesGuard, чтобы ограничивать доступ к эндпоинтам по ролям пользователя.

#### Acceptance Criteria

1. THE API SHALL определять роли client, master, admin и owner в enum.
2. THE API SHALL содержать RolesGuard, проверяющий, что роль пользователя в JWT совпадает с одной из ролей, заданных декоратором на эндпоинте.
3. IF пользователь с ролью client обращается к эндпоинту, требующему роль admin, THEN THE RolesGuard SHALL отклонить запрос с кодом 403.
4. THE API SHALL позволять задавать требуемые роли через декоратор @Roles() на любом эндпоинте.

### Requirement 17: Дизайн-токены, шрифты и базовые UI-компоненты

**User Story:** Как фронтенд-разработчик, я хочу дизайн-систему с токенами, self-hosted шрифтами и набором базовых компонентов, чтобы обеспечить единый премиальный визуальный стиль на всех страницах.

#### Acceptance Criteria

1. THE Веб-клиент SHALL определять дизайн-токены в CSS-переменных: --bg-primary (#0A0A0A), --bg-elevated (#141414 и #1C1C1C), --gold-500 (#C9A24B), --gold-gradient, --text-primary (#FFFFFF), --text-secondary (#B8B8B8), --error (#E5484D), --success (#3FB950).
2. THE Веб-клиент SHALL загружать self-hosted шрифты: serif (Playfair Display или Cormorant Garamond) для заголовков и гротеск (Inter или Manrope) для текста, с font-display: swap и subset кириллица + латиница.
3. THE Веб-клиент SHALL применять шкалу отступов 4/8 px, радиусы 2–4 px и минимальную touch-зону 44×44 px.
4. THE Веб-клиент SHALL содержать базовые компоненты: кнопки (primary-gold, secondary-outline, text), input, чипы фильтров, карточка, модалка, тост и скелетон.
5. THE Веб-клиент SHALL использовать Tailwind CSS и shadcn/ui (Radix) как основу компонентов.
6. WHERE включён prefers-reduced-motion, THE Веб-клиент SHALL отключать или упрощать анимации.

### Requirement 18: Страница авторизации /auth

**User Story:** Как пользователь, я хочу страницу входа /auth с кнопкой Google и формой телефона/OTP, чтобы авторизоваться в системе.

#### Acceptance Criteria

1. THE Веб-клиент SHALL отображать на странице /auth кнопку «Войти через Google» первой по порядку отображения.
2. THE Веб-клиент SHALL отображать форму ввода номера телефона с маской и валидацией формата +996 и 9 цифр.
3. WHEN пользователь вводит номер и нажимает «Отправить код», THE Веб-клиент SHALL отправить запрос на API с токеном Turnstile и номером телефона.
4. WHEN API принимает номер, THE Веб-клиент SHALL показать поле ввода OTP-кода с атрибутом autocomplete="one-time-code" и таймером повторной отправки 60 секунд.
5. WHEN пользователь вводит корректный OTP-код, THE Веб-клиент SHALL перенаправить пользователя на страницу /account.
6. IF API отклоняет OTP-код, THEN THE Веб-клиент SHALL показать сообщение об ошибке и количество оставшихся попыток.
7. THE Веб-клиент SHALL отображать чекбоксы согласий (политика конфиденциальности, обработка персональных данных) перед отправкой формы.
8. THE Веб-клиент SHALL помещать весь контент страницы /auth в область видимости без горизонтального скролла на ширине от 360 px.

### Requirement 19: Защищённый маршрут /account (заглушка)

**User Story:** Как пользователь, я хочу защищённый личный кабинет /account, чтобы видеть подтверждение авторизации и иметь доступ только после входа.

#### Acceptance Criteria

1. WHEN неавторизованный пользователь открывает /account, THE Веб-клиент SHALL перенаправить пользователя на страницу /auth.
2. WHEN авторизованный пользователь открывает /account, THE Веб-клиент SHALL отобразить заглушку с приветствием и именем пользователя.
3. THE Веб-клиент SHALL проверять наличие валидного access-токена перед отображением страницы /account.

### Requirement 20: Функция форматирования цен formatKgs

**User Story:** Как разработчик, я хочу функцию formatKgs в packages/shared, чтобы все части проекта единообразно отображали цены в сомах.

#### Acceptance Criteria

1. WHEN передано целое число, THE formatKgs SHALL вернуть строку в формате «N сом» с разделением тысяч пробелом (например, 1200 возвращает «1 200 сом»).
2. THE formatKgs SHALL корректно форматировать целые числа в диапазоне от 0 до 99999999 без потери точности.
3. THE packages/shared SHALL экспортировать formatKgs для использования как в API, так и в Веб-клиенте.
4. IF в formatKgs передано нецелое значение, THEN THE formatKgs SHALL отклонить входное значение.

### Requirement 21: Юнит-тесты нормализации и валидации номера телефона

**User Story:** Как разработчик, я хочу юнит-тесты для нормализации и валидации номера телефона, чтобы гарантировать корректность обработки всех допустимых форматов ввода.

#### Acceptance Criteria

1. THE Набор_тестов SHALL проверять, что форматы 0555123456, 996555123456 и +996 555 12 34 56 нормализуются в +996555123456.
2. THE Набор_тестов SHALL проверять, что номера с лишними пробелами, скобками и дефисами нормализуются в формат E.164.
3. THE Набор_тестов SHALL проверять идемпотентность нормализации: повторная нормализация не изменяет результат.
4. THE Набор_тестов SHALL проверять, что невалидные номера (не 9 цифр, стационарный номер, недопустимый код оператора) возвращают ошибку валидации.
5. THE Набор_тестов SHALL использовать property-based testing для проверки идемпотентности и round-trip свойства нормализации.

### Requirement 22: Юнит-тесты лимитов OTP

**User Story:** Как разработчик, я хочу юнит-тесты для OTP-лимитов, чтобы гарантировать, что лимиты отправки и проверки работают корректно и не пропускают злоупотребления.

#### Acceptance Criteria

1. THE Набор_тестов SHALL проверять, что 4-я отправка OTP в течение часа на тот же номер отклоняется.
2. THE Набор_тестов SHALL проверять, что 6-я отправка OTP в течение суток на тот же номер отклоняется.
3. THE Набор_тестов SHALL проверять, что 6-я отправка OTP в течение суток с того же IP-адреса отклоняется.
4. THE Набор_тестов SHALL проверять, что повторная отправка OTP ранее 60 секунд после предыдущей отклоняется.
5. THE Набор_тестов SHALL проверять, что 6-я попытка ввода OTP-кода отклоняется.
6. THE Набор_тестов SHALL проверять, что успешная проверка OTP отмечает код как consumed и записывает phone_verified_at.

### Requirement 23: Юнит-тесты ротации refresh-токенов

**User Story:** Как разработчик, я хочу юнит-тесты для ротации refresh-токенов, чтобы гарантировать, что старый токен отзывается, а повторное использование отозванного токена аннулирует все сессии.

#### Acceptance Criteria

1. THE Набор_тестов SHALL проверять, что при обновлении access-токена старый refresh-токен помечается как отозванный (revoked_at заполнено).
2. THE Набор_тестов SHALL проверять, что при обновлении создаётся новый refresh-токен, отличающийся от использованного.
3. THE Набор_тестов SHALL проверять, что повторное использование отозванного refresh-токена отклоняется и отзывает все refresh-токены пользователя.
4. THE Набор_тестов SHALL проверять, что выход из системы отзывает текущий refresh-токен и очищает cookie.
5. THE Набор_тестов SHALL проверять, что в базе данных хранится только хэш refresh-токена, а не сам токен.

### Requirement 24: E2E-тест входа через Mock SMS

**User Story:** Как разработчик, я хочу сквозной тест входа через Mock SMS, чтобы убедиться, что полный цикл авторизации по телефону работает от ввода номера до попадания в /account.

#### Acceptance Criteria

1. THE E2E-тест SHALL открыть страницу /auth, ввести валидный номер телефона и нажать кнопку «Отправить код».
2. THE E2E-тест SHALL прочитать OTP-код из логов MockSmsProvider.
3. THE E2E-тест SHALL ввести OTP-код в поле ввода и проверить, что пользователь перенаправлен на страницу /account.
4. THE E2E-тест SHALL использовать Playwright в качестве тестового фреймворка.
5. THE E2E-тест SHALL выполняться в среде с MockSmsProvider в качестве активного SMS-провайдера.
