# T09 Independent Security and Privacy Review

**Task:** T09 — Encounter, Observation, Audit & Private HAPI FHIR R4 Adapter (plus approved `T08-BACKEND-FOLLOWUP-001`)  
**Decisions:** `T09-CLINICAL-001` (`APPROVED` in [docs/decisions/t09-clinical-fhir-approval.md](../decisions/t09-clinical-fhir-approval.md)), `T04-SECURITY-001` (`APPROVED` in [docs/decisions/t04-security-approval.md](../decisions/t04-security-approval.md)), `T08-BACKEND-FOLLOWUP-001` ([docs/decisions/t08-backend-followup.md](../decisions/t08-backend-followup.md))  
**Governance:** [.medicloud/agent-company/CONSTITUTION.md](../../.medicloud/agent-company/CONSTITUTION.md)  
**Reviewer:** Independent security/privacy review session (separate from implementation owner and `quality.tester`)  
**Review date (+07:00):** `2026-11-23` (Cycle 2 fresh re-verification post-remediation)  
**Decision: APPROVE** (strictly for the Security & Privacy gate on the exact remediated local/unit/in-memory-HTTP/loopback-FHIR scope below; does **not** certify live PostgreSQL runtime execution, live Keycloak/HAPI FHIR/GCP integration, production deployment, legal compliance, or clinical safety)  
**Canonical 9-File Aggregate SHA-256:** `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`  
**Data classification:** Synthetic data only (`restricted-clinical-synthetic` confined to the private boundary; allowlisted `encounter.completed` reference/count metadata only in outbox). Zero real PHI/PII, credentials, bearer tokens, private keys, or real patient-record content.

---

## 1. Fingerprint Integrity and Direct Cycle-2 Verification

- Independently recomputed lowercase SHA-256 hashes for all 9 canonical T09 files directly on disk using PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath`, formatted as lexicographically sorted `path=lowercase_sha256` lines joined by LF (`\n`) in UTF-8 without BOM:
  - `apps/clinical-api/src/clinical/service.ts` = `674647ff149be9e7c27c62f3a6b3425924f20d6cb2f3182e1e6230e2c2c6d063`
  - `apps/clinical-api/src/fhir/hapi-fhir-adapter.ts` = `90b8634d088c0aac881f736e4804310ce47fd8eb3a3468b3cfc0f50857b723ce`
  - `apps/clinical-api/src/scheduling/http-adapter.ts` = `49ed96f50ab1876ba98865d0406e8c1f893cf484fe091c47160f41de155beb4a`
  - `apps/clinical-api/src/scheduling/service.ts` = `dac489d392dbb00264f9167dcc21a90ff62adbcce1e7a9591b9a36b06fb3606f`
  - `apps/clinical-api/src/security/authorization.ts` = `1778877765bd3a89e214dda2a9d28197ac4b5c70954dd31b28e93c1ad529108b`
  - `docs/evidence/t09-fhir-conformance-fixtures.json` = `4b81276b220964ebb48afe5946c80ca2a5e68ca7a11a1a16fe9fdaafd9a2f7b6`
  - `tests/clinical.http.test.ts` = `6f35a8db028aed4b65fa4a76e356ec00fdca02326b7fcc7a2e260eaf42a9e498`
  - `tests/clinical.integration.test.ts` = `62eafe67d6f929277e7eae33e9ace21f547392b56e4f6865bb679681b3840ec2`
  - `tests/fhir.adapter.test.ts` = `0b828fc8699541f67e1541556dd4de7554677a1eec8daa24ab691fa004fe108a`
- Recomputed aggregate SHA-256: **`7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`** — exact match with [docs/medicloud/t09-handoff.md](../medicloud/t09-handoff.md) and [docs/evidence/t09-test-report.md](../evidence/t09-test-report.md).
- Independently executed read-only checks against the remediated disk state without modifying any source, contract, config, or test file:
  - `npm run contracts:validate`: exit `0` (`T02 contract validation passed: OpenAPI, event schema, policy and rejection fixtures.`)
  - `npm run typecheck`: exit `0` (`tsc --noEmit`)
  - `npm run lint`: exit `0` (existing non-failing App Router `Pages directory cannot be found` advisory only)
  - `npx eslint apps/clinical-api/src/fhir/hapi-fhir-adapter.ts apps/clinical-api/src/clinical/service.ts apps/clinical-api/src/scheduling/service.ts apps/clinical-api/src/scheduling/http-adapter.ts apps/clinical-api/src/security/authorization.ts tests/fhir.adapter.test.ts tests/clinical.http.test.ts tests/clinical.integration.test.ts`: exit `0` (`0` errors, `0` warnings)
  - `npm test`: exit `0` (`9` test files / `52` tests passed; `3` DB integration test files / `21` tests skipped because `DATABASE_URL` is unset, including `tests/clinical.integration.test.ts`)

---

## 2. Detailed Security & Privacy Audit Findings (Cycle-2 Re-Verification)

### 2.1 `T08-BACKEND-FOLLOWUP-001` Safety (`slot:read`, `/v1/doctors`, `/v1/specialties`)
*Audited files: `apps/clinical-api/src/security/authorization.ts`, `apps/clinical-api/src/scheduling/service.ts`, `apps/clinical-api/src/scheduling/http-adapter.ts`, `packages/contracts/openapi.json`, `tests/clinical.http.test.ts`*

- **Scoped `slot:read` grant for `PATIENT` and `GUARDIAN` (`PASS`):**
  - `roleActions` in [authorization.ts](../../apps/clinical-api/src/security/authorization.ts#L4-L5) grants `'slot:read'` to `PATIENT` and `GUARDIAN` per `T09-CLINICAL-001` (`A2`), with no clinical write or cross-patient clinical read grants.
  - `listSlots()` in [scheduling/service.ts](../../apps/clinical-api/src/scheduling/service.ts#L161-L168) derives `tenantId` solely from `effectivePrincipal()` and scopes `appointmentSlot.findMany` to `tenantId`.
- **Non-authoritative `?tenant_id` on `GET /v1/doctors` (`PASS`):**
  - [http-adapter.ts](../../apps/clinical-api/src/scheduling/http-adapter.ts#L80-L90) requires Bearer authentication via `verifyAuthorizationHeader(authHeader)` prior to `/v1/doctors`.
  - `listDoctors()` ([scheduling/service.ts:185-212](../../apps/clinical-api/src/scheduling/service.ts#L185-L212)) derives `tenantId` solely from `effectivePrincipal()`, authorizes `'slot:read'`, validates optional `requestedTenantCode` against `^synthetic-[a-z0-9-]+$` (`400 invalid_tenant_id`), returns `{data: []}` on tenant code mismatch, and queries `practitioner.findMany({where: {tenantId, ...}})`.
  - [tests/clinical.http.test.ts:383-435](../../tests/clinical.http.test.ts#L383-L435) exercises default Prisma `resolveMembership`/`resolvePatientId` paths, `401` on invalid Bearer tokens, `?specialty=` filtering, `400` on invalid `tenant_id`, and `{data: []}` on cross-tenant `?tenant_id=synthetic-hospital-b`.
- **`GET /v1/specialties` public `security: []` vs authenticated Bearer validation & correlation sanitization (`PASS`):**
  - [http-adapter.ts:74-83](../../apps/clinical-api/src/scheduling/http-adapter.ts#L74-L83) serves `listSpecialtiesPublic(options.prisma)` **only** when `request.method === 'GET' && path === '/v1/specialties' && !authHeader`, returning only distinct specialty names (`{id, name}`) with zero tenant IDs/names or patient/clinical info (`security: []` in [openapi.json:11](../../packages/contracts/openapi.json#L11)), and now enforces `validateCorrelationId(correlationId)` before execution.
  - When an `Authorization` header is present, `verifyAuthorizationHeader(authHeader)` runs first (`401 unauthorized` on invalid tokens) followed by `listSpecialties()` (`effectivePrincipal`, `slot:read`, `where: {tenantId}`). All response headers and JSON error bodies normalize `correlation_id` through `safeCorrelationId()` ([http-adapter.ts:30-32,212-223](../../apps/clinical-api/src/scheduling/http-adapter.ts#L212-L223)), preventing untrusted `x-correlation-id` reflection (`tests/clinical.http.test.ts:390-412`).

### 2.2 `GUARDIAN` `:delegated` Enforcement
*Audited files: `apps/clinical-api/src/security/authorization.ts`, `apps/clinical-api/src/clinical/service.ts`, `apps/clinical-api/src/security/oidc-verifier.ts`, `tests/clinical.http.test.ts`, `tests/security.test.ts`*

- **`hasValidDelegation()` invariants (`PASS`):**
  - [authorization.ts:13-25,36-37](../../apps/clinical-api/src/security/authorization.ts#L13-L25) enforces same-tenant (`delegation.tenantId === context.resourceTenantId`), target patient match (`delegation.patientSubject === targetSubject`), unrevoked (`!delegation.revoked`), and unexpired (`Date.parse(delegation.expiresAt) > Date.now()`, failing closed on invalid dates) across both `appointment:create` for `GUARDIAN` and all `:delegated` actions (`appointment:read:delegated`, `record:read:delegated`).
- **`GET /v1/me/records` enforcement (`PASS`):**
  - `listMyRecords()` ([clinical/service.ts:529-598](../../apps/clinical-api/src/clinical/service.ts#L529-L598)) isolates `PATIENT` to `principal.subject` (`record:read:self`, ignoring `x-delegated-patient-subject`) and requires `GUARDIAN` callers to match an active delegation for `context.delegatedPatientSubject`. Missing target header (`guardianMissingTarget`), revoked delegation (`guardian_a_revoked`), cross-tenant delegation, and expired delegation all return `403` with a redacted `record.read.denied` audit event (`tests/clinical.http.test.ts:596-614`, `tests/security.test.ts:25-26`).
  - Live OIDC `createOidcVerifier()` (`oidc-verifier.ts:44`) still leaves `delegations` unpopulated until a DB delegation table is introduced, failing closed (`403`) for `GUARDIAN` in live OIDC mode.

### 2.3 Clinical RBAC / ABAC, Atomic Completion, Cross-Tenant `404`, and Redacted `AuditEvent`
*Audited files: `apps/clinical-api/src/clinical/service.ts`, `apps/clinical-api/src/scheduling/http-adapter.ts`, `apps/clinical-api/src/security/authorization.ts`, `apps/clinical-api/src/security/redacted-audit.ts`, `apps/clinical-api/src/security/redacted-log.ts`, `tests/clinical.http.test.ts`*

- **Role, assignment, purpose, and resource state enforcement (`PASS`):**
  - `POST /v1/encounters` (`encounter:create:assigned`): `PHYSICIAN` only, matching `appointment.slot.schedule.practitionerId === practitioner.id` and `practitioner.user.subject === principal.subject` (unassigned sets `assignedPractitionerSubject: undefined` -> `403 assignment_required`), `x-purpose-of-use` in `{'treatment', 'care_coordination', 'operations', 'audit'}`, and appointment status `CONFIRMED | COMPLETED`.
  - `POST /v1/encounters/{id}/observations` (`observation:create:assigned`): `PHYSICIAN` or `NURSE` only (both negative unassigned `nurse_a` `403` and positive assigned `nurse_a` `201` now verified in [tests/clinical.http.test.ts:529-541](../../tests/clinical.http.test.ts#L529-L541)), matching `encounter.practitioner.user.subject`, allowed `x-purpose-of-use`, and encounter status `OPEN`.
  - **Atomic `OPEN -> COMPLETED` guard (`PASS`):** Inside `$transaction` ([clinical/service.ts:436-442](../../apps/clinical-api/src/clinical/service.ts#L436-L442)), `tx.encounter.updateMany({ where: { id: encounter.id, tenantId, status: 'OPEN' }, data: { status: 'COMPLETED', completedAt } })` runs *before* observation or outbox insertion and throws `403 resource_state_denied` if `count !== 1`. Concurrent `Promise.all` tests ([tests/clinical.http.test.ts:544-568](../../tests/clinical.http.test.ts#L544-L568)) confirm only one observation succeeds (`201`), the racing call fails (`403 resource_state_denied`), and exactly one `encounter.completed` outbox event is emitted.
  - `GET /v1/me/records` restricts to `PATIENT`/`GUARDIAN` (`RECEPTIONIST` denied `403`); `GET /v1/admin/metrics` restricts to `AUDITOR` (`PATIENT` denied `403`) with all Prisma counts strictly scoped by `tenantId`.
- **Disclosure-safe `404` & redacted `AuditEvent` (`PASS`):**
  - Cross-tenant `POST /v1/encounters` (`appointment_id: APPT_B_ID` or cross-tenant `practitioner_id`) and cross-tenant `POST /v1/encounters/{ENCOUNTER_B_ID}/observations` write redacted `*.denied` `AuditEvent` entries in the caller's `tenantId` (`resourceRef: 'synthetic-redacted-resource'`) and return `404` (`tests/clinical.http.test.ts:443-457`).
  - Allowed writes/reads record synthetic `AuditEvent` entries (`normalizePurposeForAudit` maps invalid purposes to `'unspecified'`, `sanitizeAuditMetadata` strips `Bearer` strings, `handleFhirSync` records redacted `fhir.sync.failed` audit entries on `FhirTransportError`), and `http-adapter.ts` caps JSON bodies at `65_536` bytes (`readJson`), logs `redactedMutationLog` on 500s, and emits zero tokens, raw claims, PHI, or stack traces.

### 2.4 Cloud Boundary AC-08 (`encounter.completed` Outbox Allowlist)
*Audited files: `apps/clinical-api/src/clinical/service.ts`, `apps/clinical-api/src/scheduling/http-adapter.ts`, `apps/clinical-api/src/scheduling/event-validation.ts`, `packages/contracts/schemas/event-envelope.schema.json`, `packages/contracts/data-classification.json`, `tests/clinical.http.test.ts`*

- **Input validation & prohibited-content rejection (`PASS`):**
  - `readJson` (`['code', 'value', 'unit', 'measured_at']`, max `65_536` bytes) rejects unknown keys (`400 unknown_field`) and oversized bodies (`400 invalid_json`).
  - `assertSyntheticObservationInput()` ([clinical/service.ts:66-91](../../apps/clinical-api/src/clinical/service.ts#L66-L91)) enforces `code.length <= 64` + `^synthetic-[a-z0-9-]+$`, `Decimal(12,4)` numeric bounds (`< 100_000_000`), strict ISO-8601 `ISO_DATETIME_RE`, and rejects `prohibited_event_fields` plus `'bearer'`/`'token'` (`tests/clinical.http.test.ts:496-526`).
- **Strictly allowlisted `encounter.completed` payload (`PASS`):**
  - `createObservation()` emits `encounter.completed` inside `$transaction` with `payload: { encounter_ref: 'synthetic-encounter-<id>', observation_count }` only, validated by `validateEventEnvelope()` against [event-envelope.schema.json](../../packages/contracts/schemas/event-envelope.schema.json#L16) (`additionalProperties: false`). Restricted-clinical FHIR resources never enter `outbox_events`.

### 2.5 Private HAPI FHIR R4 Boundary AC-11 (`hapi-fhir-adapter.ts`)
*Audited files: `apps/clinical-api/src/fhir/hapi-fhir-adapter.ts`, `docs/evidence/t09-fhir-conformance-fixtures.json`, `tests/fhir.adapter.test.ts`, `tests/clinical.http.test.ts`*

- **SSRF / private host & transport restrictions (`PASS`):**
  - `assertPrivateFhirEndpoint()` ([hapi-fhir-adapter.ts:314-357](../../apps/clinical-api/src/fhir/hapi-fhir-adapter.ts#L314-L357)) enforces `http:`/`https:`, rejects embedded credentials (`fhir_endpoint_credentials_forbidden`), rejects query/fragment URLs (`fhir_endpoint_query_forbidden`), explicitly rejects cloud metadata hostnames (`metadata`, `instance-data`, `metadata.goog`, `metadata.google.internal`, `*.google.internal`, `*.ec2.internal`), restricts IPv4 to RFC1918 + `127/8` (blocking `169.254.*`, `0.0.0.0`, public IPs), restricts IPv6 strictly to `::1` (blocking `fe80::*`, `::ffff:*`), and restricts DNS names to the private allowlist (`tests/fhir.adapter.test.ts:133-144`).
  - `executeFetch()` and `parseJsonResponse()` ([hapi-fhir-adapter.ts:380-398](../../apps/clinical-api/src/fhir/hapi-fhir-adapter.ts#L380-L398)) enforce `redirect: 'error'` and `AbortSignal.timeout(timeoutMs)` and wrap network/timeout/JSON failures into `FhirTransportError` (`503 fhir_network_error` / `502 fhir_invalid_json`), verified in `tests/fhir.adapter.test.ts:146-167`.
- **Prohibited PHI/PII/token & dot-segment rejection (`PASS`):**
  - `isValidFhirId()` and `isValidFhirReference()` ([hapi-fhir-adapter.ts:223-233](../../apps/clinical-api/src/fhir/hapi-fhir-adapter.ts#L223-L233)) explicitly reject `.` and `..` dot-segments.
  - `scanForProhibitedContent()` recursively rejects `FHIR_PII_PROHIBITED_KEYS`, `/\bBearer\s+/i`, and `JWT_LIKE_RE` (`eyJ...`) strings (`tests/fhir.adapter.test.ts:112-131`), and `validateFhirR4Resource()` validates synthetic tenant/data-class tags and R4 structures against [t09-fhir-conformance-fixtures.json](../evidence/t09-fhir-conformance-fixtures.json).
- **Disclosure-safe cross-tenant `404` on FHIR `GET` (`PASS`):**
  - `getResource()` ([hapi-fhir-adapter.ts:425-458](../../apps/clinical-api/src/fhir/hapi-fhir-adapter.ts#L425-L458)) returns an identical `FhirTransportError(404, 'fhir_resource_not_found', 'FHIR resource not found')` on both upstream `404` and cross-tenant `meta.security` mismatch (`tests/fhir.adapter.test.ts:185-188`).

---

## 3. Remaining Non-Blocking Observations & Environment Limitations

1. **Pre-staging defense-in-depth notes (tracked for T10–T14, non-blocking for T09):**
   - `authorization.ts:33-34` checks `resourceStateAllowed` before `roleActions` and `clinical/service.ts:225-240` checks same-tenant practitioner existence before `authorize` (cross-tenant isolation is unaffected because `same_tenant` / `appointment.tenantId` checks always return `404` first; optional future ordering polish).
   - `executeFetch()` sets `redirect: 'error'` and `handleFhirSync()` records redacted `fhir.sync.failed` `AuditEvent` records by code inspection (no dedicated unit test asserts a `302` redirect rejection or injects a failing `fhirClient` into `createEncounter`/`createObservation`); runtime DNS resolution of private hostnames (`*.internal`, `*.openstack.local`) remains an OpenStack infrastructure boundary (`T10`/`T13`).
2. **Skipped PostgreSQL runtime checks (`DATABASE_URL` unset):**
   - `npm run db:validate` exited `2`, and `tests/clinical.integration.test.ts` (`1`), `tests/scheduling.integration.test.ts` (`10`), and `tests/outbox.integration.test.ts` (`10`) were skipped (`21` skipped tests). Live PostgreSQL `READ COMMITTED` locking for `updateMany`, FK constraints, and DB `AuditEvent`/`OutboxEvent` persistence for T09 remain unexecuted here.
3. **Ephemeral loopback HTTP FHIR & mocked OIDC harness (`HAPI_FHIR_BASE_URL` unset):**
   - `tests/clinical.http.test.ts` and `tests/fhir.adapter.test.ts` executed against in-memory Prisma/token harnesses, `fetchImpl` stubs, and ephemeral `127.0.0.1` HTTP mock servers rather than a live OpenStack HAPI FHIR R4 server, Keycloak JWKS realm, or GCP Pub/Sub runtime.
4. **Explicit non-claims (Constitution Sections 3 & 8):**
   - This approval applies **solely** to the Security & Privacy gate for exact canonical SHA-256 **`7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`** within the verified local scope. It does **not** replace the independent Code Review or Evidence Review gates, and makes **no claim** of production deployment, live OpenStack/GCP/HAPI FHIR/Keycloak readiness, measured latency/throughput/SLA/RPO/RTO performance, legal or regulatory compliance, or clinical safety.
