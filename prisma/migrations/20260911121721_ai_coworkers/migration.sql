-- CreateEnum
CREATE TYPE "CoworkerStatus" AS ENUM ('AVAILABLE', 'WORKING', 'IDLE', 'RUNNING_TASK', 'ERROR');

-- CreateTable
CREATE TABLE "ai_coworkers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creatorId" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Coworker',
    "description" TEXT,
    "personality" TEXT,
    "systemInstructions" TEXT NOT NULL DEFAULT '',
    "status" "CoworkerStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "provider" TEXT,
    "model" TEXT,
    "matrixUserId" TEXT,
    "matrixRoomId" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "ai_coworkers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coworker_agents" (
    "id" TEXT NOT NULL,
    "coworkerId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coworker_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coworker_apps" (
    "id" TEXT NOT NULL,
    "coworkerId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coworker_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_coworkers" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "coworkerId" TEXT NOT NULL,
    "addedById" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_coworkers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_coworkers" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "coworkerId" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_coworkers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coworker_execution_logs" (
    "id" TEXT NOT NULL,
    "coworkerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "promptText" TEXT NOT NULL,
    "outputResult" TEXT NOT NULL,
    "toolCalls" TEXT NOT NULL DEFAULT '[]',
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coworker_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_coworkers_matrixUserId_key" ON "ai_coworkers"("matrixUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_coworkers_matrixRoomId_key" ON "ai_coworkers"("matrixRoomId");

-- CreateIndex
CREATE INDEX "ai_coworkers_workspaceId_isActive_idx" ON "ai_coworkers"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "coworker_agents_coworkerId_idx" ON "coworker_agents"("coworkerId");

-- CreateIndex
CREATE INDEX "coworker_agents_agentId_idx" ON "coworker_agents"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "coworker_agents_coworkerId_agentId_key" ON "coworker_agents"("coworkerId", "agentId");

-- CreateIndex
CREATE INDEX "coworker_apps_coworkerId_idx" ON "coworker_apps"("coworkerId");

-- CreateIndex
CREATE INDEX "coworker_apps_integrationId_idx" ON "coworker_apps"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "coworker_apps_coworkerId_integrationId_key" ON "coworker_apps"("coworkerId", "integrationId");

-- CreateIndex
CREATE INDEX "channel_coworkers_channelId_idx" ON "channel_coworkers"("channelId");

-- CreateIndex
CREATE INDEX "channel_coworkers_coworkerId_idx" ON "channel_coworkers"("coworkerId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_coworkers_channelId_coworkerId_key" ON "channel_coworkers"("channelId", "coworkerId");

-- CreateIndex
CREATE INDEX "project_coworkers_projectId_idx" ON "project_coworkers"("projectId");

-- CreateIndex
CREATE INDEX "project_coworkers_coworkerId_idx" ON "project_coworkers"("coworkerId");

-- CreateIndex
CREATE UNIQUE INDEX "project_coworkers_projectId_coworkerId_key" ON "project_coworkers"("projectId", "coworkerId");

-- CreateIndex
CREATE INDEX "coworker_execution_logs_coworkerId_executedAt_idx" ON "coworker_execution_logs"("coworkerId", "executedAt");

-- AddForeignKey
ALTER TABLE "ai_coworkers" ADD CONSTRAINT "ai_coworkers_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_coworkers" ADD CONSTRAINT "ai_coworkers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coworker_agents" ADD CONSTRAINT "coworker_agents_coworkerId_fkey" FOREIGN KEY ("coworkerId") REFERENCES "ai_coworkers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coworker_agents" ADD CONSTRAINT "coworker_agents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coworker_apps" ADD CONSTRAINT "coworker_apps_coworkerId_fkey" FOREIGN KEY ("coworkerId") REFERENCES "ai_coworkers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coworker_apps" ADD CONSTRAINT "coworker_apps_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "external_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_coworkers" ADD CONSTRAINT "channel_coworkers_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_coworkers" ADD CONSTRAINT "channel_coworkers_coworkerId_fkey" FOREIGN KEY ("coworkerId") REFERENCES "ai_coworkers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_coworkers" ADD CONSTRAINT "channel_coworkers_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_coworkers" ADD CONSTRAINT "project_coworkers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_coworkers" ADD CONSTRAINT "project_coworkers_coworkerId_fkey" FOREIGN KEY ("coworkerId") REFERENCES "ai_coworkers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coworker_execution_logs" ADD CONSTRAINT "coworker_execution_logs_coworkerId_fkey" FOREIGN KEY ("coworkerId") REFERENCES "ai_coworkers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
