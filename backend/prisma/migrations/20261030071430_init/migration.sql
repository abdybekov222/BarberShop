-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('client', 'master', 'admin', 'owner');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('personal_data', 'biometric_ai');

-- CreateEnum
CREATE TYPE "BlockedIdentityType" AS ENUM ('google', 'phone');

-- CreateEnum
CREATE TYPE "BlockedReason" AS ENUM ('account_deleted', 'abuse', 'manual');

-- CreateEnum
CREATE TYPE "MasterRank" AS ENUM ('chief', 'top', 'senior', 'barber');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'completed', 'cancelled_by_client', 'cancelled_by_salon', 'no_show');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('web', 'admin', 'telegram');

-- CreateEnum
CREATE TYPE "AiPhotoStatus" AS ENUM ('uploaded', 'validating', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "AiPhotoRejectReason" AS ENUM ('no_face', 'multiple_faces', 'bad_angle', 'low_resolution', 'nsfw', 'too_large');

-- CreateEnum
CREATE TYPE "HairStyleType" AS ENUM ('haircut', 'beard', 'combo');

-- CreateEnum
CREATE TYPE "AiGenerationStatus" AS ENUM ('queued', 'processing', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('fal', 'hairapi', 'hf');

-- CreateEnum
CREATE TYPE "KillReason" AS ENUM ('manual', 'budget', 'daily_cap', 'provider_errors');

-- CreateEnum
CREATE TYPE "LedgerReason" AS ENUM ('generation', 'refund', 'admin_grant', 'promo');

-- CreateEnum
CREATE TYPE "AbuseRule" AS ENUM ('ip_accounts', 'ip_generations', 'turnstile_failed', 'cap_hour', 'cap_day');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "phone" VARCHAR(16),
    "phone_verified_at" TIMESTAMPTZ,
    "email" VARCHAR(255),
    "google_id" VARCHAR(64),
    "full_name" VARCHAR(120) NOT NULL,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'client',
    "locale" VARCHAR(5) NOT NULL DEFAULT 'ru',
    "consent_pd_at" TIMESTAMPTZ,
    "consent_ai_at" TIMESTAMPTZ,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "telegram_chat_id" BIGINT,
    "signup_ip" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "text_version" TEXT NOT NULL,
    "text_hash" TEXT NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_identities" (
    "id" UUID NOT NULL,
    "identity_hash" TEXT NOT NULL,
    "type" "BlockedIdentityType" NOT NULL,
    "reason" "BlockedReason" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "masters" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "rank" "MasterRank" NOT NULL DEFAULT 'barber',
    "bio" TEXT,
    "experience_years" INTEGER,
    "photo_url" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rating" DECIMAL(2,1),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "base_price" INTEGER NOT NULL,
    "price_is_from" BOOLEAN NOT NULL DEFAULT false,
    "duration_min" INTEGER NOT NULL,
    "is_combo" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_services" (
    "master_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "price_override" INTEGER,
    "duration_override" INTEGER,

    CONSTRAINT "master_services_pkey" PRIMARY KEY ("master_id","service_id")
);

-- CreateTable
CREATE TABLE "working_hours" (
    "id" UUID NOT NULL,
    "master_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "break_start" VARCHAR(5),
    "break_end" VARCHAR(5),

    CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_off" (
    "id" UUID NOT NULL,
    "master_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "reason" VARCHAR(120),

    CONSTRAINT "time_off_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_items" (
    "id" UUID NOT NULL,
    "master_id" UUID,
    "service_category_id" UUID,
    "style_tag" VARCHAR(80),
    "image_url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" VARCHAR(40),
    "caption" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salon_settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salon_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "master_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "total_price" INTEGER NOT NULL,
    "total_duration_min" INTEGER NOT NULL,
    "client_comment" TEXT,
    "ai_generation_id" UUID,
    "source" "BookingSource" NOT NULL DEFAULT 'web',
    "cancelled_at" TIMESTAMPTZ,
    "cancel_reason" VARCHAR(200),
    "reminder_24h_sent_at" TIMESTAMPTZ,
    "reminder_2h_sent_at" TIMESTAMPTZ,
    "confirmed_by" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_items" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "price" INTEGER NOT NULL,
    "duration_min" INTEGER NOT NULL,

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "master_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_quotas" (
    "user_id" UUID NOT NULL,
    "free_limit" INTEGER NOT NULL DEFAULT 3,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "bonus_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_quotas_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "ai_photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" "AiPhotoStatus" NOT NULL DEFAULT 'uploaded',
    "reject_reason" "AiPhotoRejectReason",
    "face_meta" JSONB,
    "sha256" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hair_styles" (
    "id" UUID NOT NULL,
    "type" "HairStyleType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "preview_url" TEXT,
    "prompt" TEXT,
    "negative_prompt" TEXT,
    "seed" INTEGER,
    "model_params" JSONB,
    "linked_service_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hair_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "style_id" UUID NOT NULL,
    "status" "AiGenerationStatus" NOT NULL DEFAULT 'queued',
    "provider" "AiProvider",
    "provider_job_id" VARCHAR(120),
    "model_version" VARCHAR(60),
    "result_key" TEXT,
    "result_expires_at" TIMESTAMPTZ,
    "quota_charged" BOOLEAN NOT NULL DEFAULT false,
    "quota_refunded_at" TIMESTAMPTZ,
    "error_code" VARCHAR(80),
    "cost_usd" DECIMAL(8,4),
    "reserved_cost_usd" DECIMAL(8,4),
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "started_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_quota_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "generation_id" UUID,
    "delta" INTEGER NOT NULL,
    "reason" "LedgerReason" NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_quota_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_budget" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "budget_usd" DECIMAL(8,2) NOT NULL DEFAULT 10,
    "spent_usd" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "reserved_usd" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "est_cost_usd" DECIMAL(8,4) NOT NULL DEFAULT 0.05,
    "hourly_cap" INTEGER NOT NULL DEFAULT 5,
    "daily_cap" INTEGER NOT NULL DEFAULT 15,
    "kill_switch" BOOLEAN NOT NULL DEFAULT false,
    "kill_reason" "KillReason",
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_abuse_log" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "ip" VARCHAR(45),
    "device_id" VARCHAR(120),
    "rule" "AbuseRule" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_abuse_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "consents_user_id_idx" ON "consents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_identities_identity_hash_key" ON "blocked_identities"("identity_hash");

-- CreateIndex
CREATE UNIQUE INDEX "masters_slug_key" ON "masters"("slug");

-- CreateIndex
CREATE INDEX "masters_user_id_idx" ON "masters"("user_id");

-- CreateIndex
CREATE INDEX "masters_is_active_sort_order_idx" ON "masters"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");

-- CreateIndex
CREATE INDEX "services_category_id_idx" ON "services"("category_id");

-- CreateIndex
CREATE INDEX "services_is_active_sort_order_idx" ON "services"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "master_services_service_id_idx" ON "master_services"("service_id");

-- CreateIndex
CREATE INDEX "working_hours_master_id_idx" ON "working_hours"("master_id");

-- CreateIndex
CREATE INDEX "time_off_master_id_idx" ON "time_off"("master_id");

-- CreateIndex
CREATE INDEX "time_off_starts_at_ends_at_idx" ON "time_off"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "gallery_items_master_id_idx" ON "gallery_items"("master_id");

-- CreateIndex
CREATE INDEX "gallery_items_service_category_id_idx" ON "gallery_items"("service_category_id");

-- CreateIndex
CREATE INDEX "gallery_items_is_published_sort_order_idx" ON "gallery_items"("is_published", "sort_order");

-- CreateIndex
CREATE INDEX "bookings_user_id_idx" ON "bookings"("user_id");

-- CreateIndex
CREATE INDEX "bookings_master_id_idx" ON "bookings"("master_id");

-- CreateIndex
CREATE INDEX "bookings_starts_at_ends_at_idx" ON "bookings"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "booking_items_booking_id_idx" ON "booking_items"("booking_id");

-- CreateIndex
CREATE INDEX "booking_items_service_id_idx" ON "booking_items"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "reviews_master_id_idx" ON "reviews"("master_id");

-- CreateIndex
CREATE INDEX "reviews_is_published_idx" ON "reviews"("is_published");

-- CreateIndex
CREATE INDEX "ai_photos_user_id_idx" ON "ai_photos"("user_id");

-- CreateIndex
CREATE INDEX "ai_photos_sha256_idx" ON "ai_photos"("sha256");

-- CreateIndex
CREATE INDEX "hair_styles_type_is_active_sort_order_idx" ON "hair_styles"("type", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "ai_generations_idempotency_key_key" ON "ai_generations"("idempotency_key");

-- CreateIndex
CREATE INDEX "ai_generations_user_id_idx" ON "ai_generations"("user_id");

-- CreateIndex
CREATE INDEX "ai_generations_photo_id_idx" ON "ai_generations"("photo_id");

-- CreateIndex
CREATE INDEX "ai_generations_style_id_idx" ON "ai_generations"("style_id");

-- CreateIndex
CREATE INDEX "ai_generations_status_idx" ON "ai_generations"("status");

-- CreateIndex
CREATE INDEX "ai_generations_status_created_at_idx" ON "ai_generations"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_quota_ledger_user_id_created_at_idx" ON "ai_quota_ledger"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_quota_ledger_generation_id_idx" ON "ai_quota_ledger"("generation_id");

-- CreateIndex
CREATE INDEX "ai_abuse_log_user_id_idx" ON "ai_abuse_log"("user_id");

-- CreateIndex
CREATE INDEX "ai_abuse_log_ip_created_at_idx" ON "ai_abuse_log"("ip", "created_at");

-- CreateIndex
CREATE INDEX "ai_abuse_log_rule_created_at_idx" ON "ai_abuse_log"("rule", "created_at");

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "masters" ADD CONSTRAINT "masters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_services" ADD CONSTRAINT "master_services_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_services" ADD CONSTRAINT "master_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_quotas" ADD CONSTRAINT "ai_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_photos" ADD CONSTRAINT "ai_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hair_styles" ADD CONSTRAINT "hair_styles_linked_service_id_fkey" FOREIGN KEY ("linked_service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "ai_photos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "hair_styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_quota_ledger" ADD CONSTRAINT "ai_quota_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_quota_ledger" ADD CONSTRAINT "ai_quota_ledger_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
