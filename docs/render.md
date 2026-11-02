# Деплой BARS на Render

В корне репозитория есть `render.yaml` с двумя Node.js Web Services:

- `bars-api` — NestJS API, применяет Prisma-миграции при запуске и проверяет доступность через `/api/health`.
- `bars-web` — Next.js с серверным рендерингом.

Blueprint использует корень репозитория для обеих служб: это необходимо, чтобы pnpm видел workspace и `packages/shared`. API использует постоянный диск `/opt/render/project/src/storage` для приватных фото и результатов ИИ. Службе API нужен платный план Render, поддерживающий persistent disk; диск ограничивает сервис одним экземпляром.

## Перед первым деплоем

1. Запушьте репозиторий в Git-провайдер, подключённый к Render, затем создайте Blueprint из `render.yaml`.
2. Подготовьте PostgreSQL с поддержкой Prisma и задайте `DATABASE_URL` и `DIRECT_URL` в `bars-api`. Для внешней БД укажите pooled URL в `DATABASE_URL` и прямой URL в `DIRECT_URL`; если провайдер не использует пулер, обе переменные могут содержать один URL.
3. В `bars-api` задайте `CORS_ORIGIN` равным origin сайта, например `https://bars-web.onrender.com`, и `API_PUBLIC_URL` равным публичному URL API, например `https://bars-api.onrender.com`. Указывайте только origin без завершающего `/`.
4. В `bars-web` задайте `NEXT_PUBLIC_API_URL` равным `API_PUBLIC_URL`, а `NEXT_PUBLIC_SITE_URL` — публичному URL сайта. Эти переменные нужны уже на этапе сборки фронтенда.
5. Заполните `ADMIN_EMAILS` в `bars-api`, чтобы выдать учётной записи владельца роль для `/admin`.
6. После первого создания служб проверьте Render Deploy logs и `https://<bars-api-url>/api/health`.
7. После первой миграции заполните каталог начальными данными один раз командой `pnpm --filter @barbershop/api exec tsx prisma/seed.ts` из Shell службы API.
8. Перед запуском замените демонстрационные телефон, адрес, соцсети и координаты в `frontend/src/lib/brand.ts`; укажите юридические реквизиты вместо заглушек в `/privacy`, `/terms` и `/ai-consent`.

Blueprint генерирует `JWT_SECRET` и `STORAGE_SIGNING_SECRET`. Не копируйте секреты из локального `.env` в репозиторий или Blueprint.

## Дополнительные интеграции

- Для входа через Google задайте Firebase-переменные `NEXT_PUBLIC_FIREBASE_*` в `bars-web`, а `FIREBASE_PROJECT_ID` (и, если требуется сервисному аккаунту, `FIREBASE_CLIENT_EMAIL` и `FIREBASE_PRIVATE_KEY`) в `bars-api`. Добавьте URL сайта в Firebase Authorized domains.
- Для проверки Cloudflare Turnstile задайте `NEXT_PUBLIC_TURNSTILE_SITE_KEY` в `bars-web` и `TURNSTILE_SECRET_KEY` в `bars-api`.
- Для генерации изображений задайте `GEMINI_API_KEY` и `AI_PROVIDER=gemini`; без ключа Blueprint оставляет демонстрационный `AI_PROVIDER=mock`.
- Для Telegram уведомлений задайте `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_CHAT_ID` и `PUBLIC_SITE_URL` в `bars-api`.
- `REDIS_URL` необязателен. Без Redis фоновые задачи выполняются в процессе API, а временное хранилище и лимиты не разделяются между экземплярами.

## Важное про хранилище

Локальные файлы API находятся на диске Render, поэтому этот сервис должен оставаться одним экземпляром. Для масштабирования API вынесите файлы в S3/R2 и настройте отдельное общее хранилище. Сделайте резервную копию диска независимо от базы данных.

## Локальная проверка перед публикацией

Из корня монорепозитория:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

Затем запустите миграции для целевой БД через `pnpm db:deploy`. Команда удалённой миграции не нужна до того, как `DATABASE_URL` и `DIRECT_URL` настроены в Render.
