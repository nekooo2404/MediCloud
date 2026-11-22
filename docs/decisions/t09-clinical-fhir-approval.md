# T09 Clinical Workflow, Audit, and Private HAPI FHIR Adapter Approval

**Decision ID:** T09-CLINICAL-001
**Status:** APPROVED
**Requested approver:** Project owner
**Accountable owner:** Project owner
**Implementation boundary:** `apps/clinical-api/`, `packages/contracts/`, `tests/`, `docs/`
**Dependencies:** T03 (`TEST_PASSED`), T04 (`TEST_PASSED`), T05 (`TEST_PASSED`), T06 (`TEST_PASSED`)
**Data policy:** Synthetic data only (`restricted-clinical` within private boundary; approved metadata only in outbox). No real PHI/PII, credentials, bearer tokens, private keys, or real patient-record content.

## 1. Approved Decisions (Clarify Record A1–A2)

1. **Clinical Encounter, Observation, Records, Metrics & Private HAPI FHIR R4 Adapter (`A1`):**
   - Implement OpenAPI endpoints inside `apps/clinical-api/`:
     - `POST /v1/encounters` — creates an `OPEN` encounter for a `CONFIRMED` or `COMPLETED` appointment only when caller holds `PHYSICIAN` role, same tenant derived from active server-side membership, valid treatment assignment (`appointment.slot.schedule.practitionerId === practitionerId` and `practitioner.user.subject === principal.subject`), and an allowed `x-purpose-of-use` header (`treatment`, `care_coordination`, `operations`, `audit`).
     - `POST /v1/encounters/{id}/observations` — records a synthetic `Observation` for an `OPEN` encounter when caller holds `PHYSICIAN` or `NURSE` role, same tenant, assigned practitioner, and allowed `x-purpose-of-use`, completes the encounter atomically, emits an allowlisted `encounter.completed` outbox event (`encounter_ref`, `observation_count`), and rejects prohibited PHI/PII or unknown fields.
     - `GET /v1/me/records` — returns synthetic record references (`encounter` / `observation`) only for `PATIENT` self-ownership or active same-tenant `GUARDIAN` delegation (`RECEPTIONIST` denied `403`).
     - `GET /v1/admin/metrics` — returns tenant-scoped synthetic aggregate counts only for `AUDITOR`.
   - Enforce backend RBAC/ABAC with disclosure-safe `404` across tenants (AC-05) and write append-only redacted `AuditEvent` records (`toAuthorizationAudit`-compatible synthetic references, zero tokens/PHI) in the same database transaction for clinical writes/reads and on denied clinical authorization attempts.
   - Implement Private-Boundary HAPI FHIR R4 Adapter (`apps/clinical-api/src/fhir/hapi-fhir-adapter.ts`) mapping synthetic `Patient`, `Encounter`, and `Observation` resources to valid FHIR R4 JSON (`validateFhirR4Resource`), enforcing `restricted-clinical` private boundary host validation (`assertPrivateFhirEndpoint` rejects public internet/cloud hosts), and supporting `PUT`/`GET` against a private HAPI FHIR R4 service (`HAPI_FHIR_BASE_URL` / ephemeral HTTP mock server in automated conformance tests, AC-11).

2. **Resolution of T08 Backend Follow-Up Proposal (`A2` — `T08-BACKEND-FOLLOWUP-001`):**
   - Approve and integrate `docs/decisions/t08-backend-followup.md` into T09 within `apps/clinical-api/`:
     - Grant `'slot:read'` to `PATIENT` and `GUARDIAN` in `apps/clinical-api/src/security/authorization.ts` so AC-02 slot queries succeed for authenticated patients/guardians.
     - Implement `GET /v1/specialties` and `GET /v1/doctors` in `apps/clinical-api/src/scheduling/service.ts` and `apps/clinical-api/src/scheduling/http-adapter.ts` matching `packages/contracts/openapi.json` (`SpecialtyList` and `DoctorList`), deriving authorization scope solely from validated server membership (treating `tenant_id` query parameters as non-authoritative).

## 2. Required Post-Approval Evidence & Gates

- Independent `quality.tester` `TestReport` (`docs/evidence/t09-test-report.md`) tied to exact canonical SHA-256 diff fingerprint, covering AC-05, AC-06, AC-08, AC-11, and `T08-BACKEND-FOLLOWUP-001`.
- Validated FHIR R4 conformance fixture (`docs/evidence/t09-fhir-conformance-fixtures.json`) and negative PHI/cross-tenant/public-host rejection tests (`tests/fhir.adapter.test.ts`, `tests/clinical.http.test.ts`, `tests/clinical.integration.test.ts`).
- Independent Code Review (`docs/reviews/t09-code-review.md`), Security/Privacy Review (`docs/reviews/t09-security-privacy-review.md`), and Evidence Review (`docs/reviews/t09-evidence-review.md`).

## 3. Explicit Non-Claims

This approval covers local T09 backend/FHIR implementation, contract/conformance fixtures, and automated verification only. It does **not** approve or claim production deployment, live OpenStack/GCP/HAPI FHIR/Keycloak runtime deployment, real patient data, legal compliance, clinical safety, or measured latency/SLA performance.

## Approval record

**Decision:** APPROVED
**Approver:** Project owner (Clarify answers A1–A2)
**Timestamp (+07:00):** 2026-11-23
**Approval text:** Approved via interactive project-owner clarification (`A1` and `A2`) to unlock T09 (`GATED: clinical/data approval` -> `READY` -> `IMPLEMENTING`) and incorporate `T08-BACKEND-FOLLOWUP-001`.
