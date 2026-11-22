# T03 Schema, Migration, and Seed Approval

**Decision ID:** T03-SCHEMA-001
**Status:** APPROVED
**Requested approver:** Project owner
**Decision artifact:** `docs/medicloud/t03-schema-design.md`
**Implementation boundary:** `apps/clinical-api/`, `packages/`, `tests/`, `docs/`
**Data policy:** Synthetic data only; PostgreSQL remains private.

## Approval requested

Approve the proposed PostgreSQL/Prisma domain schema, tenant constraints, outbox/idempotency/audit model, migration strategy and synthetic seed manifest in `t03-schema-design.md`.

This approval does not authorize production deployment, real data, database credentials, destructive migrations, legal compliance claims or clinical use.

## Decisions requiring approval

1. UUID identifiers and UTC timestamps for all domain records.
2. `tenant_id` on every tenant-owned table and tenant-scoped repository access.
3. Unique `(tenant_id, idempotency_key)` for appointment creation.
4. Transactional outbox with unique `event_id` and separate `processed_events` idempotency store.
5. Append-only application audit contract with redacted metadata.
6. Restrictive foreign-key deletes for appointments, encounters, observations, audit and outbox history.
7. Deterministic synthetic seed volumes and tenant A/B negative fixtures.
8. Reversible migration and backup/restore requirements described in the design.

## Required post-approval evidence

- Prisma schema and migration files.
- Clean-database migration report.
- Synthetic seed report with counts/checksum.
- Constraint and cross-tenant negative tests.
- Independent schema/data review.
- TestReport tied to the implementation diff.

## Approval record

**Decision:** APPROVED
**Approver:** Project owner
**Timestamp (+07:00):** 2026-11-21
**Approval text:** I approve `T03-SCHEMA-001`, with the scope and conditions outlined in `docs/decisions/t03-schema-approval.md`.
**Conditions/exceptions:** No real data, production deployment, destructive migration, legal compliance claim or clinical use is approved by this decision.
