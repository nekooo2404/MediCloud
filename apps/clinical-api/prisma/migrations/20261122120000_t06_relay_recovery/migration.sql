-- T06 relay lease recovery and handler-scoped idempotency
ALTER TYPE "OutboxStatus" ADD VALUE IF NOT EXISTS 'CLAIMED';
CREATE TYPE "ProcessedEventStatus" AS ENUM ('PROCESSING', 'PROCESSED');

ALTER TABLE "outbox_events"
  ADD COLUMN "claimedAt" TIMESTAMPTZ(3),
  ADD COLUMN "claimToken" UUID;

ALTER TABLE "processed_events"
  ADD COLUMN "status" "ProcessedEventStatus" NOT NULL DEFAULT 'PROCESSED',
  ADD COLUMN "duplicateCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "processed_events"
  ALTER COLUMN "status" SET DEFAULT 'PROCESSING';

ALTER TABLE "processed_events" DROP CONSTRAINT "processed_events_pkey";
ALTER TABLE "processed_events" ADD CONSTRAINT "processed_events_pkey" PRIMARY KEY ("eventId", "handler");
CREATE UNIQUE INDEX "outbox_events_eventId_claimToken_key" ON "outbox_events"("eventId", "claimToken");
