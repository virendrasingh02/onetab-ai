-- AlterTable
ALTER TABLE "knowledge_documents" ADD COLUMN "contentHash" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "knowledge_documents_knowledgeBaseId_contentHash_idx" ON "knowledge_documents"("knowledgeBaseId", "contentHash");
