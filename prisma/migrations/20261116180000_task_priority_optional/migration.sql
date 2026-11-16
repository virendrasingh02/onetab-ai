-- A task's priority is optional: new tasks start with "No priority" (null).
-- Existing rows keep the value they have.
ALTER TABLE "tasks" ALTER COLUMN "priority" DROP DEFAULT,
ALTER COLUMN "priority" DROP NOT NULL;
