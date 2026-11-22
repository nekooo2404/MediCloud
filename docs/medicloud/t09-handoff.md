# T09 Implementation Handoff

**Task:** T09 — Encounter, Observation, Audit & Private HAPI FHIR R4 Adapter (plus approved `T08-BACKEND-FOLLOWUP-001`)  
**Decision:** `T09-CLINICAL-001` — `APPROVED` (`docs/decisions/t09-clinical-fhir-approval.md`), resolving `T08-BACKEND-FOLLOWUP-001` (`docs/decisions/t08-backend-followup.md`)  
**Status:** `TEST_PASSED` (All 4 independent gates passed/approved for canonical 9-file aggregate SHA-256 `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23` within verified local contract, static, unit, in-memory HTTP, and ephemeral loopback FHIR scope)  
**Accountable owner:** Project owner  
**Implementation owner:** Coding agent  
**Independent tester:** `t09_quality_tester` (`9ff2674e-c8fb-41b7-b141-984912e0dec4`)  
**Canonical 9-file diff fingerprint (SHA-256):** `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`  
**Data classification:** Synthetic data only (`restricted-clinical-synthetic` confined to private boundary; allowlisted `encounter.completed` reference/count metadata only in outbox). No real PHI/PII, credentials, bearer tokens, private keys, or real patient-record content.

## Canonical 9-file source & test manifest

Canonical manifest uses `path=lowercase_sha256` lines joined by `\n` (UTF-8 without BOM), sorted lexicographically by path:

**Aggregate SHA-256:** `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`

| Path | SHA-256 |
|---|---|
| `apps/clinical-api/src/clinical/service.ts` | `674647ff149be9e7c27c62f3a6b3425924f20d6cb2f3182e1e6230e2c2c6d063` |
| `apps/clinical-api/src/fhir/hapi-fhir-adapter.ts` | `90b8634d088c0aac881f736e4804310ce47fd8eb3a3468b3cfc0f50857b723ce` |
| `apps/clinical-api/src/scheduling/http-adapter.ts` | `49ed96f50ab1876ba98865d0406e8c1f893cf484fe091c47160f41de155beb4a` |
| `apps/clinical-api/src/scheduling/service.ts` | `dac489d392dbb00264f9167dcc21a90ff62adbcce1e7a9591b9a36b06fb3606f` |
| `apps/clinical-api/src/security/authorization.ts` | `1778877765bd3a89e214dda2a9d28197ac4b5c70954dd31b28e93c1ad529108b` |
| `docs/evidence/t09-fhir-conformance-fixtures.json` | `4b81276b220964ebb48afe5946c80ca2a5e68ca7a11a1a16fe9fdaafd9a2f7b6` |
| `tests/clinical.http.test.ts` | `6f35a8db028aed4b65fa4a76e356ec00fdca02326b7fcc7a2e260eaf42a9e498` |
| `tests/clinical.integration.test.ts` | `62eafe67d6f929277e7eae33e9ace21f547392b56e4f6865bb679681b3840ec2` |
| `tests/fhir.adapter.test.ts` | `0b828fc8699541f67e1541556dd4de7554677a1eec8daa24ab691fa004fe108a` |

## Remediation changes applied since cycle 1 (`deb864ac...` -> `7a16b136...`)

1. **`[BLOCKING-1]` Atomic `OPEN -> COMPLETED` transition guard (`apps/clinical-api/src/clinical/service.ts`):**
   - `createObservation` now performs conditional `tx.encounter.updateMany({ where: { id, tenantId, status: 'OPEN' }, data: { status: 'COMPLETED', completedAt } })` inside `$transaction` before creating `Observation` or `OutboxEvent` (`encounter.completed`), returning `403 resource_state_denied` if `count !== 1`. Verified with concurrent `Promise.all` tests in `tests/clinical.http.test.ts` and `tests/clinical.integration.test.ts`.
2. **`[BLOCKING-2]` Private FHIR endpoint & transport hardening (`apps/clinical-api/src/fhir/hapi-fhir-adapter.ts`):**
   - Explicitly blocks cloud metadata hostnames (`metadata.google.internal`, `*.google.internal`, `*.ec2.internal`, `metadata`, `instance-data`), rejects query/fragment URLs (`?`/`#`), sets `redirect: 'error'` on `fetch`, rejects `.` / `..` dot-segment FHIR IDs/references, and wraps `fetch` / timeout / JSON-parse exceptions inside `FhirTransportError` so `handleFhirSync` catches them reliably and emits redacted `fhir.sync.failed` `AuditEvent`.
3. **`[BLOCKING-3]` Safe correlation ID normalization & bounded JSON body (`apps/clinical-api/src/scheduling/http-adapter.ts`):**
   - Enforces `validateCorrelationId` on unauthenticated `GET /v1/specialties` and normalizes all echoed HTTP `x-correlation-id` headers and JSON error `correlation_id` values through `safeCorrelationId` (`synthetic-redacted-correlation` for untrusted inputs). Added `65_536`-byte cap in `readJson`.
4. **Hardening & expanded test coverage:**
   - Added observation `code` length (`<= 64`), `Decimal(12,4)` numeric bounds, strict ISO-8601 `date-time` regex check, `normalizePurposeForAudit`, honest `401 | 403 | 404` status cast, positive assigned `NURSE` test, default `resolveMembership`/`resolvePatientId` tests, `401` checks, `GUARDIAN` missing target test, `prohibited_clinical_content` test, and `JWT_LIKE_RE` FHIR rejection test.

## Acceptance mapping

| Requirement / AC | Implemented Behavior | Verification Coverage |
|---|---|---|
| **T08-BACKEND-FOLLOWUP-001 (AC-02 alignment)** | Granted `slot:read` to `PATIENT` and `GUARDIAN` in `apps/clinical-api/src/security/authorization.ts`; added active delegation check for all `:delegated` actions; implemented `GET /v1/specialties` and `GET /v1/doctors` in `scheduling/service.ts` & `http-adapter.ts` matching OpenAPI `SpecialtyList` and `DoctorList` schemas without expanding scope from query `tenant_id`. | `tests/clinical.http.test.ts`, `tests/scheduling.http.test.ts`, `tests/security.test.ts`, `tests/clinical.integration.test.ts` |
| **AC-05** (Cross-tenant isolation & disclosure-safe 404 + audit) | All clinical services derive `tenantId` solely via server-side `effectivePrincipal`; cross-tenant `appointment_id`/`encounter_id` targets write redacted `AuditEvent` entries in caller's tenant (`encounter.create.denied` / `observation.create.denied`) and return disclosure-safe `404`. | `tests/clinical.http.test.ts`, `tests/fhir.adapter.test.ts`, `tests/clinical.integration.test.ts` |
| **AC-06** (Assigned clinical scope + purpose + audit) | `POST /v1/encounters` (`PHYSICIAN`) and `POST /v1/encounters/{id}/observations` (`PHYSICIAN`/`NURSE`) enforce role, tenant, practitioner assignment, `x-purpose-of-use`, atomic `OPEN` transition guard, and write append-only redacted `AuditEvent`; `GET /v1/me/records` restricts to `PATIENT` self or active `GUARDIAN` delegation; `GET /v1/admin/metrics` restricts to `AUDITOR`. | `tests/clinical.http.test.ts`, `tests/security.test.ts`, `tests/clinical.integration.test.ts` |
| **AC-08** (Cloud outbox allowlist & PHI/token rejection) | Observation creation rejects unknown fields, non-ISO timestamps, oversized payloads, and prohibited PHI/PII markers (`400`), emits strictly allowlisted `encounter.completed` outbox event (`{ encounter_ref, observation_count }`), sanitizes untrusted `x-correlation-id`, and redacts audit logs/events. | `tests/clinical.http.test.ts`, `tests/fhir.adapter.test.ts`, `tests/outbox.test.ts` |
| **AC-11** (Private HAPI FHIR R4 adapter & conformance fixtures) | `apps/clinical-api/src/fhir/hapi-fhir-adapter.ts` builds and validates synthetic FHIR R4 `Patient`, `Encounter`, and `Observation` resources, blocks public/cloud/metadata hosts & dot-segment IDs, wraps transport/timeout/JSON errors in `FhirTransportError`, and returns disclosure-safe cross-tenant `404` on FHIR reads. Conformance fixtures recorded in `docs/evidence/t09-fhir-conformance-fixtures.json`. | `tests/fhir.adapter.test.ts`, `tests/clinical.http.test.ts`, `tests/clinical.integration.test.ts` |

## Commands run by implementation owner (post-remediation)

- `npm run contracts:validate` -> exit `0`
- `npm run typecheck` -> exit `0`
- `npm run lint` -> exit `0`
- `npx eslint apps/clinical-api/src/fhir/hapi-fhir-adapter.ts apps/clinical-api/src/clinical/service.ts apps/clinical-api/src/scheduling/service.ts apps/clinical-api/src/scheduling/http-adapter.ts apps/clinical-api/src/security/authorization.ts tests/fhir.adapter.test.ts tests/clinical.http.test.ts tests/clinical.integration.test.ts` -> exit `0` (`0` errors, `0` warnings)
- `npm test` -> exit `0` (`9` passed test files / `52` passed tests, `3` skipped DB integration files / `21` skipped tests because `DATABASE_URL` is unset in shell env)

## Not run & explicit limitations

- `npm run db:validate` and PostgreSQL integration suites (`tests/scheduling.integration.test.ts`, `tests/clinical.integration.test.ts`, `tests/outbox.integration.test.ts`) were **skipped** because `DATABASE_URL` is not configured in environment variables (although local TCP port `127.0.0.1:2404` was observed listening).
- No live external OpenStack HAPI FHIR server, Keycloak server, or GCP Pub/Sub runtime was used or tested; FHIR HTTP verification uses ephemeral loopback (`127.0.0.1`) HAPI FHIR R4 HTTP servers in tests.
- No claim is made regarding production deployment, measured latency/throughput/SLA performance, legal/regulatory compliance, or clinical safety.

## Independent Gate Results (Cycle 2 — `7a16b136...`)

1. **Independent Tester (`quality.tester`):** `PASS` — [docs/evidence/t09-test-report.md](../evidence/t09-test-report.md) (`t09_quality_tester`, `9ff2674e-c8fb-41b7-b141-984912e0dec4`)
2. **Independent Code Review:** `APPROVE` — [docs/reviews/t09-code-review.md](../reviews/t09-code-review.md) (`t09_code_reviewer`, `a60c19eb-2985-4630-99da-c7ffa342e150`)
3. **Independent Security & Privacy Review:** `APPROVE` — [docs/reviews/t09-security-privacy-review.md](../reviews/t09-security-privacy-review.md) (`t09_security_reviewer`, `71b95301-4e31-4e69-af1a-0f9b0bc3bc8e`)
4. **Independent Evidence & Governance Review:** `APPROVE` — [docs/reviews/t09-evidence-review.md](../reviews/t09-evidence-review.md) (`t09_evidence_reviewer`, `83243c3f-4356-4069-a246-e0622eda9ea1`)
