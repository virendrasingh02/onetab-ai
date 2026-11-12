-- Custom task statuses: a per-workspace workflow whose rows each sit under one
-- TaskStatus category. Tasks keep `status` (the category) and gain `stateId`.
CREATE TABLE "task_workflow_states" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "category" "TaskStatus" NOT NULL,
    "builtin" "TaskStatus",
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_workflow_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_workflow_states_workspaceId_builtin_key" ON "task_workflow_states"("workspaceId", "builtin");
CREATE INDEX "task_workflow_states_workspaceId_position_idx" ON "task_workflow_states"("workspaceId", "position");

ALTER TABLE "task_workflow_states" ADD CONSTRAINT "task_workflow_states_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD COLUMN "stateId" TEXT;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "task_workflow_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Column order now holds workflow state ids; built-ins keep their status name.
ALTER TABLE "projects" ALTER COLUMN "columnOrder" DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "columnOrder" TYPE TEXT[] USING "columnOrder"::TEXT[];
ALTER TABLE "projects" ALTER COLUMN "columnOrder" SET DEFAULT ARRAY[]::TEXT[];
