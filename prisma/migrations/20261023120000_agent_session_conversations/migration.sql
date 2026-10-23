-- Widget conversations: a visitor's history, titles, and uploaded files.
ALTER TABLE "agent_deployment_sessions" ADD COLUMN "visitorKey" TEXT;
ALTER TABLE "agent_deployment_sessions" ADD COLUMN "title" TEXT;
ALTER TABLE "agent_deployment_sessions" ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX "agent_deployment_sessions_deploymentId_visitorKey_updatedAt_idx" ON "agent_deployment_sessions"("deploymentId", "visitorKey", "updatedAt");
