-- MCP connections: record the outcome of the last real handshake.
--
-- Until now a connection was stored as "CONNECTED" with invented tool names
-- without the server ever being contacted. Existing rows are reset to an
-- honest "not verified" state and their fabricated tool lists cleared; the
-- next Sync performs a real initialize + tools/list. Additive and reversible:
-- drop the two columns and restore the old default to roll back.
ALTER TABLE "mcp_connections" ADD COLUMN "lastError" TEXT;
ALTER TABLE "mcp_connections" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "mcp_connections" ALTER COLUMN "status" SET DEFAULT 'DISCONNECTED';

UPDATE "mcp_connections"
SET "status" = 'DISCONNECTED',
    "discoveredToolsJson" = '[]'::jsonb,
    "lastError" = 'Not verified yet — sync to connect and discover tools.';

-- Agent schedules: which ones the Agent Builder owns.
--
-- A schedule trigger on the builder canvas is now synced to a real row the
-- schedule sweep runs. Saving the canvas replaces the rows it created
-- ('builder') and never touches ones created through the API ('api').
ALTER TABLE "agent_schedules" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'api';
