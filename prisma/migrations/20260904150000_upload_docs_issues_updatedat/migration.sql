-- Extend the unified upload context to documents and issues, and track a
-- mutable `updatedAt` (rename / move bump it; it is the "Updated" column in
-- the Files hub).

-- AlterEnum
ALTER TYPE "UploadContextType" ADD VALUE 'DOCUMENT';
ALTER TYPE "UploadContextType" ADD VALUE 'ISSUE';

-- AlterTable
ALTER TABLE "uploads" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
