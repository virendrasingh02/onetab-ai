-- Two-factor sign-in challenges: issued after the first factor when the
-- account has two-factor on, redeemed with a TOTP or recovery code.
CREATE TABLE "two_factor_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "two_factor_challenges_tokenHash_key" ON "two_factor_challenges"("tokenHash");
CREATE INDEX "two_factor_challenges_userId_idx" ON "two_factor_challenges"("userId");
CREATE INDEX "two_factor_challenges_expiresAt_idx" ON "two_factor_challenges"("expiresAt");

ALTER TABLE "two_factor_challenges" ADD CONSTRAINT "two_factor_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Last accepted TOTP time step, to refuse a replayed code.
ALTER TABLE "two_factor_auths" ADD COLUMN "lastTotpStep" INTEGER;
