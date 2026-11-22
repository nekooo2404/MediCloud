# T03 PostgreSQL/Prisma Schema Design

**Status:** DESIGN_PROPOSED; implementation and migrations have not started.
**Decision dependency:** `docs/decisions/t03-schema-approval.md`
**Database:** PostgreSQL private boundary only.
**Data:** Synthetic fixtures only.

## 1. Design principles

- Every tenant-owned table has a non-null `tenant_id` and indexes beginning with `tenant_id` where access is tenant-scoped.
- Server-derived identity and membership, not client input, determine tenant access.
- Appointment booking uses a transaction, row lock/capacity check and unique idempotency key.
- Business record and outbox event are committed atomically.
- Audit records are append-only from the application perspective and contain references/metadata, never clinical payloads.
- Clinical source data remains private; external event payloads contain only approved references/aggregates.
- UUID primary keys, UTC timestamps and explicit status enums are used consistently.

## 2. Proposed entities

| Entity | Key fields | Required constraints |
| --- | --- | --- |
| `tenants` | `id`, `code`, `name`, `status` | Unique code; synthetic tenant seed only |
| `organizations` | `id`, `tenant_id`, `name` | Unique `(tenant_id, name)` |
| `users` | `id`, `subject`, `status` | Unique OIDC subject |
| `memberships` | `id`, `tenant_id`, `user_id`, `role` | Unique `(tenant_id, user_id, role)` |
| `patients` | `id`, `tenant_id`, `profile_ref`, `status` | Unique `(tenant_id, profile_ref)` |
| `practitioners` | `id`, `tenant_id`, `user_id`, `specialty` | Unique `(tenant_id, user_id)` |
| `schedules` | `id`, `tenant_id`, `practitioner_id`, `starts_at`, `ends_at` | Practitioner belongs to same tenant; valid time range |
| `appointment_slots` | `id`, `tenant_id`, `schedule_id`, `starts_at`, `capacity`, `booked_count` | Capacity >= 1; booked_count between 0 and capacity |
| `appointments` | `id`, `tenant_id`, `patient_id`, `slot_id`, `status`, `idempotency_key` | Unique `(tenant_id, idempotency_key)`; state transition policy |
| `encounters` | `id`, `tenant_id`, `appointment_id`, `practitioner_id`, `status` | Same-tenant references; assignment required |
| `observations` | `id`, `tenant_id`, `encounter_id`, `code`, `value`, `unit` | Same-tenant encounter; synthetic clinical values |
| `outbox_events` | `event_id`, `tenant_id`, `event_type`, `schema_version`, `payload`, `status` | Unique event_id; retry metadata; no public raw clinical data |
| `audit_events` | `id`, `tenant_id`, `actor_id`, `action`, `resource_ref`, `purpose`, `occurred_at` | Append-only application contract; redacted metadata |
| `processed_events` | `event_id`, `processed_at`, `handler` | Unique event_id for idempotent consumers |

## 3. Relationship and index policy

- Foreign keys use `ON DELETE RESTRICT` for clinical and appointment records; no cascade may silently remove audit/outbox history.
- Required indexes: `(tenant_id, starts_at)` on slots, `(tenant_id, patient_id)` on appointments, `(tenant_id, practitioner_id)` on encounters, `(tenant_id, status)` on outbox, `(tenant_id, occurred_at)` on audit.
- Appointment lookup by id must always include tenant scope in repository predicates.
- Idempotency lookup is scoped by tenant; the same key in two tenants is allowed and independent.
- Outbox polling uses status plus retry time; a dead-letter state is terminal until explicit reconciliation.

## 4. Migration plan

1. Create enums/extensions and base tenant/user tables.
2. Create tenant-owned scheduling and clinical tables with foreign keys/indexes.
3. Create outbox, processed-events and audit tables.
4. Add constraints and indexes in a transaction where PostgreSQL permits; avoid destructive changes.
5. Run synthetic seed in an explicit seed command after migration.
6. Verify row counts, tenant separation and constraint violations on a clean database.

Rollback is forward-compatible: stop application writes, restore the database backup, and deploy the previous migration/image pair. No migration may drop or rewrite clinical content without a separately approved migration decision.

## 5. Synthetic seed manifest

- 2 tenants: `synthetic-hospital-a`, `synthetic-hospital-b`.
- 8-12 users across patient, guardian, receptionist, physician, nurse and auditor roles.
- 4 practitioners and 40 appointment slots, including capacity 1 and 2.
- 20-50 appointments covering `pending`, `confirmed`, `cancelled`, `completed`.
- 10-20 encounters and observations with synthetic codes/units.
- 50-100 outbox events including valid, duplicate and rejected-policy cases.
- No names, phone numbers, identity numbers, diagnoses, DICOM bytes or real identifiers.

## 6. Required checks before implementation

- Prisma schema maps every cross-tenant relation explicitly.
- Clean migration succeeds from an empty PostgreSQL database.
- Seed is deterministic and idempotent in a disposable environment.
- Negative fixtures prove cross-tenant foreign references fail or are not returned.
- Capacity and idempotency constraints are executable, not documentation-only.
- Backup/restore plan includes checksum and row-count evidence.
