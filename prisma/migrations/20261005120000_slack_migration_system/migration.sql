-- Slack to My Platform Migration System

DO $$ BEGIN
  CREATE TYPE "MigrationStatus" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MigrationStage" AS ENUM ('INITIALIZING', 'WORKSPACE_METADATA', 'USERS', 'USER_MAPPING', 'CHANNELS', 'CHANNEL_MEMBERSHIP', 'MESSAGES', 'THREADS', 'REACTIONS', 'MENTIONS', 'FILES', 'DMS', 'GROUP_DMS', 'SEARCH_INDEXING', 'VALIDATION', 'FINALIZATION', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'PAUSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MigrationEntityType" AS ENUM ('WORKSPACE', 'USER', 'CHANNEL', 'MEMBERSHIP', 'MESSAGE', 'THREAD', 'REACTION', 'MENTION', 'FILE', 'DM', 'GROUP_DM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MigrationMappingStatus" AS ENUM ('PENDING', 'MAPPED', 'MERGED', 'SKIPPED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MigrationResolutionStrategy" AS ENUM ('USE_EXISTING', 'CREATE_NEW', 'MERGE', 'RENAME', 'SKIP', 'ARCHIVE', 'KEEP_EXTERNAL_LINK', 'RETRY_LATER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MigrationErrorSeverity" AS ENUM ('FATAL', 'RECOVERABLE', 'WARNING', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "migration_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceProvider" TEXT NOT NULL DEFAULT 'SLACK',
    "sourceWorkspaceId" TEXT,
    "sourceWorkspaceName" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "MigrationStatus" NOT NULL DEFAULT 'PENDING',
    "currentStage" "MigrationStage" NOT NULL DEFAULT 'INITIALIZING',
    "scope" JSONB NOT NULL DEFAULT '{}',
    "progress" JSONB NOT NULL DEFAULT '{}',
    "stats" JSONB NOT NULL DEFAULT '{}',
    "checkpoint" JSONB NOT NULL DEFAULT '{}',
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "readinessReport" JSONB NOT NULL DEFAULT '{}',
    "aiRecommendations" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "migration_sessions_workspaceId_status_idx" ON "migration_sessions"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "migration_sessions_createdById_idx" ON "migration_sessions"("createdById");

DO $$ BEGIN
  ALTER TABLE "migration_sessions" ADD CONSTRAINT "migration_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "migration_sessions" ADD CONSTRAINT "migration_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "migration_steps" (
    "id" TEXT NOT NULL,
    "migrationId" TEXT NOT NULL,
    "stage" "MigrationStage" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "skippedItems" INTEGER NOT NULL DEFAULT 0,
    "errorDetails" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "migration_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "migration_steps_migrationId_stage_idx" ON "migration_steps"("migrationId", "stage");

DO $$ BEGIN
  ALTER TABLE "migration_steps" ADD CONSTRAINT "migration_steps_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "migration_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "migration_mappings" (
    "id" TEXT NOT NULL,
    "migrationId" TEXT NOT NULL,
    "sourceProvider" TEXT NOT NULL DEFAULT 'SLACK',
    "sourceWorkspaceId" TEXT,
    "entityType" "MigrationEntityType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "destinationId" TEXT,
    "destinationWorkspaceId" TEXT NOT NULL,
    "status" "MigrationMappingStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" "MigrationResolutionStrategy" NOT NULL DEFAULT 'USE_EXISTING',
    "metadata" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "migration_mappings_migrationId_entityType_sourceId_key" ON "migration_mappings"("migrationId", "entityType", "sourceId");
CREATE INDEX IF NOT EXISTS "migration_mappings_destinationWorkspaceId_entityType_sourceId_idx" ON "migration_mappings"("destinationWorkspaceId", "entityType", "sourceId");
CREATE INDEX IF NOT EXISTS "migration_mappings_migrationId_entityType_status_idx" ON "migration_mappings"("migrationId", "entityType", "status");

DO $$ BEGIN
  ALTER TABLE "migration_mappings" ADD CONSTRAINT "migration_mappings_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "migration_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "migration_errors" (
    "id" TEXT NOT NULL,
    "migrationId" TEXT NOT NULL,
    "stepStage" "MigrationStage",
    "entityType" "MigrationEntityType",
    "sourceId" TEXT,
    "severity" "MigrationErrorSeverity" NOT NULL DEFAULT 'RECOVERABLE',
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_errors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "migration_errors_migrationId_severity_resolved_idx" ON "migration_errors"("migrationId", "severity", "resolved");

DO $$ BEGIN
  ALTER TABLE "migration_errors" ADD CONSTRAINT "migration_errors_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "migration_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "migration_validations" (
    "id" TEXT NOT NULL,
    "migrationId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "checks" JSONB NOT NULL DEFAULT '[]',
    "brokenReferences" JSONB NOT NULL DEFAULT '[]',
    "discrepancies" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_validations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "migration_validations_migrationId_idx" ON "migration_validations"("migrationId");

DO $$ BEGIN
  ALTER TABLE "migration_validations" ADD CONSTRAINT "migration_validations_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "migration_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "migration_reports" (
    "id" TEXT NOT NULL,
    "migrationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "exportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "migration_reports_migrationId_idx" ON "migration_reports"("migrationId");

DO $$ BEGIN
  ALTER TABLE "migration_reports" ADD CONSTRAINT "migration_reports_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "migration_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
