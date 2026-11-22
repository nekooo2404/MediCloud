-- T06 processed-event ownership token for lease-safe completion and cleanup
ALTER TABLE "processed_events"
  ADD COLUMN "claimToken" UUID;
