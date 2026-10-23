-- AlterTable
ALTER TABLE "knowledge_chunks" ADD COLUMN "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
ADD COLUMN "embeddingModel" TEXT;
