-- Slice C — Temporary channel membership (brief §8).
--
-- Hand-written (see 20260908101946): `prisma migrate dev` still wants to fold in
-- the un-migrated compliance drift and the invalid `searchVector DROP DEFAULT`.
-- Every statement is guarded so re-applying is a no-op.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ChannelMembershipType" AS ENUM ('PERMANENT', 'TEMPORARY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterEnum — a notification for a lapsed temporary membership.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'CHANNEL_ACCESS_EXPIRED' BEFORE 'SYSTEM';

-- AlterTable — safe defaults: every existing member is PERMANENT with no expiry.
ALTER TABLE "channel_members"
  ADD COLUMN IF NOT EXISTS "membershipType" "ChannelMembershipType" NOT NULL DEFAULT 'PERMANENT',
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- CreateIndex — drives the expiry sweep.
CREATE INDEX IF NOT EXISTS "channel_members_membershipType_expiresAt_idx"
  ON "channel_members" ("membershipType", "expiresAt");
