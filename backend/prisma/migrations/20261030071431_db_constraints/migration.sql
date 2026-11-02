-- Ограничения, которые Prisma не выражает декларативно.

-- Расширение для поддержки исключения по диапазонам времени и uuid.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Защита от двойного бронирования (ТЗ §3.3 / barbershop_db_schema.md §5):
-- у одного мастера не могут пересекаться временные диапазоны активных записей.
ALTER TABLE "bookings"
  ADD CONSTRAINT "no_overlap"
  EXCLUDE USING gist (
    "master_id" WITH =,
    tstzrange("starts_at", "ends_at") WITH &&
  ) WHERE ("status" IN ('pending', 'confirmed'));

-- Целостность квоты ИИ: нельзя списать больше, чем доступно (ТЗ §3.4).
ALTER TABLE "ai_quotas"
  ADD CONSTRAINT "ai_quotas_used_count_check"
  CHECK ("used_count" >= 0 AND "used_count" <= "free_limit" + "bonus_count");
