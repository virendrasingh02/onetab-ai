-- Slice D — Scheduled status multi-queue (brief §9).
--
-- Hand-written (see 20260908101946): `prisma migrate dev` still folds in the
-- un-migrated compliance drift + an invalid `searchVector DROP DEFAULT`. Every
-- statement here is guarded so a re-apply is a no-op.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ScheduledStatusRecurrence" AS ENUM ('ONE_TIME', 'DAILY', 'WEEKDAYS', 'WEEKLY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable — track which scheduled entry currently drives the user's status.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "scheduledStatusAppliedId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "scheduled_statuses" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "statusText"  TEXT NOT NULL,
  "statusEmoji" TEXT,
  "presence"    "PresenceStatus",
  "isEnabled"   BOOLEAN NOT NULL DEFAULT true,
  "priority"    INTEGER NOT NULL DEFAULT 0,
  "recurrence"  "ScheduledStatusRecurrence" NOT NULL DEFAULT 'ONE_TIME',
  "startAt"     TIMESTAMP(3),
  "endAt"       TIMESTAMP(3),
  "startMinute" INTEGER,
  "endMinute"   INTEGER,
  "daysOfWeek"  INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "activeFrom"  TIMESTAMP(3),
  "activeUntil" TIMESTAMP(3),
  "timezone"    TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scheduled_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scheduled_statuses_userId_idx" ON "scheduled_statuses" ("userId");
CREATE INDEX IF NOT EXISTS "scheduled_statuses_isEnabled_idx" ON "scheduled_statuses" ("isEnabled");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "scheduled_statuses"
    ADD CONSTRAINT "scheduled_statuses_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
