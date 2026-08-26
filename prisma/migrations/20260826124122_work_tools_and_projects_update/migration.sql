-- CreateEnum
CREATE TYPE "IdentifierPrefixMode" AS ENUM ('AUTO', 'CUSTOM', 'LOCKED');

-- CreateEnum
CREATE TYPE "ProjectHealth" AS ENUM ('HEALTHY', 'AT_RISK', 'OFF_TRACK', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('TASK', 'BUG', 'FEATURE', 'IMPROVEMENT', 'REQUEST', 'SUPPORT', 'INCIDENT', 'STORY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('BLOCKS', 'BLOCKED_BY', 'RELATED_TO', 'DUPLICATE_OF', 'DUPLICATED_BY', 'PARENT_OF', 'SUB_ITEM_OF');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'DATETIME', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'USER', 'TEAM', 'URL', 'EMAIL', 'FORMULA');

-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('LIST', 'BOARD', 'CALENDAR', 'TIMELINE', 'GANTT', 'SPREADSHEET');

-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('PENDING', 'TRIAGED', 'CONVERTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "IntakeSource" AS ENUM ('USER', 'CUSTOMER', 'SUPPORT', 'INTEGRATION', 'FORM', 'EMAIL', 'SLACK', 'AI_AGENT');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "health" "ProjectHealth" NOT NULL DEFAULT 'HEALTHY',
ADD COLUMN     "healthScore" INTEGER,
ADD COLUMN     "identifierPrefixMode" "IdentifierPrefixMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "initiativeId" TEXT,
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "customFields" JSONB DEFAULT '{}',
ADD COLUMN     "customTypeId" TEXT,
ADD COLUMN     "cycleId" TEXT,
ADD COLUMN     "epicId" TEXT,
ADD COLUMN     "estimate" DOUBLE PRECISION,
ADD COLUMN     "identifier" TEXT,
ADD COLUMN     "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "moduleId" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "reporterId" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "timeSpent" INTEGER,
ADD COLUMN     "type" "WorkItemType" NOT NULL DEFAULT 'TASK';

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "iconColor" TEXT,
    "color" TEXT DEFAULT '#3b82f6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiatives" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "description" TEXT,
    "ownerId" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "health" "ProjectHealth" NOT NULL DEFAULT 'HEALTHY',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "targetDate" TIMESTAMP(3),
    "color" TEXT DEFAULT '#8b5cf6',
    "icon" TEXT,
    "iconColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epics" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "targetDate" TIMESTAMP(3),
    "color" TEXT DEFAULT '#8b5cf6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leadId" TEXT,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "color" TEXT DEFAULT '#3b82f6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "teamId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "goal" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_item_relations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_item_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_item_custom_fields" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_item_custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "teamId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "type" "ViewType" NOT NULL DEFAULT 'BOARD',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "sorting" JSONB DEFAULT '{}',
    "grouping" JSONB DEFAULT '{}',
    "visibleColumns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_requests" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" "IntakeSource" NOT NULL DEFAULT 'USER',
    "requesterName" TEXT,
    "requesterEmail" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "slaDueDate" TIMESTAMP(3),
    "status" "IntakeStatus" NOT NULL DEFAULT 'PENDING',
    "suggestedProjectId" TEXT,
    "suggestedAssigneeId" TEXT,
    "suggestedLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "convertedWorkItemId" TEXT,
    "aiAnalysis" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_updates" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "ProjectHealth" NOT NULL DEFAULT 'HEALTHY',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "completedSummary" TEXT,
    "inProgressSummary" TEXT,
    "blockersSummary" TEXT,
    "nextStepsSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_item_activities" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "fieldChanged" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_item_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teams_workspaceId_idx" ON "teams"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_workspaceId_key_key" ON "teams"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "initiatives_workspaceId_status_idx" ON "initiatives"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "epics_projectId_status_idx" ON "epics"("projectId", "status");

-- CreateIndex
CREATE INDEX "modules_projectId_status_idx" ON "modules"("projectId", "status");

-- CreateIndex
CREATE INDEX "cycles_projectId_status_idx" ON "cycles"("projectId", "status");

-- CreateIndex
CREATE INDEX "cycles_teamId_status_idx" ON "cycles"("teamId", "status");

-- CreateIndex
CREATE INDEX "work_item_relations_sourceId_idx" ON "work_item_relations"("sourceId");

-- CreateIndex
CREATE INDEX "work_item_relations_targetId_idx" ON "work_item_relations"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "work_item_relations_sourceId_targetId_type_key" ON "work_item_relations"("sourceId", "targetId", "type");

-- CreateIndex
CREATE INDEX "work_item_custom_fields_workspaceId_idx" ON "work_item_custom_fields"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "work_item_custom_fields_workspaceId_projectId_key_key" ON "work_item_custom_fields"("workspaceId", "projectId", "key");

-- CreateIndex
CREATE INDEX "saved_views_workspaceId_projectId_idx" ON "saved_views"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "intake_requests_workspaceId_status_idx" ON "intake_requests"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "project_updates_projectId_createdAt_idx" ON "project_updates"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "work_item_activities_workItemId_createdAt_idx" ON "work_item_activities"("workItemId", "createdAt");

-- CreateIndex
CREATE INDEX "work_item_activities_workspaceId_createdAt_idx" ON "work_item_activities"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "projects_teamId_idx" ON "projects"("teamId");

-- CreateIndex
CREATE INDEX "projects_initiativeId_idx" ON "projects"("initiativeId");

-- CreateIndex
CREATE INDEX "tasks_cycleId_idx" ON "tasks"("cycleId");

-- CreateIndex
CREATE INDEX "tasks_epicId_idx" ON "tasks"("epicId");

-- CreateIndex
CREATE INDEX "tasks_moduleId_idx" ON "tasks"("moduleId");

-- CreateIndex
CREATE INDEX "tasks_parentId_idx" ON "tasks"("parentId");

-- CreateIndex
CREATE INDEX "tasks_identifier_idx" ON "tasks"("identifier");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epics" ADD CONSTRAINT "epics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epics" ADD CONSTRAINT "epics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "epics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_relations" ADD CONSTRAINT "work_item_relations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_relations" ADD CONSTRAINT "work_item_relations_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_relations" ADD CONSTRAINT "work_item_relations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_custom_fields" ADD CONSTRAINT "work_item_custom_fields_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_custom_fields" ADD CONSTRAINT "work_item_custom_fields_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_custom_fields" ADD CONSTRAINT "work_item_custom_fields_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_activities" ADD CONSTRAINT "work_item_activities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_activities" ADD CONSTRAINT "work_item_activities_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_activities" ADD CONSTRAINT "work_item_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
