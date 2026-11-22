# T06 Implementation Plan and Handoff

**Task:** T06 — transactional outbox, policy gateway and event relay  
**Decision:** `T06-DATAFLOW-001` — APPROVED  
**Status:** TEST_PASSED  
**Accountable owner:** Project owner  
**Implementation owner:** Coding agent  
**Independent tester:** `quality.tester` session/person, independent of implementation  
**Current diff fingerprint:** `e497de4b33c413d1d7c4cd0db2ef567534e04eff8600dabc56021ca7d0847cfb`  
**Allowed paths:** `apps/clinical-api/`, `apps/event-relay/`, `packages/contracts/`, `tests/`  
**Data classification:** Synthetic data only. Restricted clinical content, PHI/PII, credentials and tokens are prohibited.

## Acceptance criteria

| ID | Criterion | Evidence | Result |
| --- | --- | --- | --- |
| T06-AC-01 | Outbox writes occur atomically with the business transaction and rollback on validation/write failure. | PostgreSQL rollback test | PASS |
| T06-AC-02 | Policy gateway enforces the T02 event allowlist and rejects prohibited/unknown fields. | Unit and schema tests | PASS |
| T06-AC-03 | Relay claims pending events safely and applies bounded retry/backoff. | Retry test; lease-aware implementation | PASS |
| T06-AC-04 | Permanent failures transition to `FAILED` and then `DEAD_LETTER` according to retry policy. | PostgreSQL dead-letter test | PASS |
| T06-AC-05 | Publish-before-status-update crashes are duplicate-safe. | Claim-token guarded delivery implementation; focused delivery test | PASS, with local-test limitation |
| T06-AC-06 | Consumers/processors enforce unique `event_id` idempotency. | Handler-scoped processed-event test | PASS |
| T06-AC-07 | Reconciliation reports pending, delivered, failed, dead-letter and duplicate counts with synthetic event references. | Reconciliation integration test | PASS |
| T06-AC-08 | Structured logs preserve correlation IDs while redacting tokens, claims, PHI/PII, secrets and raw payloads. | Redacted-log implementation and focused assertion | PASS, with local-test limitation |
| T06-AC-09 | No implementation or evidence claims deployment, production readiness, performance, compliance or clinical safety. | This handoff and TestReport | PASS |

## Test plan and executed checks

- PostgreSQL integration covered transactional rollback, retry/backoff, FAILED/dead-letter transitions, successful delivery, database-clock lease recovery, duplicate-safe processing, stale-worker ownership, tenant mismatch and reconciliation in the current implementation run.
- Recovery implementation includes claim leases and claim-token guarded updates for both outbox delivery and processed-event handler ownership. Completion and failure cleanup are conditional on the current claim token, so a stale worker cannot mutate a reclaimed row.
- Synthetic fixtures only. The local PostgreSQL environment was available and migrations were already applied.
- Evidence run metadata: Windows 11 local workspace; Node `v24.16.0`; Corepack pnpm `10.22.0`.

| Command/check | Timestamp (UTC+07:00) | Result |
| --- | --- | --- |
| `DATABASE_URL=postgres://postgres:<redacted>@localhost:2404/medicloud corepack pnpm vitest run tests/outbox.test.ts tests/outbox.integration.test.ts` | `2026-11-22T23:56:43+07:00` (start; Vitest start `23:56:44`) | PASS; exit 0; 2 files, 13/13 tests |
| `DATABASE_URL=postgres://postgres:<redacted>@localhost:2404/medicloud corepack pnpm typecheck` | `2026-11-22T23:56:45+07:00` | PASS; exit 0; `tsc --noEmit` |
| `corepack pnpm contracts:validate` | `2026-11-22T23:56:46+07:00` | PASS; exit 0; OpenAPI, event schema, policy and rejection fixtures |
| `git diff --check` | `2026-11-22T23:56:47+07:00` | PASS; exit 0; whitespace warnings only for existing line-ending normalization |
| `DATABASE_URL=postgres://postgres:<redacted>@localhost:2404/medicloud corepack pnpm exec prisma migrate deploy --schema apps/clinical-api/prisma/schema.prisma` | `2026-11-22T23:56:47+07:00` | PASS; exit 0; no pending migrations |

## Independent gates

- **Tester:** PASS for current fingerprint `e497de4b33c413d1d7c4cd0db2ef567534e04eff8600dabc56021ca7d0847cfb`, recorded in `docs/evidence/t06-test-report.md`; independent Tester verified 13/13 focused tests, typecheck, contracts, migrations and the current relay/lease/ownership implementation.
- **Security/privacy review:** APPROVE for that gate only; see `docs/reviews/t06-security-privacy-review.md`. Synthetic-only data and redaction constraints remain in force. No deployment or production approval.
- **Code review:** APPROVE for current fingerprint `e497de4b33c413d1d7c4cd0db2ef567534e04eff8600dabc56021ca7d0847cfb`; see `docs/reviews/t06-code-review.md`. No blocking correctness finding remains in the reviewed implementation.
- **Evidence review:** APPROVE for current fingerprint `e497de4b33c413d1d7c4cd0db2ef567534e04eff8600dabc56021ca7d0847cfb`; see `docs/reviews/t06-evidence-review-final.md`. The historical blocked review is retained at `docs/reviews/t06-evidence-review.md` and does not supersede the final approval.

## Limitations and risks

- Focused tests do not directly exercise every approved event type, notification-token payloads, lease-expiry concurrency, malformed/non-`P2002` database errors, or complete absence of every sensitive log field.
- Local PostgreSQL does not prove external broker behavior, deployment, production readiness or measured performance.
- T06 is now TEST_PASSED after the independent Tester, code-review, security/privacy and evidence gates approved the current fingerprint.

No deployment, production-readiness, performance, compliance or clinical-safety claim is made.
