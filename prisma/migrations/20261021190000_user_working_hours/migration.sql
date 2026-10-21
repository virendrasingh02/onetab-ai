-- Working hours and date/time display preferences move from the per-workspace
-- local preference blob onto the user, so teammates can see them.
ALTER TABLE "users" ADD COLUMN "workingHoursStart" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "users" ADD COLUMN "workingHoursEnd" TEXT NOT NULL DEFAULT '18:00';
ALTER TABLE "users" ADD COLUMN "workingDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];
ALTER TABLE "users" ADD COLUMN "timeFormat" TEXT;
ALTER TABLE "users" ADD COLUMN "dateFormat" TEXT;
