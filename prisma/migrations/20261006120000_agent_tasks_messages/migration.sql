-- CreateTable
CREATE TABLE "agent_tasks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "parentTaskId" TEXT,
    "agentKey" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "delegatedBy" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "taskId" TEXT,
    "fromAgent" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "toAgent" TEXT NOT NULL,
    "toName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_tasks_executionId_createdAt_idx" ON "agent_tasks"("executionId", "createdAt");

-- CreateIndex
CREATE INDEX "agent_tasks_workspaceId_status_idx" ON "agent_tasks"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "agent_messages_executionId_createdAt_idx" ON "agent_messages"("executionId", "createdAt");

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "agent_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "agent_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

