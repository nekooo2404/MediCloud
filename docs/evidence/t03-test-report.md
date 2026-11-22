# T03 TestReport

**Status:** `PASS`
**Task:** T03 PostgreSQL/Prisma schema, migrations, and synthetic seed
**Tester:** Independent quality tester
**Timestamp:** 2026-11-21 18:07 (+07:00)
**Environment:** Windows PowerShell, Node.js v24.16.0, npm 12.2.0, Docker 29.4.3, PostgreSQL 16 disposable container
**Database:** `postgresql://medicloud:***@localhost:55432/medicloud`; disposable database only; no production data
**Implementation changes:** None

## Execution Evidence

| Check | Result | Evidence |
|---|---|---|
| `npm run db:validate` | PASS | Prisma schema valid; exit 0 with disposable `DATABASE_URL` |
| Clean PostgreSQL migration | PASS | Empty PostgreSQL 16 database; `prisma migrate deploy` applied `20261121104559_init`; exit 0 |
| `npm test -- --run` | PASS | 2 test files, 11/11 tests passed; exit 0 |
| `npm run typecheck` | PASS | `tsc --noEmit`; exit 0 |
| `npm run lint` | PASS | ESLint exit 0; emits existing App Router pages-directory advisory |
| `npm run db:seed` | PASS | 2 tenants, 8 users, 4 practitioners, 40 slots, 20 appointments, 10 encounters, 10 observations, 50 outbox events; exit 0 |
| `npm run db:verify` | PASS | Direct `tsx` execution completed; exit 0; checksum and all post-reseed assertions passed |

## Verified Assertions

- Seed counts match the approved synthetic manifest.
- Slot `bookedCount` reconciles with pending/confirmed appointments.
- Seed rerun is idempotent: counts and checksum remain stable.
- Synthetic `appointment_ref` values map to the correct appointment ordering and tenant.
- Rejected-policy and duplicate-event outbox fixtures are present.
- Duplicate `processed_events` insertion is rejected.
- Restrictive tenant deletion is rejected.
- Audit event `DELETE` and `UPDATE` operations are rejected by append-only protection.
- PostgreSQL schema constraints were applied by the clean migration.
- No production database or real patient data was used.

## Evidence Output

`db:verify` emitted:

```json
{"counts":{"tenants":2,"users":8,"practitioners":4,"slots":40,"appointments":20,"encounters":10,"observations":10,"outboxEvents":50,"auditEvents":1},"seedChecksum":"d8d0fae9531704afe72e0bdd3f094361df716f1a7a8fe43efff6c1da19819fdb","duplicateProcessedEvent":"rejected","restrictiveTenantDelete":"rejected"}
```

## Cleanup

The disposable PostgreSQL container was removed after the run. No schema, migration, seed, verifier, or application implementation file was modified by the tester.

## Conclusion

`T03` is eligible to transition to `TEST_PASSED`, subject to the independent code-review and evidence-review gates required by the Constitution.
