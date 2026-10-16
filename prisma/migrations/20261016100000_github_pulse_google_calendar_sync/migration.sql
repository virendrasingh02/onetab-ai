-- AlterEnum
ALTER TYPE "ActivityKind" ADD VALUE IF NOT EXISTS 'GITHUB_COMMIT';
ALTER TYPE "ActivityKind" ADD VALUE IF NOT EXISTS 'GITHUB_PULL_REQUEST';

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN "externalSource" TEXT,
ADD COLUMN "externalId" TEXT,
ADD COLUMN "externalUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "meetings_organizerId_externalSource_externalId_key" ON "meetings"("organizerId", "externalSource", "externalId");
