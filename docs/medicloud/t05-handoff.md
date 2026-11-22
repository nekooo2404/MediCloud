# T05 Implementation Handoff

**Task:** T05 - Scheduling endpoints, capacity locking, idempotency and check-in
**Status:** TEST_PASSED
**Approvals:** `T05-API-001` and `T05-CHECKIN-SCHEMA-001` are APPROVED.
**Implementation owner:** Coding agent
**Independent tester:** Required before `TEST_PASSED`
**Data:** Synthetic only; disposable PostgreSQL integration environment.

## Delivered behavior

- Scheduling service and HTTP adapter for slots, appointment creation, appointment lookup and check-in.
- `channel` removed from scheduling request; it is generated only in the trusted event context.
- `check_in_channel` is a distinct check-in HTTP field; the scheduling/event `channel` field remains event-only.
- Optional `patient_id` resolves through server-side patient membership when omitted; explicit IDs require ownership/delegation policy.
- Database membership resolution is authoritative for tenant and role; token `tenantIds[0]`/global roles are not sufficient.
- The HTTP adapter wires a Prisma-backed membership resolver by default; injected resolvers are test seams only.
- Multiple active memberships require an unambiguous tenant match; revoked membership rows and disabled users are denied.
- Slot row locking, capacity enforcement and tenant-scoped idempotency.
- Same idempotency key/fingerprint replays; changed request returns `409`.
- Check-in schema/migration persists status, timestamp and actor; repeated check-in is idempotent and invalid appointment states are denied.
- Strict JSON validation rejects invalid JSON, missing fields and unknown fields; unexpected failures return generic `500`.
- Event envelope/payload is validated before outbox insertion; channel is allowlisted to `portal|staff`.
- Check-in writes an append-only audit event in the same transaction as the state transition.
- Outbox validation failure rolls back the appointment and slot counter transaction.
- Responses include correlation IDs and avoid tokens, raw claims, PHI/PII, stack traces and sensitive logs.

## Changed paths

- `apps/clinical-api/src/scheduling/`
- `apps/clinical-api/src/security/authorization.ts`
- `apps/clinical-api/prisma/schema.prisma`
- `apps/clinical-api/prisma/migrations/20261121191548_add_check_in_state/migration.sql`
- `apps/clinical-api/prisma/migrations/20261121193006_add_membership_revocation/migration.sql`
- `apps/clinical-api/src/security/redacted-log.ts`
- `apps/clinical-api/src/scheduling/event-validation.ts`
- `packages/contracts/openapi.json`
- `tests/scheduling.test.ts`
- `tests/scheduling.http.test.ts`
- `tests/scheduling.integration.test.ts`
- `package.json`, `pnpm-lock.yaml`, `docs/medicloud/tasks.md`

## Validation run

- Clean PostgreSQL 16 migration: PASS.
- Full suite on disposable PostgreSQL: PASS, `46/46` tests.
- Unit/HTTP suite without DB: PASS, `37` tests; integration cases are skipped without `DATABASE_URL`.
- Typecheck: PASS.
- Lint: PASS with existing non-failing App Router advisory.
- Contract validator: PASS.

**Current aggregate fingerprint:** `d370344707fe896630db9fb8f64686826bc3861a8ddc58bbc61268f25d35b6032`

## Environment limitations

- No production OpenStack database or Keycloak realm was used.
- Live JWKS, database-backed production authorization and deployment evidence remain environment-gated.
- The current T03 model has no dedicated patient-to-user foreign key; omitted `patient_id` resolves only through the approved server-side `profileRef == subject` mapping and otherwise returns `patient_required`.
