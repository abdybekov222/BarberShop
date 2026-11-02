-- Собственная авторизация (email + пароль, JWT): Firebase UID становится необязательным
ALTER TABLE "users" ALTER COLUMN "firebase_uid" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
