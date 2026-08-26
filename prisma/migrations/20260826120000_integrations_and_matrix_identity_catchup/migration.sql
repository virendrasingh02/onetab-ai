-- Catches up two independent things that had drifted from schema.prisma:
--
-- 1. Pre-existing drift (not introduced by this migration's author): the
--    integrations feature's schema.prisma changes were never turned into a
--    migration, so `external_integrations` was missing columns the running
--    code already queries, and three tables it depends on
--    (integration_webhook_events, integration_sync_jobs,
--    integration_audit_logs) did not exist in the database at all.
--
-- 2. New: matrixUserId/matrixRoomId on AIAgent and ExternalIntegration, so an
--    AI Agent or connected App can be provisioned a real Matrix bot identity
--    and a DM room with it, the same way Channel.matrixRoomId already backs
--    channels.

-- AlterTable
ALTER TABLE "ai_agents" ADD COLUMN     "matrixRoomId" TEXT,
ADD COLUMN     "matrixUserId" TEXT;

-- AlterTable
ALTER TABLE "external_integrations" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "encryptedAccessToken" TEXT,
ADD COLUMN     "encryptedRefreshToken" TEXT,
ADD COLUMN     "lastErrorAt" TIMESTAMP(3),
ADD COLUMN     "lastErrorMessage" TEXT,
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "matrixRoomId" TEXT,
ADD COLUMN     "matrixUserId" TEXT,
ADD COLUMN     "metadata" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "providerAccountId" TEXT,
ADD COLUMN     "scopeType" TEXT NOT NULL DEFAULT 'WORKSPACE',
ADD COLUMN     "scopes" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "workspaceId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "integration_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_sync_jobs" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL DEFAULT 'INCREMENTAL_SYNC',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "cursor" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_audit_logs" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT,
    "workspaceId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "durationMs" INTEGER,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_webhook_events_provider_status_idx" ON "integration_webhook_events"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_webhook_events_provider_eventId_key" ON "integration_webhook_events"("provider", "eventId");

-- CreateIndex
CREATE INDEX "integration_sync_jobs_integrationId_status_idx" ON "integration_sync_jobs"("integrationId", "status");

-- CreateIndex
CREATE INDEX "integration_audit_logs_workspaceId_createdAt_idx" ON "integration_audit_logs"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "integration_audit_logs_integrationId_idx" ON "integration_audit_logs"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_agents_matrixUserId_key" ON "ai_agents"("matrixUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_agents_matrixRoomId_key" ON "ai_agents"("matrixRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "external_integrations_matrixUserId_key" ON "external_integrations"("matrixUserId");

-- CreateIndex
CREATE UNIQUE INDEX "external_integrations_matrixRoomId_key" ON "external_integrations"("matrixRoomId");

-- CreateIndex
CREATE INDEX "external_integrations_userId_provider_idx" ON "external_integrations"("userId", "provider");

-- AddForeignKey
ALTER TABLE "external_integrations" ADD CONSTRAINT "external_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "external_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
