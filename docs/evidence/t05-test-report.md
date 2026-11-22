# T05 Independent Test Report

**Task:** T05 - scheduling endpoints, capacity locking, idempotency and check-in  
**Tester:** Independent `quality.tester` session  
**Result:** `PASS`  
**Test date:** 2026-11-22 (Asia/Saigon, UTC+07:00)  
**Test timestamp:** 2026-11-22 03:01:31 +07:00  
**Data:** Synthetic fixtures only; no production database, credentials, PHI or PII.

## Environment

- Windows PowerShell
- Node.js v24.16.0, npm 12.2.0
- Docker Engine 29.4.3
- Disposable image: `postgres:16-alpine`
- Disposable database: PostgreSQL 16 on dynamically mapped host port `56865`
- Project declares `pnpm@10.22.0`; this run used the requested npm commands and `npx prisma` because `pnpm` is not on PATH.

## Commands and results

| Command/check | Result | Evidence |
|---|---|---|
| Clean Docker PostgreSQL 16 | PASS | Disposable container readiness check passed |
| `npx prisma migrate deploy --schema apps/clinical-api/prisma/schema.prisma` | PASS | All 3 migrations applied to the empty database; exit 0 |
| `npm run db:validate` | PASS | Prisma schema valid; exit 0 |
| `npm run db:seed` | PASS | 2 tenants, 8 users, 4 practitioners, 40 slots, 20 appointments, 10 encounters, 10 observations, 50 outbox events |
| `npm run db:verify` | PASS | Counts, checksum, mapping, duplicate processed event rejection and restrictive delete checks passed; exit 0 |
| `npm test` with `DATABASE_URL` | PASS | 6 files, `46/46` tests passed; integration suite ran against PostgreSQL; exit 0 |
| `npm run typecheck` | PASS | `tsc --noEmit`; exit 0 |
| `npm run lint` | PASS | Exit 0; only non-failing Pages-directory advisory |
| `npm run contracts:validate` | PASS | OpenAPI, event schema, policy and rejection fixtures passed; exit 0 |
| Disposable container cleanup | PASS | Test container stopped and removed in cleanup |

## Required behavior coverage

- HTTP adapter/default resolver: PASS. `http-adapter.ts` has a Prisma-backed default membership resolver, loads memberships from the database, requires an active user and excludes revoked memberships. The current source contains no `principal.tenantIds[0]` selection.
- Database-authoritative tenant and role: PASS. Integration tests ran with `DATABASE_URL` and cover active membership, wrong token tenant, revoked membership, disabled user and tenant isolation.
- Optional `patient_id`: PASS. Effective patient resolution occurs before tenant-scoped idempotency comparison; omitted-field replay returns the original appointment.
- Channel separation: PASS. Scheduling rejects request `channel`; check-in uses `check_in_channel`; the trusted appointment event uses its allowlisted event `channel`.
- Idempotency and capacity: PASS. Same effective payload replays, changed payload returns `409`, and concurrent booking does not exceed capacity.
- Check-in: PASS. Persistence, repeated-check-in idempotency, valid-state enforcement and same-transaction audit behavior passed.
- Event and rollback behavior: PASS. Full event validation occurs before outbox insertion; failure leaves appointment, slot counter and outbox unchanged.
- HTTP strictness and errors: PASS. Invalid JSON, missing fields and unknown fields are rejected; unexpected database errors return generic `500` with a correlation ID and no stack trace.
- Privacy/logging: PASS. Mutation logs and responses do not expose tokens, raw claims, PHI/PII, stack traces or caller-controlled denial resource references.

## Current-source checks

- `apps/clinical-api/src/scheduling/http-adapter.ts` current SHA-256: `90ff1c7fbaa399ee1052dc4bdcd2808b81d896b78081916fb9b442cb73506c50`
- Default Prisma resolver present: PASS (`options.resolveMembership ?? ...`)
- `principal.tenantIds[0]` present in adapter: NO

## Diff fingerprint

The fingerprint below is freshly calculated from the exact current files listed in this scoped T05 manifest. Each line is UTF-8 encoded as `path=lowercase_sha256` followed by `\n`; the aggregate is SHA-256 of the complete canonical string.

**Scoped aggregate SHA-256:**

`d370344707fe896630b9fb8f64686826bc3861a8ddc58bbc61268f25d35b6032`

| Path | SHA-256 |
|---|---|
| `apps/clinical-api/src/scheduling/service.ts` | `057c0e3ddc2d9be30555c68f8af1891de5396924a8c6039d61957c35ecccb458` |
| `apps/clinical-api/src/scheduling/http-adapter.ts` | `90ff1c7fbaa399ee1052dc4bdcd2808b81d896b78081916fb9b442cb73506c50` |
| `apps/clinical-api/src/scheduling/event-validation.ts` | `8640f6b20617b46b18daaac0902ce68468b9f4fa96750bff62b17ee606d56536` |
| `apps/clinical-api/src/security/authorization.ts` | `6aae73691d01cff36b8c4815c9ba0f1a542de09db3edfa1afc11aa9809690e75` |
| `apps/clinical-api/src/security/redacted-log.ts` | `a871a4971ab3640aecb3c43770e1bc168ffaa8024fce6be5bece128d96b630fe` |
| `apps/clinical-api/prisma/schema.prisma` | `d6caafbaf9f989539b0c01a7948b184622f5ab029bcb2609cfe530bc53b72cce` |
| `apps/clinical-api/prisma/migrations/20261121191548_add_check_in_state/migration.sql` | `d09818418d79900e12eafdc673cbc4625d8eab6d27ed4e0c1de4a6b914f48c8d` |
| `apps/clinical-api/prisma/migrations/20261121193006_add_membership_revocation/migration.sql` | `61bad8550260947c45115eabf0b28348dbffa1f8facf304703dcc063c15456dc` |
| `packages/contracts/openapi.json` | `8cd08055671440afc847cfb11b348587bea309d66d642c91bf8260de171f17de` |
| `packages/contracts/schemas/event-envelope.schema.json` | `d649c1b447e1b90371de94583393035016e619423b36ae78a322e77643a8d72c` |
| `tests/scheduling.test.ts` | `00af68f059d7c68492354bbffd601ee3f6e3326e548ba03134438cbbad5266b6` |
| `tests/scheduling.http.test.ts` | `2f0abe7e3888ee217fc7091b5d8798f48ce210d5098c1c16268162ff06c7862b` |
| `tests/scheduling.integration.test.ts` | `63194c3e41b1b279182895af74e64d137a0a2b66271b9251122a879b50c2009d` |
| `package.json` | `002bb4ff1fad7ba6db9db5450a084503af1c4398c6ce40476868dac9168fff06` |
| `pnpm-lock.yaml` | `05f77bd13eb933c36691541466c7ed9ee51cca6abfa4468c76d8623cfb129f46` |

## Limits

- No live Keycloak/JWKS, OpenStack, Cloud Run or production database was used.
- No production readiness, deployment, SLA, performance, RPO/RTO or compliance claim is made.
- The structured-log checks exercised local redaction paths; no production log sink was used.
- The exact `pnpm exec ...` command was not run because `pnpm` is absent from PATH.

**Tester conclusion:** `PASS` for the requested local T05 schema, migration, HTTP, authorization, idempotency, event, audit, rollback, type, lint and contract gates on the exact current worktree. Independent code review, security/privacy review and evidence review remain separate gates.
