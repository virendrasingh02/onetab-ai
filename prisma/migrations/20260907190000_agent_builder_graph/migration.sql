-- Agent Builder canvas persistence: the React Flow graph now lives on the row
-- instead of the author's browser localStorage.
ALTER TABLE "ai_agents" ADD COLUMN "graphJson" TEXT;
