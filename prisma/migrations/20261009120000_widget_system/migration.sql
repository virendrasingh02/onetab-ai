-- CreateTable
CREATE TABLE "widget_definitions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creatorId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'data_viz',
    "componentType" TEXT NOT NULL DEFAULT 'metric_card',
    "icon" TEXT DEFAULT 'LayoutDashboard',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "visibility" TEXT NOT NULL DEFAULT 'WORKSPACE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "appearance" JSONB NOT NULL DEFAULT '{}',
    "dataSource" JSONB NOT NULL DEFAULT '{}',
    "schemaConfig" JSONB NOT NULL DEFAULT '{}',
    "eventConfig" JSONB NOT NULL DEFAULT '{}',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "sampleData" JSONB DEFAULT '{}',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateCategory" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "widget_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_instances" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "widgetDefinitionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'AGENT',
    "entityId" TEXT NOT NULL,
    "name" TEXT,
    "configOverride" JSONB NOT NULL DEFAULT '{}',
    "stateJson" JSONB NOT NULL DEFAULT '{}',
    "placement" TEXT,
    "layout" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_versions" (
    "id" TEXT NOT NULL,
    "widgetDefinitionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "changeSummary" TEXT,
    "snapshotJson" JSONB NOT NULL DEFAULT '{}',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "widget_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_executions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "widgetDefinitionId" TEXT NOT NULL,
    "widgetInstanceId" TEXT,
    "executionType" TEXT NOT NULL DEFAULT 'ACTION',
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "inputPayload" JSONB NOT NULL DEFAULT '{}',
    "outputPayload" JSONB NOT NULL DEFAULT '{}',
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorJson" JSONB,
    "initiatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "widget_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "widget_definitions_workspaceId_slug_key" ON "widget_definitions"("workspaceId", "slug");
CREATE INDEX "widget_definitions_workspaceId_status_idx" ON "widget_definitions"("workspaceId", "status");
CREATE INDEX "widget_definitions_workspaceId_category_idx" ON "widget_definitions"("workspaceId", "category");
CREATE INDEX "widget_definitions_workspaceId_isTemplate_idx" ON "widget_definitions"("workspaceId", "isTemplate");

-- CreateIndex
CREATE INDEX "widget_instances_workspaceId_entityType_entityId_idx" ON "widget_instances"("workspaceId", "entityType", "entityId");
CREATE INDEX "widget_instances_widgetDefinitionId_idx" ON "widget_instances"("widgetDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "widget_versions_widgetDefinitionId_versionNumber_key" ON "widget_versions"("widgetDefinitionId", "versionNumber");
CREATE INDEX "widget_versions_widgetDefinitionId_idx" ON "widget_versions"("widgetDefinitionId");

-- CreateIndex
CREATE INDEX "widget_executions_workspaceId_createdAt_idx" ON "widget_executions"("workspaceId", "createdAt");
CREATE INDEX "widget_executions_widgetDefinitionId_status_idx" ON "widget_executions"("widgetDefinitionId", "status");

-- AddForeignKey
ALTER TABLE "widget_definitions" ADD CONSTRAINT "widget_definitions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "widget_definitions" ADD CONSTRAINT "widget_definitions_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_instances" ADD CONSTRAINT "widget_instances_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "widget_instances" ADD CONSTRAINT "widget_instances_widgetDefinitionId_fkey" FOREIGN KEY ("widgetDefinitionId") REFERENCES "widget_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_versions" ADD CONSTRAINT "widget_versions_widgetDefinitionId_fkey" FOREIGN KEY ("widgetDefinitionId") REFERENCES "widget_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_executions" ADD CONSTRAINT "widget_executions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "widget_executions" ADD CONSTRAINT "widget_executions_widgetDefinitionId_fkey" FOREIGN KEY ("widgetDefinitionId") REFERENCES "widget_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "widget_executions" ADD CONSTRAINT "widget_executions_widgetInstanceId_fkey" FOREIGN KEY ("widgetInstanceId") REFERENCES "widget_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
