-- CreateTable
CREATE TABLE "geofence_presences" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstInsideAt" TIMESTAMP(3),
    "firstOutsideAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastEvent" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geofence_presences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_punches" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationName" TEXT,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'INTERNAL_LEDGER',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_punches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "geofence_presences_workflowId_userId_key" ON "geofence_presences"("workflowId", "userId");

-- CreateIndex
CREATE INDEX "geofence_presences_workspaceId_userId_idx" ON "geofence_presences"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_punches_workspaceId_idempotencyKey_key" ON "attendance_punches"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "attendance_punches_workspaceId_userId_occurredAt_idx" ON "attendance_punches"("workspaceId", "userId", "occurredAt");

-- AddForeignKey
ALTER TABLE "geofence_presences" ADD CONSTRAINT "geofence_presences_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "automation_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
