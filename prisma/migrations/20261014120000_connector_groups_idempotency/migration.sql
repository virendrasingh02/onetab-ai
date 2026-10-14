-- CreateTable
CREATE TABLE "connector_groups" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "members" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_action_executions" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "connector_action_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connector_groups_workspaceId_idx" ON "connector_groups"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "connector_action_executions_integrationId_idempotencyKey_key" ON "connector_action_executions"("integrationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "connector_action_executions_createdAt_idx" ON "connector_action_executions"("createdAt");

-- AddForeignKey
ALTER TABLE "connector_groups" ADD CONSTRAINT "connector_groups_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
