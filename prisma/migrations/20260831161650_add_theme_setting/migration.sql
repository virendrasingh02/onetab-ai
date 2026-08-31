-- Per-user appearance/theme customization (mode, density, accent, radius, custom-theme config).
-- Mirrors sidebar_preferences: one JSON blob per user, synced from the client.
CREATE TABLE "theme_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "theme_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "theme_settings_userId_key" ON "theme_settings"("userId");

ALTER TABLE "theme_settings" ADD CONSTRAINT "theme_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
