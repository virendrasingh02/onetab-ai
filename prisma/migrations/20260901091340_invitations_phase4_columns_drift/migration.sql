-- Reconciles pre-existing drift: the Phase-4 invitation columns (channel/team/
-- project scoping, shareable links, decline timestamp, use counters) reached the
-- dev database through `db push`, never a migration. `email` also became
-- nullable (a shareable link has no address). Companion to
-- 20260901130000_invitation_status_decline_drift, which handled the enum variant
-- and the dropped (workspaceId, email) UNIQUE index.
--
-- The dev database already has all of this; apply-and-resolve is a formality
-- there. On a fresh database this is the real change.
--
-- NOTE: `prisma migrate diff` also emitted `ALTER COLUMN "searchVector" DROP
-- DEFAULT` on channels/projects/tasks/uploads/work_documents — it cannot read
-- the GENERATED expression on those tsvector columns, and the statements are
-- invalid (42601). Removed by hand, exactly as 20260827090722_sidebar_preferences
-- did.

-- AlterTable
ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "channelId" TEXT,
  ADD COLUMN IF NOT EXISTS "declinedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isLink" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "maxUses" INTEGER,
  ADD COLUMN IF NOT EXISTS "message" TEXT,
  ADD COLUMN IF NOT EXISTS "projectId" TEXT,
  ADD COLUMN IF NOT EXISTS "teamId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "useCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "invitations" ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invitations_channelId_idx" ON "invitations"("channelId");
CREATE INDEX IF NOT EXISTS "invitations_teamId_idx" ON "invitations"("teamId");
CREATE INDEX IF NOT EXISTS "invitations_projectId_idx" ON "invitations"("projectId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "invitations" ADD CONSTRAINT "invitations_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "invitations" ADD CONSTRAINT "invitations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "invitations" ADD CONSTRAINT "invitations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
