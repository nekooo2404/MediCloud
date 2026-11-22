# T09 Independent Evidence and Governance Review

**Task:** T09 — Clinical Encounter, Observation, Audit & Private HAPI FHIR R4 Adapter (plus approved `T08-BACKEND-FOLLOWUP-001`)  
**Decision Records:** `T09-CLINICAL-001` (`APPROVED` in [docs/decisions/t09-clinical-fhir-approval.md](../decisions/t09-clinical-fhir-approval.md)), `T08-BACKEND-FOLLOWUP-001` (`APPROVED & RESOLVED IN T09` in [docs/decisions/t08-backend-followup.md](../decisions/t08-backend-followup.md))  
**Governance:** [.medicloud/agent-company/CONSTITUTION.md](../../.medicloud/agent-company/CONSTITUTION.md) (v1.0.0) and [docs/medicloud/tasks.md](../medicloud/tasks.md)  
**Reviewer:** Independent Evidence Review session (`83243c3f-4356-4069-a246-e0622eda9ea1`, strictly separate from implementation owner, `quality.tester`, Code Review, and Security/Privacy Review)  
**Review Timestamp (+07:00):** `2026-11-23T01:51:00+07:00`  
**Decision: APPROVE** (Evidence & Governance gate only, strictly tied to canonical 9-file aggregate SHA-256 `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23` within verified local contract, static, unit, in-memory HTTP, and ephemeral loopback `127.0.0.1` FHIR conformance scope; PostgreSQL runtime integration tests and live external runtimes remain unexecuted)  
**Data Classification:** Synthetic data only (`restricted-clinical-synthetic` confined to private boundary; allowlisted `encounter.completed` reference/count metadata only in outbox). Zero real PHI/PII, credentials, bearer tokens, private keys, or real patient-record content.  
**Files Modified by This Review:** Only `docs/reviews/t09-evidence-review.md` (zero edits to source, test, fixture, config, contract, handoff, `TestReport`, code review, security review, or `docs/medicloud/tasks.md` files).

---

## 1. Recomputed Fingerprints & Cross-Artifact Consistency

### 1.1 Canonical 9-File T09 Manifest & Aggregate SHA-256

Independently recomputed lowercase SHA-256 digests directly from disk using PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath`, formatted as lexicographically sorted `path=lowercase_sha256` lines joined by LF (`\n`) in UTF-8 without BOM:

- **Recomputed Aggregate SHA-256 (Disk):** `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`
- **Programmatic Cross-Artifact Parity:** `9/9` per-file SHA-256 hashes and the aggregate SHA-256 match identically across:
  - [docs/medicloud/t09-handoff.md](../medicloud/t09-handoff.md)
  - [docs/evidence/t09-test-report.md](../evidence/t09-test-report.md)
  - [docs/reviews/t09-code-review.md](./t09-code-review.md)
  - [docs/reviews/t09-security-privacy-review.md](./t09-security-privacy-review.md)

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

### 1.2 T08 Portal & Contract Boundary Immutability

Independently recomputed lowercase SHA-256 digests directly from disk for all 24 canonical T08 files listed in [docs/medicloud/t08-handoff.md](../medicloud/t08-handoff.md) and [docs/evidence/t08-test-report.md](../evidence/t08-test-report.md) (including dynamic routes `apps/patient-portal/app/api/bff/appointments/[id]/route.ts` and `apps/patient-portal/app/api/bff/appointments/[id]/check-in/route.ts`), joined by `\n` in UTF-8 without BOM:

- **Recomputed T08 24-file Aggregate SHA-256 (Disk):** `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc` (exact match with T08 artifacts).
- **Timestamp Boundary Sweep (`LastWriteTime > 2026-11-23T01:05:00+07:00`):**
  - `apps/patient-portal/` (excluding `.next/`): **`0`** modified files.
  - `packages/`: **`0`** modified files.
  - All workspace files modified after T08 completion (`01:13:56+07:00`) fall strictly inside T09's allowed paths (`apps/clinical-api/`, `tests/`, `docs/`, plus incremental `tsconfig.tsbuildinfo` updated by `tsc --noEmit`).

---

## 2. Independent Verification Re-Run (Read-Only)

This review independently re-executed the T09 verification commands on the unchanged workspace (`DATABASE_URL`, `HAPI_FHIR_BASE_URL`, and `CLINICAL_API_BASE_URL` all confirmed unset on disk/shell) and observed identical results to [docs/evidence/t09-test-report.md](../evidence/t09-test-report.md):

| Check | Exit | Observed Output & Counts |
|---|---|---|
| `npm run contracts:validate` | `0` | `T02 contract validation passed: OpenAPI, event schema, policy and rejection fixtures.` |
| `npm run db:validate` | `2` | `DATABASE_URL is required for schema validation.` (aborted prior to `prisma validate` as expected when `DATABASE_URL` is unset) |
| `npm run typecheck` | `0` | `tsc --noEmit` completed with `0` errors |
| `npm run lint` | `0` | `0` errors (pre-existing `Pages directory cannot be found` advisory from `no-html-link-for-pages` only) |
| `npx eslint` on 8 T09 TS source/test files | `0` | `0` errors, `0` warnings |
| `npm test` | `0` | Vitest `v3.2.7`: **`9` passed files (`52` passed tests)**, **`3` skipped DB integration files (`21` skipped tests: `tests/scheduling.integration.test.ts` `10`, `tests/outbox.integration.test.ts` `10`, `tests/clinical.integration.test.ts` `1`)** |
| `npx vitest run tests/fhir.adapter.test.ts tests/clinical.http.test.ts tests/clinical.integration.test.ts --reporter=verbose` | `0` | `tests/fhir.adapter.test.ts` (`5/5` passed), `tests/clinical.http.test.ts` (`2/2` passed), `tests/clinical.integration.test.ts` (`0/1` run, `1` skipped) |

After these commands completed, the 9-file aggregate SHA-256 was re-verified on disk as `7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`.

---

## 3. Constitution Sections 4, 5, 6, 7 & 8 Audit Checklist

- [x] **Mandatory Work Lifecycle & Approvals (Sections 4 & 9):**
  - `T09-CLINICAL-001` (`docs/decisions/t09-clinical-fhir-approval.md`) records `APPROVED` by the project owner (`2026-11-23`), unlocking both the clinical workflow / private HAPI FHIR R4 adapter (`A1`) and resolution of `T08-BACKEND-FOLLOWUP-001` (`A2` in `docs/decisions/t08-backend-followup.md`).
  - `docs/medicloud/tasks.md` and `docs/medicloud/t09-handoff.md` remain at `READY_FOR_TEST` pending orchestrator transition after all gates pass.
- [x] **Gate Presence, Independence & Causal Chronology (Sections 5 & 7):**
  - Implementation completed all Cycle-2 remediations (`[BLOCKING-1]`–`[BLOCKING-3]` plus hardening) by `2026-11-23T01:44:08+07:00` and issued [docs/medicloud/t09-handoff.md](../medicloud/t09-handoff.md) at `2026-11-23T01:44:39+07:00`.
  - Independent `quality.tester` executed verification during `2026-11-23T01:44:52+07:00`–`01:45:46+07:00` and issued [docs/evidence/t09-test-report.md](../evidence/t09-test-report.md) (`PASS`) at `01:46:22+07:00`.
  - Independent `Code Review` issued [docs/reviews/t09-code-review.md](./t09-code-review.md) (`APPROVE`, Cycle 2 re-review) at `01:47:58+07:00`.
  - Independent `Security/Privacy Review` issued [docs/reviews/t09-security-privacy-review.md](./t09-security-privacy-review.md) (`APPROVE`, Cycle 2 re-verification) at `01:48:06+07:00`.
  - Zero edits occurred to any of the 9 canonical T09 files after `01:44:08+07:00` (prior to handoff and testing).
- [x] **Acceptance & Conformance Fixture Traceability (Section 8):**
  - **`T08-BACKEND-FOLLOWUP-001` (AC-02 alignment):** Verified in [authorization.ts](../../apps/clinical-api/src/security/authorization.ts#L4-L5) (`slot:read` for `PATIENT`/`GUARDIAN`; active `hasValidDelegation` for `:delegated`), [scheduling/service.ts](../../apps/clinical-api/src/scheduling/service.ts#L170-L212) (`listSpecialtiesPublic`, `listSpecialties`, `listDoctors` with non-authoritative `requestedTenantCode`), [http-adapter.ts](../../apps/clinical-api/src/scheduling/http-adapter.ts#L75-L90) (`validateCorrelationId` on public `/v1/specialties`, Bearer verification, `safeCorrelationId`), and [tests/clinical.http.test.ts](../../tests/clinical.http.test.ts#L380-L435) (including `useDefaultResolvers: true`, `401`, `403`, `?specialty=`, `400 invalid_tenant_id`, and cross-tenant `{data: []}`).
  - **AC-05 (Cross-tenant isolation & disclosure-safe `404` + audit):** Verified in [clinical/service.ts](../../apps/clinical-api/src/clinical/service.ts#L212-L223), [clinical/service.ts:368-379](../../apps/clinical-api/src/clinical/service.ts#L368-L379), [hapi-fhir-adapter.ts:452-455](../../apps/clinical-api/src/fhir/hapi-fhir-adapter.ts#L452-L455), [tests/clinical.http.test.ts:442-458](../../tests/clinical.http.test.ts#L442-L458), and [tests/fhir.adapter.test.ts:185-188](../../tests/fhir.adapter.test.ts#L185-L188).
  - **AC-06 (Assigned clinical scope, purpose, atomic completion, audit, records, metrics):** Verified in [clinical/service.ts:190-661](../../apps/clinical-api/src/clinical/service.ts#L190-L661) (`createEncounter`, atomic `updateMany` in `createObservation` at lines `436-442`, `listMyRecords`, `getAdminMetrics`), [authorization.ts:13-44](../../apps/clinical-api/src/security/authorization.ts#L13-L44), and [tests/clinical.http.test.ts:459-628](../../tests/clinical.http.test.ts#L459-L628) (including concurrent `Promise.all`, positive & negative `NURSE`, `GUARDIAN` missing-target/revoked `403`, `RECEPTIONIST` `403`, `AUDITOR` `200`, `PATIENT` `403`).
  - **AC-08 (Cloud outbox allowlist & PHI/token/correlation sanitization):** Verified in [clinical/service.ts:66-91,459-483](../../apps/clinical-api/src/clinical/service.ts#L66-L91), [http-adapter.ts:30-32,189-223](../../apps/clinical-api/src/scheduling/http-adapter.ts#L189-L223) (`MAX_JSON_BODY_BYTES = 65_536`, `safeCorrelationId`), and [tests/clinical.http.test.ts:390-403,495-583,625-627](../../tests/clinical.http.test.ts#L495-L583) (strictly `{ encounter_ref, observation_count: 1 }` validated via `validateEventEnvelope`).
  - **AC-11 (Private HAPI FHIR R4 adapter & conformance fixtures):** Verified in [docs/evidence/t09-fhir-conformance-fixtures.json](../evidence/t09-fhir-conformance-fixtures.json), [hapi-fhir-adapter.ts:180-459](../../apps/clinical-api/src/fhir/hapi-fhir-adapter.ts#L180-L459) (`validateFhirR4Resource`, `assertPrivateFhirEndpoint` blocking public/query/fragment/cloud-metadata hosts, `isValidFhirId`/`isValidFhirReference` blocking `.`/`..`, `JWT_LIKE_RE`, `redirect: 'error'`, `FhirTransportError`), and [tests/fhir.adapter.test.ts:69-190](../../tests/fhir.adapter.test.ts#L69-L190) (directly loading and validating `t09-fhir-conformance-fixtures.json` alongside negative cases and ephemeral loopback `127.0.0.1` HTTP `PUT`/`GET`).
- [x] **Transparent Disclosure of Skipped Checks & Ephemeral Test Scope (Sections 3, 7 & 8):**
  - Every artifact (`t09-handoff.md`, `t09-test-report.md`, `t09-code-review.md`, `t09-security-privacy-review.md`) explicitly discloses:
    1. `DATABASE_URL` unset -> `npm run db:validate` exited `2` and `3` DB integration test files / `21` tests skipped (`tests/clinical.integration.test.ts` included).
    2. `HAPI_FHIR_BASE_URL` unset -> FHIR HTTP checks used ephemeral loopback (`127.0.0.1`) HTTP mock servers and `fetchImpl` stubs rather than a live OpenStack HAPI FHIR container.
    3. HTTP API tests in `tests/clinical.http.test.ts` used an in-memory Prisma/token harness; no live Keycloak JWKS, GCP Cloud Run, GCP Pub/Sub, or OpenStack VM runtime was exercised.
- [x] **Zero Unverified Claims & Synthetic-Only Sanitization (Sections 6, 8 & 10):**
  - Regex secret scan across all 15 T09 documents, fixtures, source files, and test files returned `0` secret matches (`Bearer` and `eyJ...` strings appear solely inside rejection regexes and negative test fixtures).
  - Keyword scan across all T09 documents confirmed every mention of `deployment`, `measured`, `compliance`, `clinical safety`, `SLA`, `RPO`, `RTO`, or live cloud/FHIR/Keycloak runtimes appears solely within explicit **non-claims** or **not executed** limitation statements.

---

## 4. Carried-Forward Non-Blocking Observations (Preserved for `T10`–`T14`)

1. **Deferred Live PostgreSQL Execution (`DATABASE_URL` unset):** Live PostgreSQL constraint checks, `READ COMMITTED` concurrency for `createObservation`'s `updateMany`, and DB-backed `AuditEvent`/`OutboxEvent` persistence (`tests/clinical.integration.test.ts`, `tests/scheduling.integration.test.ts`, `tests/outbox.integration.test.ts`, plus `npm run db:validate`) remain **NOT RUN / SKIPPED** and must execute once `DATABASE_URL` is provisioned in `T10`/`T13`.
2. **Untested Live-Transport Branches Noted in Code & Security Reviews:** `executeFetch` (`redirect: 'error'`) and `handleFhirSync` (`fhir.sync.failed` audit log on `FhirTransportError`) are verified by code inspection (while `FhirTransportError` wrapping itself is executed in `tests/fhir.adapter.test.ts`), and `createOidcVerifier()` leaves `delegations` unpopulated (failing closed `403` for `GUARDIAN` in live OIDC mode until a DB delegation table is wired).
3. **Pre-existing T05 `listSlots` Response Property & Pre-existing Lint Advisory:** Pre-existing T05 `listSlots` (`apps/clinical-api/src/scheduling/service.ts:167`) returns `correlation_id` while `SlotList` in `packages/contracts/openapi.json:43` declares `additionalProperties: false` without `correlation_id` (outside T09's new schemas), and `npm run lint` emits the pre-existing Next.js App Router `Pages directory cannot be found` advisory.

---

## 5. Explicit Non-Claims & Final Decision

- **Explicit Non-Claims:** Per Constitution Sections 3, 8, and 10, this Evidence Review certifies **only** the local T09 evidence package, hash integrity, boundary immutability, gate independence, and transparent local/unit/in-memory-HTTP/loopback-FHIR test records. It makes **no claim** of live PostgreSQL execution, live OpenStack/GCP/HAPI FHIR/Keycloak runtime connectivity, production deployment, measured latency/throughput/SLA/RPO/RTO performance, legal or regulatory compliance, or clinical safety.
- **Decision: APPROVE** — T09 satisfies all Constitution Sections 4, 5, 6, 7, 8, and 10 requirements for canonical 9-file aggregate SHA-256 **`7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`** within the explicitly disclosed local verification scope.
