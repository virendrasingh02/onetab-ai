-- AlterEnum
ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'REMOVED';

-- AlterTable
ALTER TABLE "workspace_members"
  ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "invitedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "invitedById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workspace_members_invitedById_idx" ON "workspace_members"("invitedById");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_members_invitedById_fkey'
  ) THEN
    ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invitedById_fkey"
      FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "workspace_settings"
  ADD COLUMN IF NOT EXISTS "policies" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "invitedUserId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invitations_invitedUserId_idx" ON "invitations"("invitedUserId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invitations_invitedUserId_fkey'
  ) THEN
    ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedUserId_fkey"
      FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "workspace_audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workspace_audit_logs_workspaceId_createdAt_idx" ON "workspace_audit_logs"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "workspace_audit_logs_workspaceId_action_idx" ON "workspace_audit_logs"("workspaceId", "action");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_audit_logs_workspaceId_fkey'
  ) THEN
    ALTER TABLE "workspace_audit_logs" ADD CONSTRAINT "workspace_audit_logs_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_audit_logs_actorId_fkey'
  ) THEN
    ALTER TABLE "workspace_audit_logs" ADD CONSTRAINT "workspace_audit_logs_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
