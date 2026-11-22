# T08 Patient & Staff Portal Design Skills, Theme, and BFF Approval

**Decision ID:** T08-PORTAL-001
**Status:** APPROVED
**Requested approver:** Project owner
**Accountable owner:** Project owner
**Implementation boundary:** `apps/patient-portal/`, `docs/`, `.agents/skills/`, `themes/medicloud/`, `src/themes/medicloud/`, `astryx-themes.ts`, `tests/portal-bff.test.ts`, `output/playwright/t08_browser_check.py`
**Dependencies:** T01 (`TEST_PASSED`), T04 (`TEST_PASSED`), T05 (`TEST_PASSED`)
**Data policy:** Synthetic data only. No real PHI/PII, credentials, bearer tokens, private keys, or patient-record content.

## 1. Approved Decisions (Clarify Record A1–A4)

1. **Local Skills & Precedence (`A1`):**
   - Install `ui-ux-pro-max`, `hallmark`, `impeccable`, and `taste-skill` strictly inside `.agents/skills/` within the MediCloud project root. Never install global skills (`-g`, `~/.claude`, `~/.gemini`) or modify parent directories.
   - Precedence order:
     `Project Owner Decision -> CONSTITUTION.md -> Approved Decisions -> AGENTS.md (Astryx v0.7.17) -> 4 Local Design Skills`
   - Conflicting behaviors in external skills are explicitly excluded: no raw `<div>`/`<span>`, no Tailwind/utility classes, no raw `#hex`/`px` literals in app code, no `:root` overrides, no Hallmark random Theme Dealer, and no `taste-skill` WebGL or external photo scraping.

2. **Scope & Dual-Mode BFF (`A2`):**
   - Keep `apps/clinical-api/` and `packages/contracts/` unmodified in T08.
   - Implement a Next.js App Router BFF under `apps/patient-portal/app/api/bff/` using HMAC-SHA256 signed `HttpOnly`, `SameSite=Lax` cookies (`medicloud_demo_session`). Never store bearer tokens or claims in `localStorage`/`sessionStorage`.
   - Support two modes:
     - **Upstream mode** (`CLINICAL_API_BASE_URL` configured): forwards requests with bounded timeout (`CLINICAL_API_TIMEOUT_MS`), correlation IDs, and `Idempotency-Key`, returning explicit `503 private_boundary_degraded` on timeout/upstream failure without false confirmation (AC-10).
     - **Synthetic Local BFF mode** (default when `CLINICAL_API_BASE_URL` is unset): enforces the T05/OpenAPI request/response contract, server-derived tenant & role membership, idempotency replay/conflict (`409`), slot capacity enforcement (`409`), disclosure-safe cross-tenant/other-patient `404`, RBAC check-in enforcement (`403` for `PATIENT`, idempotent `200` for `RECEPTIONIST`), and deterministic simulation controls (`normal`, `degraded`, `empty`, `slow`).
   - Backend follow-up gaps discovered during planning (`PATIENT` `slot:read` in T04 policy and `/v1/specialties`, `/v1/doctors` HTTP routes) are tracked separately in `docs/decisions/t08-backend-followup.md`.

3. **Custom Astryx Healthcare Theme (`A3`):**
   - Create and tune the `medicloud` theme via `npm run astryx -- experimental theme editor`, inspect rendered `--png` component captures, and wire via `theme add medicloud` + `theme use medicloud` into `astryx-themes.ts` and `src/themes/medicloud/`.

4. **Language (`A4`):**
   - Vietnamese clinical UI copy aligned with `<html lang="vi">`, using synthetic hospital, practitioner, and patient data only.

## 2. Explicit Non-Claims

This approval covers local T08 UI/BFF implementation, synthetic automated testing, and local Playwright verification only. It does **not** approve or claim production deployment, live Keycloak/OpenStack/GCP connectivity, measured latency/SLA performance, legal compliance, or clinical safety.

## Approval record

**Decision:** APPROVED
**Approver:** Project owner (Clarify answers A1–A4)
**Timestamp (+07:00):** 2026-11-23
**Approval text:** Approved via interactive project-owner clarification (A1–A4) for T08 Patient & Staff Portal execution.
