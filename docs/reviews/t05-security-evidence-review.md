# T05 Independent Security / Privacy / Evidence Review

**Task:** T05 - scheduling endpoints, capacity locking, idempotency and check-in  
**Review date:** 2026-11-22 (Asia/Saigon, UTC+07:00)  
**Reviewer:** Independent security/privacy/evidence reviewer  
**Implementation changes:** None

## Decisions

| Gate | Decision | Scope |
|---|---|---|
| Security/privacy | **APPROVED** | Local implementation with synthetic data and the environment limits below |
| Evidence | **APPROVED** | Current tester report, handoff, task state and fingerprint are consistent |
| Security/evidence review | **APPROVED** | These two gates are complete; this review does not replace any separate code-review gate |

Approval is limited to the reviewed local implementation. It is not approval for production deployment, live Keycloak, OpenStack, real data, or production readiness.

## Evidence consistency

The current [T05 TestReport](../evidence/t05-test-report.md) is `PASS` and reports:

- PostgreSQL 16 disposable migration and seed verification: PASS.
- Full database-backed suite: `46/46` tests passed.
- Typecheck, lint and contract validation: PASS.
- Synthetic-only data and explicit environment limitations.

The current [T05 handoff](../medicloud/t05-handoff.md:4) is `TEST_PASSED`, records the same `46/46` result and contains the current aggregate fingerprint. The task registry also records T05 as `TEST_PASSED` ([tasks.md](../medicloud/tasks.md:24)). The duplicate migration path previously present in the handoff is removed.

The scoped aggregate fingerprint was independently recalculated from the exact 15-file manifest:

`d370344707fe896630db9fb8f64686826bc3861a8ddc58bbc61268f25d35b6032`

It matches both the TestReport and handoff. The current `http-adapter.ts` hash also matches the report:

`90ff1c7fbaa399ee1052dc4bdcd2808b81d896b78081916fb9b442cb73506c50`

## Security and privacy verification

### Membership and tenant authority

- The default adapter resolver loads the user and memberships from Prisma and computes activity from database user status and `membership.revokedAt` ([http-adapter.ts](../../apps/clinical-api/src/scheduling/http-adapter.ts:17)).
- `effectivePrincipal()` requires exactly one active membership and replaces token tenant/role context with the active database membership ([service.ts](../../apps/clinical-api/src/scheduling/service.ts:46)).
- The reviewed scheduling path contains no `principal.tenantIds[0]` selection. Token tenant claims and global token roles are not final authority in the default runtime adapter.
- The resolver injection is documented as a test seam. Production wiring uses the Prisma default resolver.
- The fresh tester report covers revoked membership, disabled user, wrong token tenant and tenant isolation with PostgreSQL enabled.

### Idempotency and channel semantics

- Optional `patient_id` is resolved before idempotency comparison ([service.ts](../../apps/clinical-api/src/scheduling/service.ts:123)).
- The stored appointment and normalized effective request are compared with `bookingFingerprint()`; changed payloads return `409` ([service.ts](../../apps/clinical-api/src/scheduling/service.ts:125)).
- Scheduling rejects request `channel`; check-in uses `check_in_channel`; the trusted appointment event uses allowlisted `portal|staff` values ([http-adapter.ts](../../apps/clinical-api/src/scheduling/http-adapter.ts:41), [service.ts](../../apps/clinical-api/src/scheduling/service.ts:145)).

### Events, logs and responses

- Full T02 event validation runs before the outbox insert ([service.ts](../../apps/clinical-api/src/scheduling/service.ts:145), [event-validation.ts](../../apps/clinical-api/src/scheduling/event-validation.ts:12)).
- Mutation logs use allowlisted synthetic resource references and do not serialize tokens, raw claims or request bodies ([redacted-log.ts](../../apps/clinical-api/src/security/redacted-log.ts:1)).
- Authorization denials use `synthetic-redacted-resource`; audit context requires synthetic correlation/resource formats ([authorization.ts](../../apps/clinical-api/src/security/authorization.ts:16), [redacted-audit.ts](../../apps/clinical-api/src/security/redacted-audit.ts:3)).
- Unexpected failures return generic `500` responses with a correlation ID and no stack trace ([http-adapter.ts](../../apps/clinical-api/src/scheduling/http-adapter.ts:61)).
- Tester HTTP/integration assertions pass for token, claims, PHI/PII, stack-trace and caller-controlled resource-reference redaction.

### Rollback and audit

- Appointment creation, slot update and outbox insertion share one Prisma transaction ([service.ts](../../apps/clinical-api/src/scheduling/service.ts:113)).
- Check-in state transition and append-only audit insertion share one transaction ([service.ts](../../apps/clinical-api/src/scheduling/service.ts:98)).
- The tester report records passing rollback, check-in audit, duplicate request, invalid-state and event-validation tests on the clean PostgreSQL run.

## Verification performed in this review

| Check | Result |
|---|---|
| Fingerprint recalculation | PASS: exact match `d370344707fe896630db9fb8f64686826bc3861a8ddc58bbc61268f25d35b6032` |
| Handoff status and fingerprint | PASS |
| Task registry status | PASS: `TEST_PASSED` |
| Duplicate migration path | PASS: removed |
| `npm test -- --run` | PASS: `36 passed`, `10 skipped` without `DATABASE_URL` |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; existing non-failing Pages-directory advisory |
| `npm run contracts:validate` | PASS |
| Revoked membership/token role non-authority | PASS by source inspection and tester's DB-backed report |
| Logs/events/responses redaction | PASS by source inspection and tester assertions |
| Rollback/check-in audit | PASS in current tester report |
| Evidence consistency | PASS |

## Environment limits

- No live Keycloak/JWKS realm was used.
- No OpenStack private database, Cloud Run deployment or production database was used.
- No production log sink, real token, raw claims, PHI/PII or credentials were inspected.
- Backup/restore, RPO/RTO, SLA, performance, cost and production-readiness claims remain unverified.
- The exact `pnpm exec ...` command was not run because `pnpm` is absent from `PATH`; the documented npm/npx commands were used.
- The current T03 model has no dedicated patient-to-user foreign key; omitted `patient_id` uses the approved server-side `profileRef == subject` mapping and otherwise returns `patient_required`.

## Final decision

**Security/privacy: APPROVED. Evidence: APPROVED.** Both requested gates are satisfied for the exact fingerprinted local synthetic implementation. This review does not make any deployment, production-readiness, compliance, clinical-safety, performance, backup/restore or RPO/RTO claim, and it does not replace a separate independent code review if that gate is still pending.
