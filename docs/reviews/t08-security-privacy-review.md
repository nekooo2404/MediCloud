# T08 Independent Security and Privacy Review

**Task:** T08 — Patient and Staff Portal flows using Astryx components, custom `medicloud` theme, and 4 local design skills  
**Decision:** `T08-PORTAL-001` (`APPROVED` in [docs/decisions/t08-portal-skills-approval.md](../decisions/t08-portal-skills-approval.md))  
**Reviewer:** Independent security/privacy review session (strictly separate from implementation owner and `quality.tester`)  
**Review date (+07:00):** `2026-11-23`  
**Security/Privacy Gate Decision:** **`APPROVE`** for the security/privacy gate only (within T08 local synthetic BFF scope; excludes production deployment, live Keycloak/OpenStack readiness, legal compliance, and clinical safety)  
**Reviewed Canonical 24-file Aggregate SHA-256:** `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc`  
**Data classification:** Synthetic data only; zero real PHI/PII, credentials, bearer tokens, private keys, or patient-record content.

---

## 1. Fingerprint and Artifact Verification

- Independently recomputed SHA-256 hashes across all 24 canonical paths using PowerShell `Get-FileHash -LiteralPath -Algorithm SHA256` (properly resolving `[id]` dynamic route files) and joined `path=lowercase_sha256` lines with LF (`\n`) in UTF-8 without BOM.
- Observed aggregate SHA-256 `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc` matches [docs/medicloud/t08-handoff.md](../medicloud/t08-handoff.md) (`READY_FOR_TEST`) and [docs/evidence/t08-test-report.md](../evidence/t08-test-report.md) (`PASS`).
- Directly executed `npx vitest run tests/portal-bff.test.ts` (read-only verification): `1` test file passed, `6/6` T08 BFF security/contract tests passed (`Vitest v3.2.7`).
- Independently scanned all T08 source files, `42` built client chunks under `apps/patient-portal/.next/static/`, test fixtures, and T08 docs. No files were modified by this review outside creating `docs/reviews/t08-security-privacy-review.md`.

---

## 2. Detailed Security & Privacy Audit Findings

### 2.1 Session Signing, Cookie Attributes, and Browser Storage Hygiene
*Audited files: `apps/patient-portal/app/_lib/session.ts`, `apps/patient-portal/app/api/bff/session/route.ts`, `apps/patient-portal/app/page.tsx`, `apps/patient-portal/app/_components/*`, `apps/patient-portal/.next/static/`*

- **HMAC-SHA256 verification & constant-time comparison (`PASS`):** `createSessionCookieValue()` signs base64url JSON `{ personaId, iat }` with `createHmac('sha256', SYNTHETIC_SESSION_SECRET)`. `verifySessionCookieValue()` enforces dot-delimited structure, derives `expectedSig`, checks buffer byte length parity, and compares with `crypto.timingSafeEqual()` before parsing `personaId` against server-side `PERSONA_MAP`.
- **Cookie flags (`PASS`):** `buildSetSessionCookieHeader()` issues `medicloud_demo_session` with `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=28800`, and conditionally appends `Secure` when `x-forwarded-proto === 'https'` or `new URL(request.url).protocol === 'https:'`. `DELETE /api/bff/session` clears the cookie with `Max-Age=0; HttpOnly; SameSite=Lax; Path=/`.
- **Absence of Web Storage tokens & client secret exposure (`PASS`):** Static inspection across `apps/patient-portal/app/`, `apps/patient-portal/styles/`, and all `42` built client chunks in `apps/patient-portal/.next/static/` confirmed **zero** occurrences of `localStorage`, `sessionStorage`, `document.cookie`, `NEXT_PUBLIC_*`, `PORTAL_SESSION_SECRET`, `CLINICAL_API_BEARER_TOKEN`, `CLINICAL_API_BASE_URL`, or `medicloud_demo_session`.
- **Redacted session responses (`PASS`):** `GET /api/bff/session` and `app/page.tsx` pass only synthetic display/membership metadata (`ActiveSession` and non-secret persona summaries), never raw cookie values, HMAC secrets, or upstream bearer tokens.

### 2.2 BFF Authorization, Tenant Isolation, Idempotency, and AC-10 Integrity
*Audited files: `apps/patient-portal/app/_lib/bff-store.ts`, all 6 routes under `apps/patient-portal/app/api/bff/`, `apps/patient-portal/app/_components/StaffDeskWorkspace.tsx`, `apps/patient-portal/app/_components/AppointmentsWorkspace.tsx`*

- **Deny-by-default `401` (`PASS`):** Every protected BFF route (`GET /api/bff/catalog`, `GET /api/bff/slots`, `GET /api/bff/appointments`, `POST /api/bff/appointments`, `GET /api/bff/appointments/[id]`, `POST /api/bff/appointments/[id]/check-in`) invokes `readSessionFromRequest(request)` first and immediately returns `401 unauthorized` on missing or tampered cookies. `GET /api/bff/session` intentionally returns `200 { authenticated: false, session: null }` for unauthenticated gate rendering.
- **Server-derived tenant, subject, and role (`PASS`):** `verifySessionCookieValue()` derives `subject`, `tenantId`, `tenantCode`, `role`, `patientId`, and `patientRef` exclusively from server-side `PERSONA_MAP` via the signed `personaId`. `POST /api/bff/session` enforces an exact single-key allowlist (`persona_id` only; rejects extra keys with `400 unknown_field`). Client-supplied tenant, role, or channel values cannot elevate scope.
- **Strict JSON key allowlists (`additionalProperties: false`) (`PASS`):** `validateAllowedKeys()` enforces:
  - `POST /api/bff/appointments`: allowlist `['slot_id', 'patient_id', 'idempotency_key']`, rejecting `channel` and other unknown properties with `400 unknown_field`. Server derives `serverChannel` (`'staff'` vs `'portal'`) from `session.role`.
  - `POST /api/bff/appointments/[id]/check-in`: allowlist `['check_in_channel']` with strict enum `'desk' | 'portal'` (`400 invalid_channel`).
- **`Idempotency-Key` validation & `409` enforcement (`PASS`):** `createAppointmentForPortal()` requires both `Idempotency-Key` header and `body.idempotency_key` (`409 idempotency_key_required`), validates format `/^[\w-]{16,128}$/` and exact header/body equality (`409 idempotency_key_mismatch`), scopes idempotency keys by `session.tenantId`, replays identical `(slotId, effectivePatientId, serverChannel)` fingerprints with `201` + `x-idempotent-replay: true` without extra capacity decrement, rejects altered payloads reusing the same key with `409 idempotency_conflict`, and rejects full slots with `409 slot_capacity_exhausted`.
- **Disclosure-safe `404` & ownership isolation (`PASS`):**
  - `GET /api/bff/appointments/[id]` validates UUID format (`400 invalid_appointment_id`), filters by `item.tenantId === session.tenantId`, and returns identical `404 resource_not_found` responses for both cross-tenant lookups (`00000000-0000-4000-8000-000000000310`) and same-tenant other-patient lookups (`00000000-0000-4000-8000-000000000303`) when called by `PATIENT`.
  - `GET /api/bff/appointments`, `GET /api/bff/slots`, and `GET /api/bff/catalog` enforce `tenantId === session.tenantId` and restrict `PATIENT` appointment listing to `ownerSubject === session.subject`.
- **RBAC `403` & UI-only check boundary (`PASS`):**
  - `POST /api/bff/appointments/[id]/check-in` validates UUID (`400`), scopes appointment lookup to `session.tenantId` (`404 appointment_not_found` for cross-tenant `...310`), rejects non-`RECEPTIONIST` callers with `403 role_action_denied`, rejects non-`confirmed` appointments (e.g., `cancelled` `...304`) with `403 resource_state_denied`, and performs idempotent `200` check-in for `RECEPTIONIST` preserving the original `checked_in_at` timestamp.
  - `StaffDeskWorkspace.tsx` disables check-in buttons when `session.role !== 'RECEPTIONIST'` solely as UX guidance, explicitly states in Vietnamese UI copy that UI hiding does not replace backend authorization, and provides a button allowing a `PATIENT` session to verify server-side `403` enforcement directly.
- **AC-10 fail-closed `503 private_boundary_degraded` & `x-medicloud-sim` gating (`PASS`):**
  - `callUpstream()` enforces `AbortSignal.timeout(timeoutMs)` (default `4000ms` via `CLINICAL_API_TIMEOUT_MS`), converts upstream HTTP `>= 500`, network errors, and timeouts into `503 private_boundary_degraded` with `correlation_id` and explicit non-confirmation wording, without mutating state or forwarding upstream 5xx bodies/stacks.
  - Synthetic `x-medicloud-sim: degraded` returns `503 private_boundary_degraded` prior to any store write; `tests/portal-bff.test.ts` confirms appointment count and slot capacity remain unchanged and `t08-degraded.png` confirms UI clears stale receipts and surfaces assertive error banners without false confirmation.
  - When `CLINICAL_API_BASE_URL` is configured, all 6 BFF store operations enter the `if (process.env.CLINICAL_API_BASE_URL)` upstream branch before `applySimulation(sim, correlationId)`, ensuring `x-medicloud-sim` headers are ignored server-side whenever upstream mode is active.

### 2.3 Redacted Logging and Error Envelopes
*Audited files: `apps/patient-portal/app/_lib/redacted-log.ts`, all `/api/bff/*` route handlers, `apps/patient-portal/app/_lib/session.ts`*

- `createRedactedBffLog()` restricts log records to `{ ts, service, action, status, correlation_id, mode, reason }`.
- `buildCorrelationId()` strictly allowlists incoming `x-correlation-id` values matching `/^synthetic-[a-z0-9-]{4,64}$/` and otherwise generates `synthetic-portal-<uuid_prefix>`, preventing log/header injection and token/PHI smuggling via correlation headers.
- Route handlers log route templates (`GET /api/bff/appointments/[id]`, `POST /api/bff/appointments/[id]/check-in`) rather than raw UUID path parameters, query parameters, request JSON bodies, `Idempotency-Key` values, `Cookie` headers, `Authorization` headers, bearer tokens, raw claims, PHI/PII, or stack traces.
- No other `console.*` calls exist anywhere in `apps/patient-portal/`.

### 2.4 `.agents/skills/` Boundary Hygiene and Synthetic-Only Compliance
*Audited directories/files: `.agents/skills/`, `apps/patient-portal/`, `src/themes/medicloud/`, `themes/medicloud/`, `tests/portal-bff.test.ts`, `output/playwright/t08_browser_check.py`, `apps/clinical-api/`, `packages/contracts/`, `docs/`*

- **Project-local skills boundary (`PASS`):** All 4 skills (`ui-ux-pro-max`, `hallmark`, `impeccable`, `taste-skill`) and [`.agents/skills/README.md`](../../.agents/skills/README.md) are installed strictly inside `<project-root>/.agents/skills/` with no `.git` or `node_modules` directories inside `.agents/skills/` and zero modifications outside the MediCloud project boundary.
- **Excluded external skill behaviors (`PASS`):** Scans of `apps/patient-portal/app/`, `apps/patient-portal/styles/`, and `src/themes/medicloud/` confirmed zero references to WebGL, `photos.mjs`, `assets.mjs`, external URLs (`http://`/`https://`), raw `<div>`/`<span>`, `dangerouslySetInnerHTML`, or `eval(`. Typography uses bundled local `Figtree` `.woff2` files via `@astryxdesign/theme-neutral/fonts.css` with zero external CDN requests.
- **Out-of-scope immutability (`PASS`):** File timestamps in `apps/clinical-api/` and `packages/contracts/` predate T08 start (`latest <= 2026-11-22T22:38:08+07:00`), confirming zero edits outside T08 allowed paths.
- **Synthetic-only data (`PASS`):** All persona identifiers (`synthetic-subject-*`, `synthetic-profile-*`), UUIDs (`00000000-0000-4000-8000-*`), practitioner/hospital names (`(Mẫu)`), screenshots (`t08-staff.png`, `t08-degraded.png`), and docs contain synthetic data only with zero real PHI/PII, credentials, private keys, or live JWTs.

---

## 3. Non-Blocking Hardening & Transition Notes (Tracked for Pre-Staging / T11–T13)

The following observations do **not** violate T08's approved local synthetic BFF security boundary (`T08-PORTAL-001`), but must be addressed before staging/production integration (`T11`–`T15`):

1. **Malformed percent-encoding in cookie parser (`session.ts:123`):** `readCookieFromHeader()` calls `decodeURIComponent(...)` without `try/catch`; a malformed `%` sequence in `medicloud_demo_session` would raise an unhandled `URIError` (`500`) instead of returning `null` (`401`). Wrap `decodeURIComponent` in `try/catch` returning `null`.
2. **Server-side session TTL & fail-closed secret (`session.ts:6-7, 81-114`):** `verifySessionCookieValue()` relies on browser `Max-Age=28800` and does not verify `iat` age server-side; `SYNTHETIC_SESSION_SECRET` falls back to a synthetic literal when `PORTAL_SESSION_SECRET` is unset. Production/staging wiring must require a secret from Secret Manager (fail-closed if missing) and enforce server-side session expiration (`iat`/`exp`).
3. **Cookie clearing on HTTPS (`session.ts:158-160`):** `buildClearSessionCookieHeader()` omits `Secure`; align with `buildSetSessionCookieHeader(value, request)` when terminating HTTPS.
4. **Synthetic `RECEPTIONIST` explicit `patient_id` check (`bff-store.ts:517-585`):** In synthetic local mode, `PATIENT` is strictly confined to `session.patientId` (`403`), whereas a `RECEPTIONIST` submitting a non-default `patient_id` is not checked against a tenant-scoped synthetic patient registry (unlike `apps/clinical-api/src/scheduling/service.ts:132` which returns `404 patient_not_found`). (The portal UI does not expose a `patient_id` field, and no cross-tenant patient record is disclosed.)
5. **Upstream OIDC token exchange & `T08-BACKEND-FOLLOWUP-001` (`bff-store.ts:289-292`, `437-443`, `docs/decisions/t08-backend-followup.md`):** `callUpstream()` currently attaches a single optional process-level `CLINICAL_API_BEARER_TOKEN` (suitable only for T08 timeout tests) rather than per-user Keycloak OIDC session tokens, `listAppointmentsForPortal()` returns an empty upstream stub, and `clinical-api` still requires approved `PATIENT` `slot:read` policy plus `/v1/specialties` and `/v1/doctors` endpoints before `T13` staging integration.
6. **Session `400` observability (`session/route.ts:48-74`):** Invalid `POST /api/bff/session` payloads return redacted `400` responses without emitting `logBffEvent`; optional structured `400` logging may be added alongside `appointments` and `check-in`.

---

## 4. Explicit Limitations and Non-Claims

- This approval applies **solely** to the **Security/Privacy gate** for T08's reviewed local synthetic implementation (`2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc`). It does not replace independent `Code Review` or `Evidence` gates.
- This review makes **no claim** of production deployment, live Keycloak OIDC/JWKS integration, live OpenStack PostgreSQL or `clinical-api` connectivity, GCP Cloud Run readiness, measured latency/throughput/SLA/RPO/RTO performance, legal or regulatory compliance, or clinical safety.

**Conclusion:** **`APPROVE`** for the security/privacy gate only.
