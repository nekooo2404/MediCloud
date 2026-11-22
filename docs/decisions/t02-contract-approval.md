# T02 Contract, Event, and Data Classification Approval

**Decision ID:** T02-CONTRACTS-001
**Status:** APPROVED
**Requested approver:** Project owner
**Accountable domain:** Architecture and data governance
**Implementation owner:** Assigned coding agent after approval
**Independent tester/reviewer:** Required after implementation
**Data policy:** Synthetic data only; no real PHI/PII, credentials, tokens or patient-record content.

## Decision requested

Approve the P0 API contracts, event envelope/allowlist, data classifications and cross-cloud transfer boundary below so T02 can move from `GATED` to `READY`, then `IMPLEMENTING`.

Approval covers the contract shape and policy boundary only. It does not approve production deployment, real data, legal compliance, clinical safety, or unmeasured performance claims.

## 1. P0 API contract

All endpoints are under `/v1`. Authentication is OIDC bearer access token. The private Clinical API derives `tenant_id`, subject and membership from validated claims/server-side membership; client-supplied tenant identifiers are selectors at most and never authorization input.

### Read and scheduling endpoints

| Method | Path | Request | Response | Boundary |
| --- | --- | --- | --- | --- |
| `GET` | `/specialties` | None | `{data: Specialty[]}` | Public-safe catalog or policy-approved |
| `GET` | `/doctors?tenant_id={id}` | Query selector | `{data: DoctorSummary[]}` | Server verifies membership/scope |
| `GET` | `/slots?doctor_id={id}&from={iso}&to={iso}` | Query selectors | `{data: Slot[]}` | Must not reveal patient data |
| `POST` | `/appointments` | `{slot_id, patient_id?, idempotency_key}` | `201 {appointment}` or existing result for same key | Patient/guardian/staff policy |
| `GET` | `/appointments/:id` | Path ID | `{appointment}` | Owner, authorized guardian or staff |
| `POST` | `/appointments/:id/check-in` | `{channel}` | `{appointment}` | Receptionist and same tenant |

### Clinical and audit endpoints

| Method | Path | Request | Response | Boundary |
| --- | --- | --- | --- | --- |
| `POST` | `/encounters` | `{appointment_id, practitioner_id}` | `201 {encounter}` | Assigned clinician/workflow |
| `POST` | `/encounters/:id/observations` | `{code, value, unit, measured_at}` | `201 {observation}` | Assigned clinician/nurse policy |
| `GET` | `/me/records` | Release-policy query | `{data: RecordSummary[]}` | Subject/guardian only |
| `GET` | `/admin/metrics` | Date/scope query | Aggregated metrics | FacilityAdmin/Auditor scope |

### Common API rules

- Error shape: `{error: {code, message, correlation_id, details?}}`; no stack traces or clinical content in responses.
- `401` means missing/invalid authentication; `403` means authenticated but not authorized; `404` may be used to avoid resource disclosure.
- `Idempotency-Key` header and body `idempotency_key` must refer to the same logical request; server stores the request key and resulting resource reference.
- Appointment creation uses a transaction, capacity lock/constraint and outbox insert in one commit.
- All mutation responses include `correlation_id`; logs use the same identifier without sensitive payloads.
- API schema will be published as OpenAPI after approval and validated in CI.

## 2. Event contract

Events use a versioned envelope:

```json
{
  "event_id": "uuid",
  "event_type": "appointment.created",
  "schema_version": 1,
  "tenant_id": "synthetic-tenant-a",
  "occurred_at": "ISO-8601 UTC",
  "correlation_id": "trace-id",
  "payload": {}
}
```

### Allowlisted event types and payloads

| Event type | Producer | Allowed payload | Destination |
| --- | --- | --- | --- |
| `appointment.created` | Scheduling API | `appointment_ref`, `channel` | GCP Pub/Sub |
| `appointment.cancelled` | Scheduling API | `appointment_ref`, `reason_category` | GCP Pub/Sub |
| `encounter.completed` | Clinical API | approved counts/metadata only | GCP Pub/Sub |
| `report.ready` | Clinical API | `resource_ref` only; no result | GCP Pub/Sub |
| `notification.requested` | Policy gateway | `template_id`, `channel_token` | GCP Pub/Sub |
| `analytics.daily_summary` | Private analytics | date marker and thresholded aggregates | GCP/approved analytics |

Default-deny event policy rejects events missing `event_id`, `event_type`, `schema_version`, `tenant_id`, `occurred_at` or `correlation_id`. It also rejects names, phone numbers, identity numbers, diagnoses, raw clinical results, DICOM content, access tokens and secrets.

The producer writes the business record and outbox row in one PostgreSQL transaction. Relay publication is retryable. The consumer stores processed `event_id` with a unique constraint, so relay/consumer retries are harmless. Schema changes require a new `schema_version` and backward-compatible consumer handling.

## 3. Data classification and cloud boundary

| Class | Examples | Allowed location/flow | Controls |
| --- | --- | --- | --- |
| `public` | Service descriptions, FAQ | GCP or private | Normal integrity and availability controls |
| `internal` | Non-sensitive configuration, synthetic operational metadata | Private; approved metadata may reach GCP | IAM, redacted logs, least privilege |
| `sensitive` | Synthetic identity, appointment ownership, encounter metadata | Private by default; only approved references/aggregates cross boundary | Tenant policy, purpose/assignment checks, encryption, audit |
| `restricted-clinical` | Clinical record content, synthetic FHIR clinical resources, DICOM | Private OpenStack only for P0 | Backend authorization, audit, no public DB, no default event transfer |

Cross-cloud transfer is limited to the event allowlist and approved synthetic aggregate/reference fields. The private Clinical API and PostgreSQL remain the system of record. Public-cloud services must not cache raw clinical records or expose the private database.

## 4. Compatibility and impact

- T03 schema and migrations depend on these resource names, ownership fields and outbox constraints.
- T04 authorization depends on validated tenant membership, role, assignment, purpose and resource state.
- T05 booking depends on slot capacity and idempotency semantics.
- T06 relay depends on the envelope, allowlist and versioning rules.
- T07 worker depends on `event_id` idempotency and dead-letter behavior.
- Changing these decisions after implementation invalidates dependent tests and review evidence.

## 5. Approval gates and evidence

After approval, T02 must produce:

- OpenAPI contract and event JSON schemas.
- Data dictionary with sensitive/non-sensitive fields.
- Policy tests for rejected payloads and missing envelope fields.
- Schema validation command and report.
- Independent architecture/data/security review.
- Decision record updated with approver, timestamp and approval text.

## Approval record

**Decision:** APPROVED
**Approver:** Project owner
**Timestamp (+07:00):** 2026-11-21
**Approval text:** I approve `T02-CONTRACTS-001`, with the scope and conditions specified in `docs/decisions/t02-contract-approval.md`.
**Conditions/exceptions:** Scope and conditions are exactly those recorded in this decision record. No real data, production deployment, legal compliance, clinical safety or performance claim is approved by this decision.
