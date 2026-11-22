# T02 Independent TestReport

**Task:** T02 - Shared API/event contracts and data classification  
**Decision:** `T02-CONTRACTS-001`  
**Tester role:** Independent `quality.tester`  
**Run window:** 2026-11-21 17:30:04 +07:00 to 17:30:56 +07:00  
**Environment:** Windows PowerShell, project root `D:\hoapuiii\Code\MediCloud`, Node.js v24.16.0, npm 12.2.0, Vitest 3.2.7  
**Implementation changes:** None. Only this TestReport was overwritten.  
**Data scope:** Synthetic contract fixtures only; no real PHI/PII, credentials, tokens or patient records used.

## Status

**PASS**

All required command checks and requested T02 contract assertions passed. The report is tied to the current contract artifacts by the SHA-256 fingerprints below.

## Required Commands

| Command | Exit | Result | Timestamp |
|---|---:|---|---|
| `npm run contracts:validate` | 0 | PASS; OpenAPI, event schema, policy and rejection fixtures validated | 2026-11-21 17:30:04 +07:00 |
| `npm test` | 0 | PASS; 2 test files, 11/11 tests passed | 2026-11-21 17:30:04 +07:00 |
| `npm run typecheck` | 0 | PASS; `tsc --noEmit` completed successfully | 2026-11-21 17:30:04 +07:00 |
| `npm run lint` | 0 | PASS; exit 0, with existing non-failing App Router `pages` advisory | 2026-11-21 17:30:04 +07:00 |

## Requested Contract Checks

### Tenant scope

**PASS:** `components.parameters.TenantId.required` is `false`. Its description states that it is an optional, non-authoritative filter and that the server derives authorization from validated membership. The classification policy also sets `tenant_id_server_derived: true`.

### Protected operation error matrix

**PASS:** All 9 protected operations declare `401`, `403` and `404`: `/v1/doctors`, `/v1/slots`, `/v1/appointments`, `/v1/appointments/{id}`, `/v1/appointments/{id}/check-in`, `/v1/encounters`, `/v1/encounters/{id}/observations`, `/v1/me/records` and `/v1/admin/metrics`. Public `/v1/specialties` explicitly has `security: []` and is correctly excluded.

### Idempotency

**PASS:** `POST /v1/appointments` references the required `IdempotencyKey` header. The contract requires equality with `body.idempotency_key` and documents a conflict response for mismatch.

### Response schemas

**PASS:** No component response references `SimpleData`. The inspected response schemas are explicit. Common error responses use the closed `Error` contract with `error.code`, `error.message` and `error.correlation_id`.

### Event mappings and prohibited fields

**PASS:** The event envelope contains six `oneOf` mappings with `event_type` constants bound to their payload variants, including a distinct `encounter.completed` payload. The base envelope and all payload schemas are closed with `additionalProperties: false`. Validator fixtures reject mismatched event/payload combinations, missing envelope fields, unknown/prohibited payload fields and invalid `encounter.completed` payloads.

### Data classification

**PASS:** `public`, `internal`, `sensitive` and `restricted-clinical` classes are present. Synthetic-only policy is enabled; private database public exposure and raw clinical data transfer to public cloud are disabled; server-derived tenant policy is declared.

## Artifact fingerprints

| Artifact | SHA-256 |
|---|---|
| `packages/contracts/openapi.json` | `3EA48F45AF09448E205DC4CFD25A0FBD6AF0D65FDE71F47F521A8A2F6E6ED0A0` |
| `packages/contracts/schemas/event-envelope.schema.json` | `D649C1B447E1B90371DE94583393035016E619423B36AE78A322E77643A8D72C` |
| `packages/contracts/data-classification.json` | `FDD123C5EFB10E18589E081E0858FF929F91C39003F25862D1B2DAE57BD862A7` |
| `packages/contracts/validate.mjs` | `886A0FD944DB76063A9CC200F7A1F72B8B7E678605A41BBD77EE02676EEC24EF` |

## Scope exclusions

Not run because outside this tester request: deployment, cloud connectivity, database migrations, runtime authorization, tenant-isolation integration tests, performance measurements and security scanning. These local artifact checks do not establish runtime authorization, cloud deployment, production readiness, legal compliance or clinical safety.

## Conclusion

**T02 independent test result: PASS.** The requested latest-diff checks passed. Code review and evidence review remain separate Constitution gates; this report does not self-approve either gate.
