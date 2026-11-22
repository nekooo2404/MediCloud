# T09 Independent Test Report

**Task:** T09 — Encounter, Observation, Audit & Private HAPI FHIR R4 Adapter (plus approved `T08-BACKEND-FOLLOWUP-001`)  
**Decision:** `T09-CLINICAL-001` — `APPROVED` (`docs/decisions/t09-clinical-fhir-approval.md`), resolving `T08-BACKEND-FOLLOWUP-001` (`docs/decisions/t08-backend-followup.md`)  
**Handoff:** `docs/medicloud/t09-handoff.md` (`READY_FOR_TEST` — Post-remediation cycle 2 addressing Code Review `REQUEST_CHANGES` items `[BLOCKING-1]`–`[BLOCKING-3]` and security/test hardening)  
**Tester:** Independent `quality.tester` session (separate from implementation owner)  
**Status:** `PASS` for canonical 9-file aggregate SHA-256 `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23` (**strictly within verified local contract, static, unit, in-memory HTTP, and ephemeral loopback `127.0.0.1` FHIR conformance scope**; PostgreSQL runtime integration tests and `db:validate` remain **SKIPPED / NOT RUN** because `DATABASE_URL` is unset)  
**Test window (+07:00):** `2026-11-23T01:44:52+07:00` – `2026-11-23T01:45:46+07:00`  
**Data classification:** Synthetic data only (`restricted-clinical-synthetic` confined to private boundary; allowlisted `encounter.completed` reference/count metadata only in outbox). Zero real PHI/PII, credentials, bearer tokens, private keys, or real patient-record content.

---

## 1. Environment, Out-of-Scope Boundary, and Hash Integrity Checks

- **Workspace root:** `d:\hoapuiii\Code\MediCloud` (Windows 11 local workspace)
- **Runtime versions:** Node `v24.16.0`; npm `12.2.0`; Corepack pnpm `10.22.0`; Vitest `v3.2.7`
- **Relevant environment variables:**
  - `DATABASE_URL`: **Unset** (`False`) — PostgreSQL integration suites (`tests/scheduling.integration.test.ts`, `tests/outbox.integration.test.ts`, `tests/clinical.integration.test.ts`) skipped via `describe.skip`, and `npm run db:validate` exited with code `2`.
  - `HAPI_FHIR_BASE_URL`: **Unset** (`False`) — FHIR HTTP adapter checks ran against ephemeral loopback (`127.0.0.1`) HTTP mock servers and `fetchImpl` stubs in Vitest rather than a live OpenStack HAPI FHIR container.
  - `CLINICAL_API_BASE_URL`: **Unset** (`False`).
- **T08 portal & contract boundary check (`apps/patient-portal/` and `packages/` untouched):**
  - Independently recomputed SHA-256 hashes for all 24 canonical T08 files directly from disk via PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath` (including dynamic route `[id]` files), joined with LF (`\n`), UTF-8 without BOM. Recomputed aggregate SHA-256 is `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc`, matching `docs/evidence/t08-test-report.md` and `docs/medicloud/t08-handoff.md`.
  - Checked all non-`.next` files in `apps/patient-portal/` and all files in `packages/` for `LastWriteTime > 2026-11-23T01:05:00+07:00`: **`0`** modified files in `apps/patient-portal/` and **`0`** modified files in `packages/`.
- **T09 cycle-2 manifest integrity:**
  - Independently recomputed SHA-256 hashes of all 9 T09 files directly from disk via PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath` and built the canonical lexicographically sorted manifest (`path=lowercase_sha256` joined by `\n`, UTF-8 without BOM).
  - Recomputed aggregate SHA-256 `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23` matches `docs/medicloud/t09-handoff.md` identically.
- **Tester write scope:** Only updated `docs/evidence/t09-test-report.md`; zero application, contract, config, or test files were modified.

---

## 2. Independent Commands & Observed Results

| Command / Check | Start (`+07:00`) | End (`+07:00`) | Exit | Observed Output & Counts |
|---|---|---|---|---|
| `npm run contracts:validate` | `2026-11-23T01:45:26+07:00` | `2026-11-23T01:45:27+07:00` | `0` | `T02 contract validation passed: OpenAPI, event schema, policy and rejection fixtures.` |
| `npm run db:validate` | `2026-11-23T01:45:28+07:00` | `2026-11-23T01:45:28+07:00` | `2` | `DATABASE_URL is required for schema validation.` (`apps/clinical-api/prisma/validate-schema.mjs` aborted early before `prisma validate` because `DATABASE_URL` is unset.) |
| `npm run typecheck` | `2026-11-23T01:45:30+07:00` | `2026-11-23T01:45:31+07:00` | `0` | `tsc --noEmit` completed with `0` errors. |
| `npm run lint` | `2026-11-23T01:45:32+07:00` | `2026-11-23T01:45:33+07:00` | `0` | `eslint tools/medicloud-agent-company/src apps/patient-portal/app apps/patient-portal/next.config.ts` passed with `0` errors (pre-existing `Pages directory cannot be found` advisory from `no-html-link-for-pages`). |
| `npx eslint apps/clinical-api/src/fhir/hapi-fhir-adapter.ts apps/clinical-api/src/clinical/service.ts apps/clinical-api/src/scheduling/service.ts apps/clinical-api/src/scheduling/http-adapter.ts apps/clinical-api/src/security/authorization.ts tests/fhir.adapter.test.ts tests/clinical.http.test.ts tests/clinical.integration.test.ts` | `2026-11-23T01:45:40+07:00` | `2026-11-23T01:45:41+07:00` | `0` | Passed with `0` errors and `0` warnings across all 8 T09 TypeScript source and test files. |
| `npm test` | `2026-11-23T01:45:42+07:00` | `2026-11-23T01:45:43+07:00` | `0` | Vitest `v3.2.7`: **`9` test files passed (`52` tests passed)**, **`3` DB integration test files skipped (`21` tests skipped)** (`tests/scheduling.integration.test.ts`: `10`, `tests/outbox.integration.test.ts`: `10`, `tests/clinical.integration.test.ts`: `1`) because `DATABASE_URL` is unset. Duration `893ms`. |
| `npx vitest run tests/fhir.adapter.test.ts tests/clinical.http.test.ts tests/clinical.integration.test.ts --reporter=verbose` | `2026-11-23T01:45:45+07:00` | `2026-11-23T01:45:46+07:00` | `0` | Verbose verification of T09 suites: `tests/fhir.adapter.test.ts` (`5/5` passed), `tests/clinical.http.test.ts` (`2/2` passed), `tests/clinical.integration.test.ts` (`0/1` run, `1` skipped because `DATABASE_URL` is unset). Duration `661ms`. |

### Passed Suites Breakdown in `npm test` (`52/52` executed tests passed)

- `tools/medicloud-agent-company/src/project-root.test.ts` (`4` passed)
- `tools/medicloud-agent-company/src/cli.test.ts` (`7` passed)
- `tests/fhir.adapter.test.ts` (`5` passed — T09 FHIR conformance, dot-segment ID & JWT/PHI rejection, private & cloud-metadata/query endpoint enforcement, `FhirTransportError` wrapping, ephemeral loopback HTTP `PUT`/`GET` + cross-tenant `404`)
- `tests/security.test.ts` (`15` passed — T04/T09 RBAC/ABAC & audit redaction)
- `tests/scheduling.test.ts` (`4` passed)
- `tests/outbox.test.ts` (`3` passed — T06 `appointment.created` policy and relay backoff/unique-violation unit checks)
- `tests/scheduling.http.test.ts` (`6` passed)
- `tests/portal-bff.test.ts` (`6` passed)
- `tests/clinical.http.test.ts` (`2` passed — T09 clinical/audit/outbox/FHIR, concurrency, default resolvers, correlation sanitization, and `T08-BACKEND-FOLLOWUP-001` HTTP contract tests using an in-memory fake Prisma harness and ephemeral loopback HTTP FHIR server)

---

## 3. Verification of Cycle-2 Remediations & Hardening Items

| Remediation / Check Item | Observed Verification Evidence | Scope / Notes |
|---|---|---|
| **`[BLOCKING-1]` Concurrent `createObservation` atomic lock (`clinical/service.ts:436-442`)** | `createObservation` executes `tx.encounter.updateMany({ where: { id: encounter.id, tenantId, status: 'OPEN' }, data: { status: 'COMPLETED', completedAt } })` inside `$transaction` before creating `Observation` or `OutboxEvent`, throwing `SchedulingError(403, 'resource_state_denied', ...)` if `count !== 1`. `tests/clinical.http.test.ts:544-568` executes concurrent `Promise.all` requests against one `OPEN` encounter and asserts exactly `1` `201`, `1` `403 resource_state_denied`, and `1` `encounter.completed` outbox event. | In-memory `dbTables.encounter.updateMany` verifies conditional guard synchronously in JS; PostgreSQL `Promise.allSettled` test in `tests/clinical.integration.test.ts:193-216` is present and typechecked but **skipped** at runtime (`DATABASE_URL` unset). |
| **`[BLOCKING-2]` Cloud metadata host, query, dot-segment, redirect & transport-error wrapping (`hapi-fhir-adapter.ts`)** | `assertPrivateFhirEndpoint` (`lines 327-340`) rejects `?`/`#` (`fhir_endpoint_query_forbidden`) and cloud metadata hosts (`metadata`, `instance-data`, `metadata.goog`, `metadata.google.internal`, `*.google.internal`, `*.ec2.internal` -> `public_fhir_endpoint_forbidden`). `isValidFhirId` / `isValidFhirReference` (`lines 223-233`) reject `.` and `..`; `JWT_LIKE_RE` (`lines 12, 193`) rejects `eyJ...` strings. `executeFetch` (`lines 380-390`) sets `redirect: 'error'` + `AbortSignal.timeout` and throws `FhirTransportError(503, 'fhir_network_error', ...)`; `parseJsonResponse` (`lines 392-398`) throws `FhirTransportError(502, 'fhir_invalid_json', ...)`. `tests/fhir.adapter.test.ts` tests `..`/`Patient/.`, `eyJ...`, `metadata.google.internal`, `instance-data.ec2.internal`, `?query=1`, `ECONNREFUSED` (`503 fhir_network_error`), and `'not-json'` (`502 fhir_invalid_json`). | `redirect: 'error'` and `clinical/service.ts:174-185` (`fhir.sync.failed` audit event on `FhirTransportError`) verified by code inspection; no test triggers a `302` redirect or injects a failing `fhirClient` into `createEncounter`/`createObservation` directly. |
| **`[BLOCKING-3]` Untrusted `x-correlation-id` sanitization & JSON body size cap (`http-adapter.ts`)** | `validateCorrelationId` is called on public `GET /v1/specialties` (`line 76`); `safeCorrelationId` (`lines 30-32, 212-223`) normalizes any correlation ID not matching `/^synthetic-[a-z0-9-]+$/` to `'synthetic-redacted-correlation'` in both `x-correlation-id` headers and JSON error `correlation_id`. `readJson` (`lines 189-199`) enforces `MAX_JSON_BODY_BYTES = 65_536`. Verified in `tests/clinical.http.test.ts:389-403, 521-526` on both public `/v1/specialties`, authenticated `/v1/doctors`, and a `70000`-char payload (`400`). | Directly executed over loopback HTTP in `tests/clinical.http.test.ts`. |
| **Assigned `NURSE` path (`clinical/service.ts`, `authorization.ts`, `tests/clinical.http.test.ts:529-541`)** | Verified both negative denial (`403` when `nurse_a` targets physician's encounter) and positive `201` (`POST /v1/encounters/{ENCOUNTER_NURSE_OPEN_ID}/observations` when `nurse_a` is assigned via `DOC_NURSE_A_ID`). | Directly executed over loopback HTTP in `tests/clinical.http.test.ts`. |
| **Default `resolveMembership` / `resolvePatientId` resolvers (`http-adapter.ts:45-56`)** | `startApiServer(harness, fhirUrl, { useDefaultResolvers: true })` (`tests/clinical.http.test.ts:383-435`) exercises `http-adapter.ts`'s default `user.findUnique({include: {memberships: true}})` and `patient.findFirst` code paths across `/v1/specialties`, `/v1/doctors`, and `/v1/slots`. | Uses in-memory Prisma stub tables `user` and `patient`; live PostgreSQL queries remain unexecuted (`DATABASE_URL` unset). |
| **Auth/RBAC `401` / `403` / `404` & input bounds (`tests/clinical.http.test.ts`)** | `401` verified on `GET /v1/specialties` (invalid Bearer), `GET /v1/doctors` (invalid Bearer), and `POST /v1/encounters` (missing Bearer); `403` verified for authenticated `/v1/specialties` (`auditor_a`), unassigned physician, invalid purpose, `CANCELLED` appointment, unassigned nurse, concurrent second observation, `GUARDIAN` missing `x-delegated-patient-subject`, revoked `GUARDIAN`, `RECEPTIONIST` on `/v1/me/records`, and `PATIENT` on `/v1/admin/metrics`; `404` verified on cross-tenant `POST /v1/encounters`, cross-tenant `POST /v1/encounters/{ENCOUNTER_B_ID}/observations` (`observation.create.denied` audit), and cross-tenant FHIR `GET`. Verified `400 invalid_measured_at` (`'2026-11-24'`) and `400 prohibited_clinical_content` (`'synthetic-diagnosis-bad'`). | Directly executed over loopback HTTP and `tests/fhir.adapter.test.ts`. |

---

## 4. Acceptance & Conformance Fixture Coverage (`T08-BACKEND-FOLLOWUP-001`, AC-05, AC-06, AC-08, AC-11)

- **`docs/evidence/t09-fhir-conformance-fixtures.json` (`2917` bytes):** Inspected and confirmed directly loaded and validated by `tests/fhir.adapter.test.ts:103-109` (`Patient`, `Encounter`, `Observation` R4 fixtures under `restricted-clinical-synthetic`) alongside all `negative_cases` (`prohibited_phi_name_field`, `prohibited_free_text_note`, `public_cloud_fhir_endpoint`, `cross_tenant_fhir_lookup`).
- **`T08-BACKEND-FOLLOWUP-001` (AC-02 alignment):** `PASS` (in-memory HTTP & unit scope) — `authorization.ts` grants `'slot:read'` to `PATIENT` and `GUARDIAN` and checks `hasValidDelegation` for `:delegated` actions; `tests/clinical.http.test.ts` validates public & authenticated `GET /v1/specialties` (`SpecialtyList`), `GET /v1/doctors` (`DoctorList`, `?specialty=...`, `400` on invalid `tenant_id`, empty `[]` on cross-tenant `?tenant_id=synthetic-hospital-b`), and `GET /v1/slots` for `patient_a` & `guardian_a_valid`.
- **AC-05 (Cross-tenant isolation, disclosure-safe `404`, audit):** `PASS` (in-memory HTTP, FHIR, & unit scope) — `404` + redacted `encounter.create.denied` / `observation.create.denied` audit entries and cross-tenant FHIR `404 fhir_resource_not_found`.
- **AC-06 (Assigned clinical scope, purpose, state, audit, records, metrics):** `PASS` (in-memory HTTP & unit scope) — `PHYSICIAN` encounter/observation creation, positive & negative `NURSE` observation rules, atomic single-completion guard, `x-purpose-of-use` allowlist, `GET /v1/me/records` (`PATIENT` self + active `GUARDIAN` delegation; missing-target/revoked `GUARDIAN` & `RECEPTIONIST` `403`), and `GET /v1/admin/metrics` (`AUDITOR` `200`; `PATIENT` `403`).
- **AC-08 (Cloud outbox allowlist, PHI/token & unknown-field rejection):** `PASS` (in-memory HTTP, contract, & unit scope) — `encounter.completed` outbox event carries strictly `{ encounter_ref, observation_count: 1 }` validated by `validateEventEnvelope` and `npm run contracts:validate`; unknown fields, prohibited PHI markers, non-ISO dates, and oversized payloads fail `400` with zero outbox emission; `auditEvents` and error headers/bodies exclude Bearer tokens, `'forbidden'`, and untrusted `x-correlation-id` strings.
- **AC-11 (Private HAPI FHIR R4 adapter & conformance fixtures):** `PASS` (ephemeral `127.0.0.1` loopback HTTP & fixture scope) — FHIR R4 builders/validators, private/metadata/query URL guards, transport/JSON error wrapping, and `PUT`/`GET` round-trips for `Patient`, `Encounter`, and `Observation`.

---

## 5. Canonical 9-File Manifest & Recomputed SHA-256

Canonical manifest uses `path=lowercase_sha256` lines joined by `\n` (LF, UTF-8 without BOM), sorted lexicographically by path:

**Aggregate SHA-256:** `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`

| # | Path | Recomputed SHA-256 (Disk) | Bytes | Disk LastWriteTime (`+07:00`) |
|---|---|---|---|---|
| 1 | `apps/clinical-api/src/clinical/service.ts` | `674647ff149be9e7c27c62f3a6b3425924f20d6cb2f3182e1e6230e2c2c6d063` | 22916 | `2026-11-23T01:42:27+07:00` |
| 2 | `apps/clinical-api/src/fhir/hapi-fhir-adapter.ts` | `90b8634d088c0aac881f736e4804310ce47fd8eb3a3468b3cfc0f50857b723ce` | 18031 | `2026-11-23T01:41:45+07:00` |
| 3 | `apps/clinical-api/src/scheduling/http-adapter.ts` | `49ed96f50ab1876ba98865d0406e8c1f893cf484fe091c47160f41de155beb4a` | 12173 | `2026-11-23T01:42:30+07:00` |
| 4 | `apps/clinical-api/src/scheduling/service.ts` | `dac489d392dbb00264f9167dcc21a90ff62adbcce1e7a9591b9a36b06fb3606f` | 15652 | `2026-11-23T01:25:09+07:00` |
| 5 | `apps/clinical-api/src/security/authorization.ts` | `1778877765bd3a89e214dda2a9d28197ac4b5c70954dd31b28e93c1ad529108b` | 3499 | `2026-11-23T01:30:03+07:00` |
| 6 | `docs/evidence/t09-fhir-conformance-fixtures.json` | `4b81276b220964ebb48afe5946c80ca2a5e68ca7a11a1a16fe9fdaafd9a2f7b6` | 2917 | `2026-11-23T01:27:16+07:00` |
| 7 | `tests/clinical.http.test.ts` | `6f35a8db028aed4b65fa4a76e356ec00fdca02326b7fcc7a2e260eaf42a9e498` | 33656 | `2026-11-23T01:44:08+07:00` |
| 8 | `tests/clinical.integration.test.ts` | `62eafe67d6f929277e7eae33e9ace21f547392b56e4f6865bb679681b3840ec2` | 12294 | `2026-11-23T01:42:54+07:00` |
| 9 | `tests/fhir.adapter.test.ts` | `0b828fc8699541f67e1541556dd4de7554677a1eec8daa24ab691fa004fe108a` | 9002 | `2026-11-23T01:42:53+07:00` |

---

## 6. Skipped Checks & Explicit Non-Claims

1. **Skipped / Not Run Database Checks (`DATABASE_URL` unset):**
   - `npm run db:validate` exited with code `2` (`DATABASE_URL is required for schema validation.`).
   - All `3` PostgreSQL integration test files (`21` tests total: `tests/scheduling.integration.test.ts` `10`, `tests/outbox.integration.test.ts` `10`, `tests/clinical.integration.test.ts` `1`) were **skipped** in `npm test`. Live PostgreSQL schema constraints, row-level locking under `READ COMMITTED`, transactional rollback on error, and DB-backed `AuditEvent`/`OutboxEvent` persistence for T09 remain unexecuted in this environment.
2. **Ephemeral Loopback HTTP FHIR Scope (`HAPI_FHIR_BASE_URL` unset):**
   - `tests/fhir.adapter.test.ts` and `tests/clinical.http.test.ts` executed against ephemeral `127.0.0.1` Node `http.Server` mocks and `fetchImpl` stubs rather than a live OpenStack HAPI FHIR R4 server.
3. **Other External Runtimes Not Exercised:**
   - No live Keycloak OIDC/JWKS server, GCP Cloud Run BFF, GCP Pub/Sub topic/worker, or OpenStack VM deployment was exercised (`apps/clinical-api/src/scheduling/http-adapter.ts` uses injected `fhirClient` / `verifyAuthorizationHeader` in tests).
4. **Explicit Non-Claims (Constitution Section 3 & Section 8):**
   - This report does **not** claim production deployment, live OpenStack/GCP/HAPI FHIR/Keycloak runtime connectivity, real patient data handling, measured latency/throughput/SLA/RPO/RTO performance, legal or regulatory compliance, or clinical safety.
5. **Independent Gate Status:**
   - Re-review by independent Code Review (`docs/reviews/t09-code-review.md`), Security/Privacy Review (`docs/reviews/t09-security-privacy-review.md`), and Evidence Review (`docs/reviews/t09-evidence-review.md`) against aggregate SHA-256 `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23` remains required per Constitution Section 4 & Section 7 before advancing T09 beyond `READY_FOR_TEST`.
