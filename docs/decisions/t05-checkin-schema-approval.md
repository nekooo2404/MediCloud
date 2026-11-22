# T05 Check-in Schema Update Approval

**Decision ID:** T05-CHECKIN-SCHEMA-001
**Status:** APPROVED
**Scope:** Appointment check-in persistence and API contract.
**Data:** Synthetic only.

## Decision requested

Approve adding explicit check-in state to `Appointment`:

- `checkInStatus`: `NOT_CHECKED_IN | CHECKED_IN | VOIDED`, default `NOT_CHECKED_IN`.
- `checkedInAt`: nullable UTC timestamp.
- `checkedInByUserId`: nullable restrictive foreign key to `users`.

`POST /v1/appointments/{id}/check-in` is idempotent for an already checked-in appointment, requires active same-tenant receptionist membership, and rejects cancelled/completed appointments. A valid transition writes an audit event with purpose and correlation ID. Existing appointments receive `NOT_CHECKED_IN` through an expand/backfill migration.

## Required evidence

- Prisma schema and migration with default/backfill.
- OpenAPI update and strict request/response validation.
- Role, tenant, revoked-membership, valid-state and duplicate check-in tests.
- Independent schema/security/API review and TestReport.

## Approval record

**Decision:** APPROVED
**Approver:** Project owner
**Timestamp (+07:00):** 2026-11-22
**Approval text:** I approve `T05-CHECKIN-SCHEMA-001` subject to the scope and conditions set out in its decision record.
**Conditions/exceptions:** No production deployment, real data, legal compliance or clinical-safety claim is approved by this decision.
