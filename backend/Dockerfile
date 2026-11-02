# API барбершопа (NestJS). Сборка из корня монорепозитория:
#   docker build -f backend/Dockerfile -t barbershop-api .
#   docker run --env-file backend/.env -p 3001:3001 -v barbershop-storage:/app/backend/storage barbershop-api

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --filter @barbershop/api... --ignore-scripts
COPY packages/shared packages/shared
COPY backend backend
RUN pnpm --filter @barbershop/shared build \
 && pnpm --filter @barbershop/api exec prisma generate \
 && pnpm --filter @barbershop/api build \
 && pnpm deploy --filter @barbershop/api --prod /out \
 && cp -r backend/dist backend/prisma /out/ \
 && cd /out && npx prisma generate

FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
ENV NODE_ENV=production STORAGE_DIR=/app/backend/storage
COPY --from=build /out ./
RUN mkdir -p storage && chown -R node:node /app
USER node
EXPOSE 3001
# Миграции применяются при старте (идемпотентно), затем запускается API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
