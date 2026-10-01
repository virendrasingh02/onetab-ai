-- AI Agent Studio: a workflow can carry the blueprint it was compiled from
-- (objective, plan, granted scopes, output), can be archived, and versions
-- snapshot the blueprint with the graph. New notification kinds let agent
-- approvals, failures and results reach the bell without reusing SYSTEM.
-- Additive only; existing workflows keep a null profile and behave as before.

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'AI_APPROVAL_REQUIRED';
ALTER TYPE "NotificationKind" ADD VALUE 'AI_RUN_FAILED';
ALTER TYPE "NotificationKind" ADD VALUE 'AI_RUN_COMPLETED';
ALTER TYPE "NotificationKind" ADD VALUE 'AI_AGENT_MESSAGE';

-- AlterTable
ALTER TABLE "automation_workflows" ADD COLUMN     "agentProfile" JSONB,
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ai_workflow_versions" ADD COLUMN     "agentProfile" JSONB;

-- CreateIndex
CREATE INDEX "ai_executions_workspaceId_startedAt_idx" ON "ai_executions"("workspaceId", "startedAt");
