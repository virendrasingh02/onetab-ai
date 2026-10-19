-- Location, website, GitHub handle and cover image were accepted by the
-- profile form but never stored.
ALTER TABLE "users" ADD COLUMN "location" TEXT;
ALTER TABLE "users" ADD COLUMN "website" TEXT;
ALTER TABLE "users" ADD COLUMN "github" TEXT;
ALTER TABLE "users" ADD COLUMN "coverUrl" TEXT;
