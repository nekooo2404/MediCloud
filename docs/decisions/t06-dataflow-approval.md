# T06 Transactional Outbox and Event Relay Data-Flow Approval

**Decision ID:** T06-DATAFLOW-001
**Status:** APPROVED
**Approver:** Project owner
**Timestamp (+07:00):** 2026-11-22
**Data policy:** Synthetic data only; no real PHI/PII, tokens or secrets.

## Approved scope

- Write business record and outbox event in the same PostgreSQL transaction.
- Validate the complete T02 event envelope and payload schema before outbox insertion.
- Enforce the T02 event-type/payload allowlist and default-deny unknown fields.
- Relay pending events with bounded retry/backoff and explicit `FAILED`/`DEAD_LETTER` handling.
- Treat publish-before-status-update crashes as duplicate-safe; consumers use unique `event_id` processing.
- Redact tokens, claims, PHI/PII and raw clinical content from logs and event payloads.
- Preserve correlation IDs and synthetic resource references for tracing/audit.
- Provide reconciliation for pending, delivered, failed and duplicate event states.

## Required evidence and gates

- Atomicity test proving appointment rollback when outbox validation/write fails.
- Allowlist and prohibited-payload tests.
- Retry, duplicate publish and dead-letter tests.
- Reconciliation report with counts and event IDs.
- Structured redacted logging evidence.
- Independent Tester TestReport, code review, security/privacy review and evidence review.

This approval does not authorize GCP deployment, Pub/Sub credentials, production infrastructure, real data, legal compliance or performance claims.
