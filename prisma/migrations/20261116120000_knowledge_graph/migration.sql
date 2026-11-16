-- CreateTable
CREATE TABLE "knowledge_graph_nodes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT,
    "entityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT,
    "description" TEXT,
    "sourceRef" TEXT,
    "sourceType" TEXT,
    "sourceUri" TEXT,
    "contentHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "provenance" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_graph_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_graph_edges" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT,
    "relationType" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "provenance" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_graph_sources" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUri" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "contentHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "nodeCount" INTEGER NOT NULL DEFAULT 0,
    "edgeCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "lastIndexedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_graph_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_graph_nodes_workspaceId_entityType_identifier_key" ON "knowledge_graph_nodes"("workspaceId", "entityType", "identifier");
CREATE INDEX "knowledge_graph_nodes_workspaceId_entityType_idx" ON "knowledge_graph_nodes"("workspaceId", "entityType");
CREATE INDEX "knowledge_graph_nodes_workspaceId_sourceRef_idx" ON "knowledge_graph_nodes"("workspaceId", "sourceRef");
CREATE INDEX "knowledge_graph_nodes_workspaceId_name_idx" ON "knowledge_graph_nodes"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_graph_edges_workspaceId_sourceNodeId_targetNodeId_relationType_key" ON "knowledge_graph_edges"("workspaceId", "sourceNodeId", "targetNodeId", "relationType");
CREATE INDEX "knowledge_graph_edges_workspaceId_sourceNodeId_idx" ON "knowledge_graph_edges"("workspaceId", "sourceNodeId");
CREATE INDEX "knowledge_graph_edges_workspaceId_targetNodeId_idx" ON "knowledge_graph_edges"("workspaceId", "targetNodeId");
CREATE INDEX "knowledge_graph_edges_workspaceId_relationType_idx" ON "knowledge_graph_edges"("workspaceId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_graph_sources_workspaceId_sourceType_name_key" ON "knowledge_graph_sources"("workspaceId", "sourceType", "name");
CREATE INDEX "knowledge_graph_sources_workspaceId_status_idx" ON "knowledge_graph_sources"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "knowledge_graph_nodes" ADD CONSTRAINT "knowledge_graph_nodes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_graph_edges" ADD CONSTRAINT "knowledge_graph_edges_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_edges" ADD CONSTRAINT "knowledge_graph_edges_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "knowledge_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_edges" ADD CONSTRAINT "knowledge_graph_edges_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "knowledge_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_graph_sources" ADD CONSTRAINT "knowledge_graph_sources_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
