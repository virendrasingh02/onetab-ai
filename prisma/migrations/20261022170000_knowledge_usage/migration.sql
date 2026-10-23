-- CreateTable
CREATE TABLE "knowledge_usage" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mode" TEXT,
    "rerank" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "grounded" BOOLEAN,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "retrievalMs" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_usage_knowledgeBaseId_createdAt_idx" ON "knowledge_usage"("knowledgeBaseId", "createdAt");

-- CreateIndex
CREATE INDEX "knowledge_usage_workspaceId_createdAt_idx" ON "knowledge_usage"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "knowledge_usage" ADD CONSTRAINT "knowledge_usage_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
