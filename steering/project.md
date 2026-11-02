# Проект: премиальный сайт барбершопа (Кыргызстан) с ИИ-примеркой причёсок

Полное ТЗ: #[[file:docs/tz_barbershop.md]] — источник истины. При конфликте с моими
решениями в спеках приоритет у ТЗ; о противоречиях сообщай явно.

## Стек (не менять без согласования)
- Монорепозиторий (pnpm workspaces): frontend (Next.js 14+ App Router, TypeScript),
  backend (NestJS, TypeScript), packages/shared (Zod-схемы, типы, formatKgs()).
- UI: Tailwind CSS + shadcn/ui (Radix), анимации: Framer Motion + GSAP, форма: React Hook Form + Zod.
- Данные: PostgreSQL 15 + Prisma, Redis + BullMQ, S3-совместимое хранилище (R2/S3).
- Авторизация: Google OAuth 2.0 + SMS-OTP через интерфейс SmsProvider (Smspro.kg / СМС-ЦЕНТР).
- ИИ: интерфейс AiProvider (реализации FalProvider, HairApiProvider, HfProvider + MockProvider для dev).
- Локальная среда: docker-compose (postgres, redis, minio).

## Жёсткие правила
- Mobile-first (360×800 → 390 → 768 → 1280+), никакого горизонтального скролла, iOS Safari: 100dvh и safe-area.
- Палитра: #0A0A0A, золото #C9A24B (≤10–15% площади), белый. Токены в CSS-переменных.
- Все цены — в сомах (KGS), целые числа, вывод через formatKgs() → «1 200 сом».
- Часовой пояс салона Asia/Bishkek, в БД всё в UTC.
- Телефон только формата +996 + 9 цифр (E.164), валидация в packages/shared.
- Лимиты ИИ, антифрод и бюджет проверяются ТОЛЬКО на сервере, атомарно (SQL UPDATE ... WHERE).
- Фото клиентов: приватный S3, подписанные URL, автоудаление: исходники 7 дней, результаты 14 дней.
- Секреты только через .env (.env.example в репозитории), ничего не хардкодить.
- Уважать prefers-reduced-motion, WCAG 2.1 AA.

## Качество
- TypeScript strict, ESLint + Prettier, Vitest/Jest для логики (особенно квоты, слоты, бюджет),
  Playwright для ключевых сценариев (запись, вход, ИИ-лимит).
- Каждая задача завершается: типы проходят, линт чист, тесты зелёные, README/docs обновлены.
- Коммиты небольшие и осмысленные (conventional commits).