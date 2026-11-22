# T05 Independent Code/API/Schema Review

**Task:** T05 - scheduling endpoints, capacity locking, idempotency and check-in  
**Reviewer:** Independent code/API/schema review session  
**Review date:** 2026-11-22 (Asia/Saigon, UTC+07:00)  
**Decision:** `APPROVED` (local implementation; environment limits apply)

## Scope and evidence

Reviewed the current worktree against:

- `docs/evidence/t05-test-report.md`
- `docs/medicloud/t05-handoff.md`
- Approved decisions `T05-API-001` and `T05-CHECKIN-SCHEMA-001`
- T02 OpenAPI and event-envelope contracts

The current scoped fingerprint was independently recomputed from the 15 manifest paths:

`d370344707fe896630b9fb8f64686826bc3861a8ddc58bbc61268f25d35b6032`

It matches the fingerprint in `docs/evidence/t05-test-report.md`. The current
`http-adapter.ts` SHA-256 also matches the report:

`90ff1c7fbaa399ee1052dc4bdcd2808b81d896b78081916fb9b442cb73506c50`

## Review findings

### Tenant and membership authority: PASS

- No `tenantIds[0]` selection exists in the scheduling implementation.
- `http-adapter.ts` wires a default Prisma-backed membership resolver.
- The resolver loads the user and memberships from the database, requires an
  active user and excludes revoked memberships.
- `effectivePrincipal()` requires exactly one active membership and derives the
  effective tenant and roles from that database result.
- Token tenant claims and global token roles are not the final tenant/role
  authority in the default runtime path.

### Optional patient and idempotency: PASS

- `patient_id` is optional in OpenAPI and the request parser.
- The effective patient is resolved before the idempotency lookup when the field
  is omitted.
- The replay fingerprint compares the stored effective patient, slot and trusted
  server channel context.
- Reuse with a materially different request returns `409 idempotency_conflict`.
- The independent PostgreSQL run covered omitted-patient replay and changed
  payload conflict behavior.

### Channel semantics and event validation: PASS

- Scheduling `CreateAppointment` has no request `channel` property and rejects
  unknown fields.
- Check-in uses the separate `check_in_channel` request property with `desk|portal`.
- The trusted appointment event uses its event-only `channel` with the approved
  `portal|staff` allowlist.
- The complete T02 event JSON Schema is validated before the outbox insert;
  payload-specific properties are closed with `additionalProperties: false`.

### Check-in and transaction behavior: PASS

- The approved check-in migration persists status, timestamp and actor.
- Check-in state transition and append-only `AuditEvent` creation occur in one
  Prisma transaction.
- Repeated check-in is idempotent and cancelled appointments are denied.
- The integration run covered check-in persistence, audit creation and valid
  state enforcement.

### HTTP contract and privacy behavior: PASS

- Appointment and check-in request bodies reject invalid JSON, missing required
  fields and unauthorized fields.
- OpenAPI request and response schemas are closed where required.
- Unexpected failures are logged through the redacted structured logger and
  return a generic `500` response with a correlation ID and no stack trace.
- The tested responses/logs do not expose tokens, raw claims, PHI/PII or
  caller-controlled denial resource references.

## Verification performed

- Disposable PostgreSQL 16 container: migration from empty database passed.
- `npm test -- --run` with `DATABASE_URL`: **46/46 passed**, 6 test files.
- `npm run typecheck`: passed.
- `npm run lint`: passed; only the existing non-failing Pages-directory advisory
  was emitted.
- `npm run contracts:validate`: passed.
- The disposable PostgreSQL container was removed after testing.

## Limits and follow-up state

- No live Keycloak/JWKS, OpenStack, Cloud Run or production database was used.
- This review does not claim deployment, production readiness, performance,
  SLA, RPO/RTO, compliance or backup/restore evidence.
- The handoff document still says `READY_FOR_TEST`; the orchestrator should
  synchronize the task state and record this review before advancing the gate.
- `pnpm` was not on PATH; the review used the documented npm commands and
  `npx`/Corepack-compatible project tooling.

## Conclusion

The current T05 implementation, API contracts and schema changes satisfy the
reviewed local requirements and match the fresh exact-diff TestReport. This
code/API/schema review is **APPROVED**, subject to the explicitly listed
environment limits and the required independent security/privacy and evidence
gates.
