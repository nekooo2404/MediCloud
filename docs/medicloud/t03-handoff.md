# T03 Implementation Handoff

**Task:** T03 - PostgreSQL/Prisma schema, migrations and synthetic seeds
**Status:** TEST_PASSED
**Approval:** `docs/decisions/t03-schema-approval.md` is APPROVED.
**Implementation owner:** Coding agent
**Independent tester:** Required before `TEST_PASSED`
**Data classification:** Synthetic only; disposable private PostgreSQL validation database.

## Changed paths

- `apps/clinical-api/prisma/schema.prisma`
- `apps/clinical-api/prisma/migrations/20261121104559_init/migration.sql`
- `apps/clinical-api/prisma/seed.ts`
- `package.json`
- `pnpm-lock.yaml`
- `docs/medicloud/tasks.md`
- `docs/medicloud/t03-handoff.md`
- `apps/clinical-api/prisma/verify-seed.ts`
- `docs/evidence/t03-migration-seed.md`
- `docs/evidence/t03-test-report.md`
- `docs/reviews/t03-schema-review.md`

## Delivered behavior

- Prisma 6.19 PostgreSQL schema with UUIDs, UTC timestamps and explicit enums.
- Composite same-tenant foreign keys for patient, practitioner, schedule, slot, appointment, encounter and observation relationships.
- Tenant-scoped unique idempotency key for appointments.
- Transaction-supporting outbox, processed-event and append-only audit structures.
- Restrictive delete behavior for domain history.
- Deterministic synthetic seed with 2 tenants, 8 users, 4 practitioners, 40 slots, 20 appointments, 10 encounters, 10 observations and 50 outbox events.
- Seed is idempotent through upserts and was executed twice with stable counts.

## Validation evidence

| Check | Result |
| --- | --- |
| `prisma validate` with synthetic `DATABASE_URL` | PASS |
| `prisma migrate dev --name init` on disposable PostgreSQL 16 | PASS |
| `npm run db:seed` first run | PASS; expected counts |
| `npm run db:seed` second run | PASS; unchanged counts |
| `npm run db:verify` | PASS; checksum/reseed, tenant mapping, audit DELETE/UPDATE, outbox fixtures, duplicate processing and restrictive delete |
| Disposable database cleanup | PASS; container stopped |

## Scope limitations

- Production/private OpenStack database deployment.
- Backup/restore measurement; reserved for integrated environment evidence.
