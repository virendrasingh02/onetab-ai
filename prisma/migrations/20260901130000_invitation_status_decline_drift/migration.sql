-- Reconciles pre-existing drift between migration history and the dev database:
-- during development the `invitations` table gained an `InvitationStatus.DECLINED`
-- variant (for the decline-invitation flow) and lost its `(workspaceId, email)`
-- UNIQUE constraint (an address can now hold several invites — link + email,
-- or re-invites), both via `db push` rather than a migration. That left every
-- `prisma migrate dev` demanding a full reset.
--
-- Every statement is guarded, so applying this against a database that already
-- has the changes is a no-op; against a fresh database it makes the real change.

-- 1. Add the DECLINED status, positioned to match the schema's enum order.
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'DECLINED' BEFORE 'REVOKED';

-- 2. An email/workspace pair is no longer unique among invitations.
DROP INDEX IF EXISTS "invitations_workspaceId_email_key";
CREATE INDEX IF NOT EXISTS "invitations_workspaceId_email_idx"
  ON "invitations" ("workspaceId", "email");
