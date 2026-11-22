# T06 Independent Test Report

**Task:** T06 — transactional outbox, policy gateway and relay  
**Tester:** Independent `quality.tester` session  
**Result:** `PASS` for current fingerprint `e497de4b33c413d1d7c4cd0db2ef567534e04eff8600dabc56021ca7d0847cfb`  
**Test date:** 2026-11-22  
**Data:** Synthetic fixtures only; no production database, credentials, PHI or PII.

## Environment and commands

- Local synthetic PostgreSQL used the supplied database `medicloud` on `localhost:2404`; the password is redacted and was not written to this report.
- Run timestamp: `2026-11-22T23:50:49+07:00` for focused tests; metadata capture at `2026-11-22T23:51:01+07:00`.
- Runtime: Node `v24.16.0`; Corepack pnpm `10.22.0`; Windows 11 local workspace.
- Both T06 migrations were applied; the final migration check reported no pending migrations.
- No external broker, cloud service, deployment environment or production data was used.

| Command/check | Timestamp (UTC+07:00) | Result |
|---|---|---|
| `DATABASE_URL=postgres://postgres:<redacted>@localhost:2404/medicloud corepack pnpm vitest run tests/outbox.test.ts tests/outbox.integration.test.ts` | `2026-11-22T23:56:43+07:00` (start; Vitest start `23:56:44`) | PASS; process exit 0; 2 files, 13/13 tests |
| `DATABASE_URL=postgres://postgres:<redacted>@localhost:2404/medicloud corepack pnpm typecheck` | `2026-11-22T23:56:45+07:00` | PASS; process exit 0; `tsc --noEmit` |
| `corepack pnpm contracts:validate` | `2026-11-22T23:56:46+07:00` | PASS; process exit 0; OpenAPI, event schema, policy and rejection fixtures |
| `git diff --check` | `2026-11-22T23:56:47+07:00` | PASS; process exit 0; whitespace warnings only for existing line-ending normalization |
| `DATABASE_URL=postgres://postgres:<redacted>@localhost:2404/medicloud corepack pnpm exec prisma migrate deploy --schema apps/clinical-api/prisma/schema.prisma` | `2026-11-22T23:56:47+07:00` | PASS; process exit 0; no pending migrations |

## Independent gate artifact references

- Tester PASS: this report, independently tied to the fingerprint above.
- Code review APPROVE: `docs/reviews/t06-code-review.md`.
- Security/privacy APPROVE: `docs/reviews/t06-security-privacy-review.md`.
- Evidence review: `docs/reviews/t06-evidence-review.md` records the superseded historical BLOCKED review; a fresh independent review is required for the remediated evidence.

## Independent verification

The fresh independent review inspected the current implementation, tests, migrations and evidence for fingerprint `e497de4b33c413d1d7c4cd0db2ef567534e04eff8600dabc56021ca7d0847cfb`. It verified:

- `FAILED` retry lifecycle, bounded backoff and `DEAD_LETTER` transition;
- PostgreSQL-authoritative claim timestamps and lease eligibility;
- tenant-scoped claim selection;
- claim-token guarded outbox completion/failure handling;
- handler-scoped uniqueness and stale-worker `processOnce` protection;
- migration/schema consistency, including `(eventId, handler)` and `PROCESSING` default;
- per-run synthetic fixture identifiers and cleanup;
- no blocking tenant-crossing or claim-ownership flaw.

## Acceptance coverage

- **T06-AC-01:** PASS — validation and outbox-write rollback tests.
- **T06-AC-02:** PASS — allowlisted envelope and prohibited/unknown payload tests.
- **T06-AC-03:** PASS — bounded retry/backoff, database-clock lease eligibility, expired lease recovery and concurrent claim tests.
- **T06-AC-04:** PASS — relay-produced `FAILED` persistence and `DEAD_LETTER` transition tests.
- **T06-AC-05:** PASS — publish/status-update failure replay and claim-token guarded delivery.
- **T06-AC-06:** PASS — handler-scoped idempotency and stale-worker ownership protection.
- **T06-AC-07:** PASS — explicit PENDING, DELIVERED, FAILED, DEAD_LETTER and duplicate reconciliation counts.
- **T06-AC-08:** PASS for focused assertions — correlation-preserving redacted logs exclude sensitive markers; full production sink behavior is not claimed.
- **T06-AC-09:** PASS — no deployment, production-readiness, performance, compliance or clinical-safety claim.

## Exact current-diff fingerprint

Canonical manifest uses `path=lowercase_sha256` lines in the order below, with the aggregate SHA-256 calculated over the complete manifest.

**Aggregate SHA-256:** `e497de4b33c413d1d7c4cd0db2ef567534e04eff8600dabc56021ca7d0847cfb`

| Path | SHA-256 |
|---|---|
| `apps/clinical-api/src/outbox/policy-gateway.ts` | `a33883005fcbc2b51bf763b90a3153666fa390a0292851d5d0ad9309416b82a2` |
| `apps/event-relay/src/relay.ts` | `ce6cfd0b157ead7a3c3526953be35968a33cc16386cf4a02c7bf7603c597ff40` |
| `apps/event-relay/src/reconciliation.ts` | `f88d4d2439d716aed3de6635869b6fc2fd722f9012e713234aa7a747b24cb5a6` |
| `apps/clinical-api/prisma/schema.prisma` | `c957a97426da9fb48298601f2b815e628b61e65fb00d8d51e414d916083ed681` |
| `apps/clinical-api/prisma/migrations/20261122120000_t06_relay_recovery/migration.sql` | `b7266a20ad4f92c85ad5595b45efef6a1e268a66bdbe1b8fadaae48159b58e62` |
| `apps/clinical-api/prisma/migrations/20261122130000_t06_processed_event_claim_token/migration.sql` | `ea6567a58cd7ec35a2c996f96c5d9384c9a5fa49a0151cf52ec86d3dcd1fb6bd` |
| `tests/outbox.test.ts` | `4ad5c3d3af2e8353f14e2a83460a92a503ce02835b1343ee9d0c44285c2d5065` |
| `tests/outbox.integration.test.ts` | `2cbdcfaa726985b8482ad68eedb69922f1b1ad6bad467ba64442d38d93410ba9` |

## Limitations

This evidence does not establish external broker behavior, deployment, production readiness, performance, compliance, clinical safety, or production log-sink behavior. Those remain outside the approved T06 scope.
