-- Server-persisted sidebar customization, one row per user.
--
-- NOTE: `prisma migrate dev` also emitted `ALTER COLUMN "searchVector" DROP
-- DEFAULT` on five tables here because it cannot read the GENERATED expression
-- on the tsvector columns — those statements are invalid (42601) and have been
-- removed by hand.

-- CreateTable
CREATE TABLE "sidebar_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sidebar_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sidebar_preferences_userId_key" ON "sidebar_preferences"("userId");

-- AddForeignKey
ALTER TABLE "sidebar_preferences" ADD CONSTRAINT "sidebar_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
