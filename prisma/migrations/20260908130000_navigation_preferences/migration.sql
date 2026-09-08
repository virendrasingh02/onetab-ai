-- Cross-device navigation memory. `navigation_preferences.data` holds
--   { lastWorkspaceId, lastWorkspaceSlug,
--     workspacePaths: { <workspaceId>: <route after /w/:slug> } }
-- so switching workspaces, resolving "/", and opening the app on another device
-- all resume the route the user last had open in each workspace instead of
-- always landing on Home. One row per user; the web client keeps a localStorage
-- copy for first paint and debounce-PUTs changes to `/users/me/navigation`.

-- CreateTable
CREATE TABLE "navigation_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "navigation_preferences_userId_key" ON "navigation_preferences"("userId");

-- AddForeignKey
ALTER TABLE "navigation_preferences" ADD CONSTRAINT "navigation_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
