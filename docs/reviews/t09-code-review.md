# T09 Independent Code Review (Re-Review Cycle 2)

**Task:** T09 — Clinical Encounter, Observation, Audit & Private HAPI FHIR R4 Adapter (plus approved `T08-BACKEND-FOLLOWUP-001`)  
**Decision:** `APPROVE` (for canonical 9-file aggregate SHA-256 `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`, strictly within verified local contract, static, unit, in-memory HTTP, and ephemeral loopback `127.0.0.1` FHIR scope)  
**Reviewer:** Independent code-review session (separate from implementation owner and independent `quality.tester`)  
**Review date (+07:00):** `2026-11-23`  
**Prior review cycle:** `REQUEST_CHANGES` on `deb864ac83df595c8749538b747dea90cc1cb226ef1b83f7210c48ae46dcebec` (blocking items `[BLOCKING-1]`–`[BLOCKING-3]`)  
**Reviewed governance & handoff inputs:** `docs/decisions/t09-clinical-fhir-approval.md` (`T09-CLINICAL-001`), `docs/decisions/t08-backend-followup.md` (`T08-BACKEND-FOLLOWUP-001`), `docs/medicloud/t09-handoff.md`, `docs/evidence/t09-test-report.md`, `packages/contracts/openapi.json`, `packages/contracts/schemas/event-envelope.schema.json`, `packages/contracts/data-classification.json`, `apps/clinical-api/prisma/schema.prisma`  
**Implementation / Test / Handoff / Config modified by this review:** None (strictly read-only review; only `docs/reviews/t09-code-review.md` written)

---

## 1. Canonical Fingerprint & Verification Scope

### 1.1 Canonical 9-File Manifest Verification

Independently recomputed per-file SHA-256 hashes directly from disk via PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath` and constructed the lexicographically sorted LF-joined (`\n`, UTF-8 without BOM) `path=lowercase_sha256` manifest. All 9 hashes and the aggregate SHA-256 match `docs/medicloud/t09-handoff.md` and `docs/evidence/t09-test-report.md` identically:

- **Canonical 9-file aggregate SHA-256:** `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`

| # | Path | Verified SHA-256 (Disk) | Cycle-2 Status |
|---|---|---|---|
| 1 | `apps/clinical-api/src/clinical/service.ts` | `674647ff149be9e7c27c62f3a6b3425924f20d6cb2f3182e1e6230e2c2c6d063` | Remediated & re-inspected |
| 2 | `apps/clinical-api/src/fhir/hapi-fhir-adapter.ts` | `90b8634d088c0aac881f736e4804310ce47fd8eb3a3468b3cfc0f50857b723ce` | Remediated & re-inspected |
| 3 | `apps/clinical-api/src/scheduling/http-adapter.ts` | `49ed96f50ab1876ba98865d0406e8c1f893cf484fe091c47160f41de155beb4a` | Remediated & re-inspected |
| 4 | `apps/clinical-api/src/scheduling/service.ts` | `dac489d392dbb00264f9167dcc21a90ff62adbcce1e7a9591b9a36b06fb3606f` | Unchanged from cycle 1; verified |
| 5 | `apps/clinical-api/src/security/authorization.ts` | `1778877765bd3a89e214dda2a9d28197ac4b5c70954dd31b28e93c1ad529108b` | Unchanged from cycle 1; verified |
| 6 | `docs/evidence/t09-fhir-conformance-fixtures.json` | `4b81276b220964ebb48afe5946c80ca2a5e68ca7a11a1a16fe9fdaafd9a2f7b6` | Unchanged from cycle 1; verified |
| 7 | `tests/clinical.http.test.ts` | `6f35a8db028aed4b65fa4a76e356ec00fdca02326b7fcc7a2e260eaf42a9e498` | Expanded & re-inspected |
| 8 | `tests/clinical.integration.test.ts` | `62eafe67d6f929277e7eae33e9ace21f547392b56e4f6865bb679681b3840ec2` | Expanded & re-inspected |
| 9 | `tests/fhir.adapter.test.ts` | `0b828fc8699541f67e1541556dd4de7554677a1eec8daa24ab691fa004fe108a` | Expanded & re-inspected |

### 1.2 Independent Read-Only Checks Executed

- `npm run contracts:validate` -> exit `0` (`T02 contract validation passed: OpenAPI, event schema, policy and rejection fixtures.`)
- `npm run typecheck` (`tsc --noEmit` with `"strict": true`) -> exit `0` (`0` errors; `tests/**/*.ts` imports all 5 T09 source files into the strict typecheck graph)
- `npm run lint` -> exit `0` (existing `Pages directory cannot be found` advisory only)
- `npx eslint apps/clinical-api/src/fhir/hapi-fhir-adapter.ts apps/clinical-api/src/clinical/service.ts apps/clinical-api/src/scheduling/service.ts apps/clinical-api/src/scheduling/http-adapter.ts apps/clinical-api/src/security/authorization.ts tests/fhir.adapter.test.ts tests/clinical.http.test.ts tests/clinical.integration.test.ts` -> exit `0` (`0` errors, `0` warnings)
- `npx vitest run --reporter=verbose` -> exit `0` (`9` test files passed / `52` tests passed; `3` DB integration test files skipped / `21` tests skipped because `DATABASE_URL` is unset: `tests/scheduling.integration.test.ts` `10`, `tests/outbox.integration.test.ts` `10`, `tests/clinical.integration.test.ts` `1`)

---

## 2. Closure Verification of Cycle-1 Blocking Findings

### 2.1 `[BLOCKING-1]` Atomic `OPEN -> COMPLETED` Transition Guard in `createObservation` — **CLOSED**
- **Verified implementation (`apps/clinical-api/src/clinical/service.ts:433-442`):**
  - Inside `deps.prisma.$transaction(async (tx) => { ... })`, `createObservation` now executes an atomic conditional `tx.encounter.updateMany({ where: { id: encounter.id, tenantId, status: 'OPEN' }, data: { status: 'COMPLETED', completedAt } })` **before** inserting `tx.observation.create` or `tx.outboxEvent.create`.
  - If `transitioned.count !== 1`, it throws `SchedulingError(403, 'resource_state_denied', ...)`, rolling back the transaction cleanly so concurrent requests under PostgreSQL `READ COMMITTED` cannot create duplicate observations or emit duplicate `encounter.completed` outbox events.
- **Verified tests:**
  - `tests/clinical.http.test.ts:224-231, 543-568` exercises `Promise.all` concurrent `POST /v1/encounters/{id}/observations` calls against an `OPEN` encounter and asserts exactly `1` `201`, `1` `403 resource_state_denied`, and `1` `encounter.completed` outbox event.
  - `tests/clinical.integration.test.ts:193-216` adds a PostgreSQL `Promise.allSettled` concurrency assertion (ready to run when `DATABASE_URL` is configured).

### 2.2 `[BLOCKING-2]` Cloud Metadata Host Denial & `FhirTransportError` Wrapping — **CLOSED**
- **Verified implementation (`apps/clinical-api/src/fhir/hapi-fhir-adapter.ts` & `apps/clinical-api/src/clinical/service.ts`):**
  - `assertPrivateFhirEndpoint` (`hapi-fhir-adapter.ts:327-340`) explicitly rejects URL queries/fragments (`fhir_endpoint_query_forbidden`) and cloud metadata hostnames (`metadata`, `instance-data`, `metadata.goog`, `metadata.google.internal`, `*.google.internal`, `*.ec2.internal` -> `FhirBoundaryError('public_fhir_endpoint_forbidden')`).
  - `isValidFhirId` / `isValidFhirReference` (`lines 223-233`) reject `.` and `..` dot-segment IDs/references; `scanForProhibitedContent` (`lines 12, 193`) rejects `eyJ...` JWT-like strings alongside `Bearer` and prohibited PHI keys.
  - `executeFetch` (`lines 380-390`) sets `redirect: 'error'` and `AbortSignal.timeout(timeoutMs)` and catches fetch/network/timeout errors into `FhirTransportError(503, 'fhir_network_error', ...)`; `parseJsonResponse` (`lines 392-398`) catches malformed JSON into `FhirTransportError(502, 'fhir_invalid_json', ...)`.
  - `handleFhirSync` (`clinical/service.ts:157-188`) catches `FhirTransportError`, records a redacted `fhir.sync.failed` `AuditEvent` (`metadata: { reason: error.code, status: error.status }`), and throws `SchedulingError(500, error.code, 'Private FHIR synchronization failed')` without holding DB locks across HTTP I/O.
- **Verified tests (`tests/fhir.adapter.test.ts:116-167`):**
  - Covers `.` / `..` dot-segment rejection, `eyJ...` JWT rejection, `metadata.google.internal`, `instance-data.ec2.internal`, `?query=1`, `ECONNREFUSED` (`503 fhir_network_error`), and `'not-json'` (`502 fhir_invalid_json`).

### 2.3 `[BLOCKING-3]` Safe `x-correlation-id` Normalization & Bounded Request Body — **CLOSED**
- **Verified implementation (`apps/clinical-api/src/scheduling/http-adapter.ts`):**
  - Unauthenticated `GET /v1/specialties` (`lines 75-78`) now invokes `validateCorrelationId(correlationId)`.
  - `safeCorrelationId` (`lines 30-32`) normalizes any correlation ID not matching `/^synthetic-[a-z0-9-]+$/` to `'synthetic-redacted-correlation'` inside both `writeJson` (`lines 212-219`) and `writeError` (`lines 220-223`), preventing untrusted caller headers from being echoed in `x-correlation-id` HTTP headers or error JSON envelopes.
  - `readJson` (`lines 189-199`) enforces a `65_536`-byte cap (`MAX_JSON_BODY_BYTES`).
- **Verified tests (`tests/clinical.http.test.ts:389-403, 521-526`):**
  - Verifies `'untrusted-raw-header'` on both public `GET /v1/specialties` and authenticated `GET /v1/doctors` returns `400 invalid_correlation_id` with `'synthetic-redacted-correlation'` in both response body and `x-correlation-id` header, and verifies oversized observation payloads return `400`.

---

## 3. Comprehensive Audit Summary

| Audit Dimension | Status | Evidence |
|---|---|---|
| **Modularity & Shared Helpers** | **PASS** | `clinical/service.ts` reuses `effectivePrincipal`, `validateCorrelationId`, `SchedulingError`, and `SchedulingDependencies` from `scheduling/service.ts` (`lines 15–20, 44`), shares `normalizePurposeForAudit` (`line 93`), and uses `undefined` instead of a magic sentinel for unassigned practitioners (`line 245`). |
| **OpenAPI 3.1 Contract Alignment** | **PASS (T09 scope)** | `SpecialtyList`, `DoctorList`, `Encounter`, `Observation`, `RecordList`, and `Metrics` match `packages/contracts/openapi.json` (`additionalProperties: false` validated by Ajv in `tests/clinical.http.test.ts`). Observation bounds match Prisma `@db.VarChar(64)`, `@db.Decimal(12, 4)`, and strict ISO-8601 `date-time` (`clinical/service.ts:33, 67, 77, 83`). |
| **DB Transaction vs External HTTP FHIR Boundary** | **PASS** | FHIR R4 construction/validation runs pre-transaction (`handleFhirBuild`), atomic encounter completion + observation + outbox + audit commits inside `$transaction`, and `fhirClient.upsertResource` executes post-commit (`handleFhirSync`) with `fhir.sync.failed` redacted audit fallback on `FhirTransportError`. |
| **Error Mapping & TypeScript / ESLint Cleanliness** | **PASS** | `decision.status as 401 | 403 | 404` accurately models `401 inactive_principal`; `tsc --noEmit` and ESLint pass with `0` errors and `0` warnings. |
| **Unit & HTTP Test Coverage** | **PASS (Local scope)** | `tests/clinical.http.test.ts` covers `useDefaultResolvers: true`, `401`/`403`/`404`/`400`, positive & negative `NURSE` paths, `GUARDIAN` missing-delegation denial, `prohibited_clinical_content`, correlation sanitization, and concurrent observation locking (`52/52` executed Vitest checks passing). |

### Remaining Non-Blocking Notes (Tracked Outside T09 Blockers)

1. **Pre-existing T05 `listSlots` response property (`apps/clinical-api/src/scheduling/service.ts:167`):** Pre-existing T05 code returns `correlation_id` in the `listSlots` JSON body while `SlotList` in `packages/contracts/openapi.json:43` declares `additionalProperties: false` without `correlation_id`. Left untouched outside T09's new schemas.
2. **Untested `redirect: 'error'` and `handleFhirSync` service-level failure path:** `executeFetch` sets `redirect: 'error'` and `clinical/service.ts:174-185` records `fhir.sync.failed` on `FhirTransportError`; these branches are verified by code inspection while `tests/fhir.adapter.test.ts` directly exercises `FhirTransportError` wrapping on network failure and invalid JSON.
3. **PostgreSQL integration deferred (`DATABASE_URL` unset):** Live PostgreSQL constraint checks, `READ COMMITTED` row locking, and DB-backed integration tests (`tests/clinical.integration.test.ts`, `tests/scheduling.integration.test.ts`, `tests/outbox.integration.test.ts`) remain skipped until executed against PostgreSQL.

---

## 4. Independence & Explicit Non-Claims

- Conducted independently from both the T09 implementation owner and the independent `quality.tester` session; zero source, contract, config, test, handoff, or `TestReport` files were modified.
- Verification scope is strictly local unit, contract, static, in-memory HTTP, and ephemeral loopback (`127.0.0.1`) HAPI FHIR conformance (`DATABASE_URL` and `HAPI_FHIR_BASE_URL` unset).
- No claim is made regarding production deployment, live OpenStack HAPI FHIR / Keycloak / PostgreSQL runtime behavior, GCP Cloud Run / Pub/Sub runtime behavior, measured latency/throughput/SLA/RPO/RTO performance, legal/regulatory compliance, or clinical safety.

---

## 5. Final Decision

**Decision:** `APPROVE` (canonical 9-file aggregate SHA-256 `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`, subject to the explicit local-environment non-claims above and completion of the separate independent `Security/Privacy` and `Evidence` review gates before advancing T09 past `READY_FOR_TEST`).
