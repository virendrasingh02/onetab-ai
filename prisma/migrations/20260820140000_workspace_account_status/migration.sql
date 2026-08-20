-- Workspace and membership lifecycle status.
--
-- Both columns are additive with an ACTIVE default, so every existing
-- workspace and membership keeps behaving exactly as it did — nothing is
-- archived or suspended by this migration.
--
-- `workspace_members.updatedAt` is backfilled from `joinedAt` rather than
-- `now()`: an untouched membership should not read as though it changed the
-- day the column was added.

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "workspaces"
  ADD COLUMN "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workspace_members"
  ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "workspace_members" SET "updatedAt" = "joinedAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "workspace_members"
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "workspace_members_workspaceId_status_idx"
  ON "workspace_members"("workspaceId", "status");
