# T08 Backend Follow-Up Proposal (T04 / T05 Alignment)

**Document ID:** T08-BACKEND-FOLLOWUP-001
**Status:** APPROVED & RESOLVED IN T09 (Approved via `T09-CLINICAL-001` Clarify `A2` in `docs/decisions/t09-clinical-fhir-approval.md`)
**Origin:** Discovered during T08 Patient & Staff Portal specification and contract check
**Related files:** `apps/clinical-api/src/security/authorization.ts`, `apps/clinical-api/src/scheduling/http-adapter.ts`, `packages/contracts/openapi.json`

## 1. Findings

1. **Missing `slot:read` permission for `PATIENT` (and `GUARDIAN`) in T04 RBAC matrix**
   - **Current state:** `apps/clinical-api/src/security/authorization.ts` grants `'slot:read'` only to `RECEPTIONIST`, `PHYSICIAN`, and `NURSE`.
   - **Contract / Spec expectation:** `docs/medicloud/specification.md` AC-02 states *"A patient can list permitted slots and create an appointment through the GCP entry point"*, and `packages/contracts/openapi.json` documents `GET /v1/slots` for scheduling flows.
   - **Impact when BFF switches to Upstream Clinical API mode:** Direct `GET /v1/slots` calls authenticated as a `PATIENT` return `403 role_action_denied` until `slot:read` is approved and enabled for `PATIENT`/`GUARDIAN` (or provided via a policy-approved BFF service token / catalog projection).

2. **Catalog HTTP endpoints not yet mounted on `clinical-api` HTTP adapter**
   - **Current state:** `packages/contracts/openapi.json` specifies `GET /v1/specialties` and `GET /v1/doctors`, whereas `apps/clinical-api/src/scheduling/http-adapter.ts` currently mounts `/v1/slots`, `/v1/appointments`, `/v1/appointments/{id}`, and `/v1/appointments/{id}/check-in`.
   - **Impact:** T08's BFF serves synthetic specialty and doctor catalog data locally when `CLINICAL_API_BASE_URL` is unset and falls back safely or reads upstream catalog endpoints once exposed in `clinical-api`.

## 2. Recommended Next Action

Keep T08 strictly scoped to `apps/patient-portal/` and open a focused backend security/API decision record under T04/T05 governance before switching Staging/E2E (`T13`) from Synthetic Local BFF mode to live Upstream Clinical API mode.
