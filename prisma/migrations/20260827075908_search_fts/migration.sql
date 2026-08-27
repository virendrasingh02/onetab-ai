-- Full-text search: a Postgres-maintained `tsvector` column per searched table,
-- plus a GIN index. `GENERATED ALWAYS AS (...) STORED` keeps each vector in
-- sync with its source columns automatically — no triggers, no app writes.
-- Prisma models these as `Unsupported("tsvector")?` and never writes to them.

-- AlterTable
ALTER TABLE "channels" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce("name", '') || ' ' ||
      coalesce("topic", '') || ' ' ||
      coalesce("description", ''))
  ) STORED;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce("name", '') || ' ' ||
      coalesce("description", ''))
  ) STORED;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce("title", '') || ' ' ||
      coalesce("description", '') || ' ' ||
      coalesce("identifier", ''))
  ) STORED;

-- AlterTable
ALTER TABLE "uploads" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("filename", ''))
  ) STORED;

-- AlterTable
ALTER TABLE "work_documents" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce("title", '') || ' ' ||
      coalesce("content", ''))
  ) STORED;

-- CreateIndex
CREATE INDEX "channels_searchVector_idx" ON "channels" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "projects_searchVector_idx" ON "projects" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "tasks_searchVector_idx" ON "tasks" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "uploads_searchVector_idx" ON "uploads" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "work_documents_searchVector_idx" ON "work_documents" USING GIN ("searchVector");
