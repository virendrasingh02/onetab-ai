-- CreateTable
CREATE TABLE "connector_trigger_states" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "seenIds" JSONB,
    "lastPolledAt" TIMESTAMP(3),
    "lastFiredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "windowStartAt" TIMESTAMP(3),
    "firedInWindow" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_trigger_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "connector_trigger_states_workflowId_key" ON "connector_trigger_states"("workflowId");

-- CreateIndex
CREATE INDEX "connector_trigger_states_workspaceId_idx" ON "connector_trigger_states"("workspaceId");

-- AddForeignKey
ALTER TABLE "connector_trigger_states" ADD CONSTRAINT "connector_trigger_states_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "automation_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

