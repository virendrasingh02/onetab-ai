-- CreateTable
CREATE TABLE IF NOT EXISTS "knowledge_bases" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT DEFAULT 'BookOpen',
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "vectorCollection" TEXT NOT NULL DEFAULT 'workspace_docs',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "knowledge_documents" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceUri" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'FILE',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "mimeType" TEXT,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "rawText" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "embeddingId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_apps" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creatorId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT DEFAULT 'Sparkles',
    "appType" TEXT NOT NULL DEFAULT 'CHAT_APP',
    "visibility" TEXT NOT NULL DEFAULT 'WORKSPACE',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "agentId" TEXT,
    "workflowId" TEXT,
    "promptTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_workflow_versions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodesJson" TEXT NOT NULL DEFAULT '[]',
    "edgesJson" TEXT NOT NULL DEFAULT '[]',
    "changeSummary" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "approval_requests" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requesterId" TEXT,
    "approverId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "executionId" TEXT,
    "stepId" TEXT,
    "actionType" TEXT NOT NULL,
    "proposedPayload" JSONB NOT NULL DEFAULT '{}',
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_executions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "model" TEXT,
    "toolCalls" JSONB NOT NULL DEFAULT '[]',
    "errorsJson" JSONB,
    "stateJson" JSONB NOT NULL DEFAULT '{}',
    "workflowId" TEXT,
    "agentId" TEXT,
    "appId" TEXT,

    CONSTRAINT "ai_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_execution_steps" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "inputJson" JSONB NOT NULL DEFAULT '{}',
    "outputJson" JSONB NOT NULL DEFAULT '{}',
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ai_execution_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_secrets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "key" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "maskedValue" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mcp_connections" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "transport" TEXT NOT NULL DEFAULT 'HTTP',
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "authConfig" JSONB NOT NULL DEFAULT '{}',
    "discoveredToolsJson" JSONB NOT NULL DEFAULT '[]',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_feedbacks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "executionId" TEXT,
    "agentId" TEXT,
    "workflowId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "issueCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "knowledge_bases_workspaceId_idx" ON "knowledge_bases"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "knowledge_documents_knowledgeBaseId_status_idx" ON "knowledge_documents"("knowledgeBaseId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "knowledge_chunks_documentId_chunkIndex_idx" ON "knowledge_chunks"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_apps_workspaceId_isPublished_idx" ON "ai_apps"("workspaceId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ai_apps_workspaceId_slug_key" ON "ai_apps"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_workflow_versions_workflowId_idx" ON "ai_workflow_versions"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ai_workflow_versions_workflowId_versionNumber_key" ON "ai_workflow_versions"("workflowId", "versionNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_requests_workspaceId_state_idx" ON "approval_requests"("workspaceId", "state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_requests_executionId_idx" ON "approval_requests"("executionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_executions_workspaceId_status_idx" ON "ai_executions"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_executions_workspaceId_entityType_startedAt_idx" ON "ai_executions"("workspaceId", "entityType", "startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_execution_steps_executionId_stepId_idx" ON "ai_execution_steps"("executionId", "stepId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_secrets_workspaceId_idx" ON "ai_secrets"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ai_secrets_workspaceId_key_key" ON "ai_secrets"("workspaceId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mcp_connections_workspaceId_idx" ON "mcp_connections"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_feedbacks_workspaceId_createdAt_idx" ON "ai_feedbacks"("workspaceId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_bases_workspaceId_fkey') THEN
    ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_bases_createdById_fkey') THEN
    ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_documents_knowledgeBaseId_fkey') THEN
    ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_chunks_documentId_fkey') THEN
    ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_apps_workspaceId_fkey') THEN
    ALTER TABLE "ai_apps" ADD CONSTRAINT "ai_apps_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_apps_creatorId_fkey') THEN
    ALTER TABLE "ai_apps" ADD CONSTRAINT "ai_apps_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_apps_agentId_fkey') THEN
    ALTER TABLE "ai_apps" ADD CONSTRAINT "ai_apps_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_workflow_versions_workflowId_fkey') THEN
    ALTER TABLE "ai_workflow_versions" ADD CONSTRAINT "ai_workflow_versions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "automation_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_requests_workspaceId_fkey') THEN
    ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_requests_requesterId_fkey') THEN
    ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_requests_approverId_fkey') THEN
    ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_executions_workspaceId_fkey') THEN
    ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_executions_userId_fkey') THEN
    ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_executions_workflowId_fkey') THEN
    ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "automation_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_executions_agentId_fkey') THEN
    ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_executions_appId_fkey') THEN
    ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_appId_fkey" FOREIGN KEY ("appId") REFERENCES "ai_apps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_execution_steps_executionId_fkey') THEN
    ALTER TABLE "ai_execution_steps" ADD CONSTRAINT "ai_execution_steps_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_secrets_workspaceId_fkey') THEN
    ALTER TABLE "ai_secrets" ADD CONSTRAINT "ai_secrets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_secrets_createdById_fkey') THEN
    ALTER TABLE "ai_secrets" ADD CONSTRAINT "ai_secrets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mcp_connections_workspaceId_fkey') THEN
    ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mcp_connections_createdById_fkey') THEN
    ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_feedbacks_workspaceId_fkey') THEN
    ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_feedbacks_userId_fkey') THEN
    ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_feedbacks_executionId_fkey') THEN
    ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
