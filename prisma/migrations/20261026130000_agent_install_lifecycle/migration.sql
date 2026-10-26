-- AlterTable
ALTER TABLE "marketplace_installations"
  ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'WORKSPACE',
  ADD COLUMN "accessJson" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN "agentId" TEXT,
  ADD COLUMN "approvedPermissions" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "pinnedManifestJson" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN "rollbackJson" TEXT,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "healthJson" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN "lockedAt" TIMESTAMP(3);

-- Backfill: link existing agent installs to the agent they provisioned.
UPDATE "marketplace_installations" mi
SET "agentId" = a."id"
FROM "marketplace_listings" l, "ai_agents" a
WHERE mi."listingId" = l."id"
  AND l."kind" = 'AGENT'
  AND a."workspaceId" = mi."workspaceId"
  AND a."configuration" #>> '{marketplace,listingSlug}' = l."slug";
