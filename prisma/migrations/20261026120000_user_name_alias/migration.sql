-- CreateTable
CREATE TABLE "user_name_aliases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_name_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_name_aliases_aliasKey_idx" ON "user_name_aliases"("aliasKey");

-- CreateIndex
CREATE UNIQUE INDEX "user_name_aliases_userId_aliasKey_key" ON "user_name_aliases"("userId", "aliasKey");

-- AddForeignKey
ALTER TABLE "user_name_aliases" ADD CONSTRAINT "user_name_aliases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
