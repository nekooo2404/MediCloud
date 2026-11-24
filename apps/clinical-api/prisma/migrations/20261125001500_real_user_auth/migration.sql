-- Real user email/password authentication columns
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "passwordHash" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "displayName" VARCHAR(160);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
