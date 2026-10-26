-- CreateTable
CREATE TABLE "employee_profiles" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredName" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "team" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "links" JSONB NOT NULL DEFAULT '[]',
    "birthMonth" INTEGER,
    "birthDay" INTEGER,
    "birthYear" INTEGER,
    "joiningDate" DATE,
    "leftAt" DATE,
    "privacy" JSONB NOT NULL DEFAULT '{}',
    "celebrationPrefs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people_event_dispatches" (
    "key" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "people_event_dispatches_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_workspaceId_userId_key" ON "employee_profiles"("workspaceId", "userId");
CREATE INDEX "employee_profiles_userId_idx" ON "employee_profiles"("userId");
CREATE INDEX "employee_profiles_workspaceId_department_idx" ON "employee_profiles"("workspaceId", "department");
CREATE INDEX "employee_profiles_workspaceId_birthMonth_idx" ON "employee_profiles"("workspaceId", "birthMonth");
CREATE INDEX "people_event_dispatches_workspaceId_createdAt_idx" ON "people_event_dispatches"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "people_event_dispatches" ADD CONSTRAINT "people_event_dispatches_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
