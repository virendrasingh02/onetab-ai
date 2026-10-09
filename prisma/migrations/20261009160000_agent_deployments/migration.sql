-- CreateTable
CREATE TABLE "agent_deployments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Production Deployment',
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "target" TEXT NOT NULL DEFAULT 'WIDGET',
    "publicKey" TEXT NOT NULL,
    "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "widgetConfig" JSONB NOT NULL DEFAULT '{}',
    "securityConfig" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "agent_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_deployment_sessions" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "clientOrigin" TEXT,
    "userContext" JSONB NOT NULL DEFAULT '{}',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_deployment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_deployment_webhooks" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY['agent.run.completed', 'agent.run.failed', 'agent.approval.requested']::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_deployment_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "statusCode" INTEGER,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_api_keys" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['agent:read', 'agent:execute']::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_deployments_publicKey_key" ON "agent_deployments"("publicKey");
CREATE INDEX "agent_deployments_workspaceId_agentId_idx" ON "agent_deployments"("workspaceId", "agentId");
CREATE INDEX "agent_deployments_publicKey_idx" ON "agent_deployments"("publicKey");
CREATE INDEX "agent_deployments_environment_status_idx" ON "agent_deployments"("environment", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_deployment_sessions_sessionToken_key" ON "agent_deployment_sessions"("sessionToken");
CREATE INDEX "agent_deployment_sessions_deploymentId_status_idx" ON "agent_deployment_sessions"("deploymentId", "status");
CREATE INDEX "agent_deployment_sessions_sessionToken_idx" ON "agent_deployment_sessions"("sessionToken");
CREATE INDEX "agent_deployment_sessions_expiresAt_idx" ON "agent_deployment_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "agent_deployment_webhooks_deploymentId_isActive_idx" ON "agent_deployment_webhooks"("deploymentId", "isActive");

-- CreateIndex
CREATE INDEX "agent_webhook_deliveries_webhookId_createdAt_idx" ON "agent_webhook_deliveries"("webhookId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_api_keys_keyHash_key" ON "agent_api_keys"("keyHash");
CREATE INDEX "agent_api_keys_workspaceId_isActive_idx" ON "agent_api_keys"("workspaceId", "isActive");
CREATE INDEX "agent_api_keys_keyHash_idx" ON "agent_api_keys"("keyHash");

-- AddForeignKey
ALTER TABLE "agent_deployments" ADD CONSTRAINT "agent_deployments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_deployments" ADD CONSTRAINT "agent_deployments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_deployment_sessions" ADD CONSTRAINT "agent_deployment_sessions_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "agent_deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_deployment_webhooks" ADD CONSTRAINT "agent_deployment_webhooks_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "agent_deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_webhook_deliveries" ADD CONSTRAINT "agent_webhook_deliveries_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "agent_deployment_webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
