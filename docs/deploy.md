# Деплой

Схема из ТЗ §1.4: **web → Vercel**, **API → Docker на VPS / Railway / Fly.io**,
PostgreSQL — Neon (уже настроен), Redis — Upstash / Railway (опционально).

## 1. API (Docker)

```bash
# из корня репозитория
docker build -f backend/Dockerfile -t barbershop-api .
docker run -d --name barbershop-api --restart unless-stopped \
  --env-file backend/.env -e NODE_ENV=production \
  -p 3001:3001 -v barbershop-storage:/app/backend/storage \
  barbershop-api
```

Миграции (`prisma migrate deploy`) применяются автоматически при старте контейнера.
Том `barbershop-storage` хранит приватные фото клиентов — без него фото пропадут при пересоздании контейнера.

Обязательно в `.env` для продакшена:

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | pooled-строка Neon, `connection_limit=5` |
| `DIRECT_URL` | прямая строка Neon (для миграций) |
| `CORS_ORIGIN` | домен сайта, например `https://barbershop.kg` |
| `API_PUBLIC_URL` | публичный адрес API, например `https://api.barbershop.kg` |
| `STORAGE_SIGNING_SECRET` | длинная случайная строка |
| `ADMIN_EMAILS` | email владельца |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_CHAT_ID` | уведомления о записях и алерты |
| `TURNSTILE_SECRET_KEY` | секрет Cloudflare Turnstile |
| `REDIS_URL` | желательно: очередь ИИ, soft-lock, лимит по IP |

Перед API поставьте HTTPS-прокси (Caddy / nginx / Cloudflare). Заголовки `CF-Connecting-IP`
/ `X-Forwarded-For` используются для лимитов по IP — **не открывайте порт 3001 наружу напрямую**.

## 2. Web (Vercel)

1. Импортируйте репозиторий, **Root Directory** — `frontend`.
2. Install Command: `cd .. && corepack enable && pnpm install --frozen-lockfile`.
3. Build Command: `cd .. && pnpm --filter @barbershop/shared build && pnpm --filter @barbershop/web build`.
4. Переменные окружения: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`,
   `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
5. В Firebase Console → Authentication → Settings → **Authorized domains** добавьте домен сайта.

## 3. Telegram-бот

1. Создайте бота у [@BotFather](https://t.me/BotFather), получите токен → `TELEGRAM_BOT_TOKEN`.
2. Напишите боту любое сообщение, затем откройте
   `https://api.telegram.org/bot<токен>/getUpdates` — `chat.id` → `TELEGRAM_OWNER_CHAT_ID`.

Владелец получает: новые записи (с телефоном клиента), отмены, сводки «кому напомнить»
за 24 ч и за 2 ч, сообщения из формы «Контакты», алерты бюджета ИИ 50/80/100%.

## 4. Чек-лист перед запуском

- [ ] Свой email в `ADMIN_EMAILS`, вход на сайт → доступ к `/admin`.
- [ ] В админке: проверить цены услуг, расписание мастеров, лимиты ИИ.
- [ ] Реальные фото мастеров и галереи (сейчас — плейсхолдеры из сидов).
- [ ] Реквизиты оператора в `/privacy`, `/terms`, `/ai-consent` («[Наименование ИП / ООО]»).
- [ ] Адрес, телефон, мессенджеры в `contacts/page.tsx`, `layout.tsx` (schema.org), `SALON_ADDRESS`.
- [ ] Согласовать с юристом трансграничную передачу фото (ТЗ §1.5).
- [ ] `AI_PROVIDER`: сейчас `mock` (демо-обработка без ИИ) — выбрать провайдера по итогам R&D.
