# Развёртывание

Основной способ размещения проекта — Render. Пошаговая настройка Blueprint, окружения и интеграций описана в [render.md](render.md).

## API через Docker

Из корня монорепозитория:

```bash
docker build -f backend/Dockerfile -t barbershop-api .
docker run -d --name barbershop-api --restart unless-stopped \
  --env-file backend/.env -e NODE_ENV=production \
  -p 3001:3001 -v barbershop-storage:/app/backend/storage \
  barbershop-api
```

Для самостоятельного хостинга настройте PostgreSQL, `DATABASE_URL`, `DIRECT_URL`, `CORS_ORIGIN`, `API_PUBLIC_URL`, `JWT_SECRET` и `STORAGE_SIGNING_SECRET`. Миграции Prisma запускаются при старте контейнера. Постоянный том для `/app/backend/storage` нужен, чтобы сохранённые фото не терялись при пересоздании контейнера.
