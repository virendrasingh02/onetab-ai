-- AlterTable: Add coworker capability fields to ai_agents
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'agent';
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "personality" TEXT;
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "systemInstructions" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "status" "CoworkerStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "permissions" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "configuration" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_agents_workspaceId_type_idx" ON "ai_agents"("workspaceId", "type");

-- Migrate existing ai_coworkers data into ai_agents
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_coworkers') THEN
    INSERT INTO "ai_agents" (
      "id", "workspaceId", "creatorId", "type", "name", "role", "description",
      "avatarUrl", "personality", "systemInstructions", "status", "isActive",
      "provider", "model", "matrixUserId", "matrixRoomId", "permissions", "configuration",
      "createdAt", "updatedAt", "lastActiveAt"
    )
    SELECT
      "id", "workspaceId", "creatorId", 'coworker', "name", "role", "description",
      "avatarUrl", "personality", "systemInstructions", "status", "isActive",
      COALESCE("provider", 'ollama'), COALESCE("model", 'llama3'), "matrixUserId", "matrixRoomId", "permissions", "configuration",
      "createdAt", "updatedAt", "lastActiveAt"
    FROM "ai_coworkers"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- Update foreign keys referencing ai_coworkers to reference ai_agents
ALTER TABLE "coworker_agents" DROP CONSTRAINT IF EXISTS "coworker_agents_coworkerId_fkey";
ALTER TABLE "coworker_apps" DROP CONSTRAINT IF EXISTS "coworker_apps_coworkerId_fkey";
ALTER TABLE "channel_coworkers" DROP CONSTRAINT IF EXISTS "channel_coworkers_coworkerId_fkey";
ALTER TABLE "project_coworkers" DROP CONSTRAINT IF EXISTS "project_coworkers_coworkerId_fkey";

ALTER TABLE "coworker_agents" ADD CONSTRAINT "coworker_agents_coworkerId_fkey" FOREIGN KEY ("coworkerId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coworker_apps" ADD CONSTRAINT "coworker_apps_coworkerId_fkey" FOREIGN KEY ("coworkerId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_coworkers" ADD CONSTRAINT "channel_coworkers_coworkerId_fkey" FOREIGN KEY ("coworkerId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_coworkers" ADD CONSTRAINT "project_coworkers_coworkerId_fkey" FOREIGN KEY ("coworkerId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Clean up obsolete tables
DROP TABLE IF EXISTS "coworker_execution_logs";
DROP TABLE IF EXISTS "ai_coworkers";
