# T05 Scheduling API, Idempotency, and Event Synchronization Approval

**Decision ID:** T05-API-001
**Status:** APPROVED
**Scope:** Scheduling HTTP endpoints, appointment idempotency, event publication and validation.
**Data:** Synthetic only.

## Decisions requested

1. `channel` belongs exclusively to the `appointment.created` event payload. It is not accepted in the scheduling request. The producer sets it from trusted server workflow context (`portal` or `staff`).
2. `patient_id` remains optional in `CreateAppointment`. If omitted, the backend uses the authenticated patient's server-side membership. If supplied, the backend requires same-tenant ownership or an active server-validated guardian delegation.
3. Idempotency fingerprint includes effective tenant, effective patient, slot and trusted server channel context. Same key/same fingerprint returns the original result; a different fingerprint returns `409`.
4. All request schemas use `additionalProperties: false`. Invalid JSON, missing fields and unknown fields return `400`; unexpected server/database errors return generic `500` with correlation ID.
5. Event envelope and payload are validated against the T02 allowlist before outbox insertion. Structured mutation logs redact tokens, claims, PHI/PII and stack traces.

## Required implementation tests

- All four scheduling endpoints: valid request, invalid JSON, missing fields, unknown fields, unauthorized role, revoked membership and tenant mismatch.
- `patient_id` omitted, self, guardian delegation, wrong tenant and unauthorized patient.
- Same idempotency key/same fingerprint and same key/different slot/patient/channel context.
- Rollback when appointment insert succeeds but outbox validation/write fails.
- Event payload allowlist and redacted response/log assertions.

## Approval record

**Decision:** APPROVED
**Approver:** Project owner
**Timestamp (+07:00):** 2026-11-22
**Approval text:** I approve `T05-API-001` subject to the scope and conditions set out in its decision record.
**Conditions/exceptions:** No production deployment, real data, legal compliance or clinical-safety claim is approved by this decision.
