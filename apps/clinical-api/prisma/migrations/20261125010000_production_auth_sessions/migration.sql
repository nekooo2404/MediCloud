-- Production auth tokens, email verification, password reset & server-side user sessions
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "emailVerificationTokenHash" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMPTZ(3);

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "tokenHash" VARCHAR(128) NOT NULL,
  "role" VARCHAR(32) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_tokenHash_key" ON "user_sessions"("tokenHash");
CREATE INDEX IF NOT EXISTS "user_sessions_userId_revokedAt_idx" ON "user_sessions"("userId", "revokedAt");
