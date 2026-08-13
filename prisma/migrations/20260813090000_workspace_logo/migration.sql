-- Workspace logo uploads.
--
-- `avatarUrl` already existed for externally hosted images. `avatarKey` records
-- the object-store key when the logo was uploaded through the API, so the bytes
-- can be served back and replaced logos can be deleted from storage.
ALTER TABLE "workspaces" ADD COLUMN "avatarKey" TEXT;
