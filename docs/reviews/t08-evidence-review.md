# T08 Independent Evidence Review

**Task:** T08 — Patient and Staff Portal flows using Astryx components, custom `medicloud` theme, and 4 local design skills  
**Decision Record:** `T08-PORTAL-001` (`APPROVED` in `docs/decisions/t08-portal-skills-approval.md`)  
**Reviewer:** Independent Evidence Review session (`563a9149...`, strictly separate from implementation owner, `quality.tester`, Code Review, and Security/Privacy Review)  
**Review date (+07:00):** `2026-11-23T01:12:23+07:00`  
**Decision:** `APPROVE` (Evidence gate only, within approved T08 local synthetic BFF scope)  
**Reviewed canonical 24-file aggregate SHA-256:** `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc`  
**Data classification:** Synthetic data only; zero real PHI/PII, raw credentials, bearer tokens, private keys, or patient-record content.  
**Files modified by this review:** Only `docs/reviews/t08-evidence-review.md` (zero edits to source, theme, config, test, script, handoff, `TestReport`, code review, security review, screenshot, or `docs/medicloud/tasks.md` files).

---

## 1. Recomputed Fingerprints & Artifact Alignment

### 1.1 Canonical 24-File Manifest & Aggregate SHA-256

Independently recomputed from disk using PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath` (resolving `[id]` dynamic route paths explicitly) and joining `path=lowercase_sha256` lines with `\n` (LF, UTF-8 without BOM):

- **Recomputed Aggregate SHA-256 (disk):** `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc`
- **Cross-artifact alignment:** Exact 24/24 per-file SHA-256 and aggregate SHA-256 match confirmed programmatically across disk, `docs/medicloud/t08-handoff.md`, `docs/evidence/t08-test-report.md`, and `docs/reviews/t08-code-review.md`; aggregate SHA-256 match confirmed across `docs/reviews/t08-security-privacy-review.md`.

| # | Path | Recomputed SHA-256 (Disk) | Bytes | Disk LastWriteTime (`+07:00`) |
|---|---|---|---|---|
| 1 | `astryx-themes.ts` | `6b749f62023922c069f19f7a5ebbc8aed06186969474a8251276f83f4071b407` | 771 | `2026-11-23T00:27:03+07:00` |
| 2 | `themes/medicloud/medicloud.settings.json` | `a8893529d04ef1fb9b7b495927b10a65fe557656c8155791706d3aac81e14f3f` | 1141 | `2026-11-23T00:26:20+07:00` |
| 3 | `apps/patient-portal/styles/globals.css` | `44f05bae512541d5e11e9f571bd94ef01638369391c419a62d1d54f68ef8340f` | 1507 | `2026-11-23T00:27:54+07:00` |
| 4 | `apps/patient-portal/app/layout.tsx` | `b61591c079de3ad80c911861f814f1065c966fd7f6dd4a5365a8b598ca8dc507` | 798 | `2026-11-23T00:28:17+07:00` |
| 5 | `apps/patient-portal/app/page.tsx` | `8b84efd141d4a45bc8d135493a112783da21384888cf893e1dfe39f40466e2d7` | 795 | `2026-11-23T00:31:06+07:00` |
| 6 | `apps/patient-portal/app/_lib/types.ts` | `8e740a30b14712ac7f34065e7ccd5dd159f67366970ec08b4696b7a7b81d3197` | 1752 | `2026-11-23T00:32:43+07:00` |
| 7 | `apps/patient-portal/app/_lib/redacted-log.ts` | `5a1cb87cc6e537e1d57e9e7370f9b80450d6fcdbe7f3d2603735b1026180bbea` | 634 | `2026-11-23T00:25:12+07:00` |
| 8 | `apps/patient-portal/app/_lib/session.ts` | `ad2167b29f2936e6ba062a1cc5d3a71873fa68892f72a72568c427eab22b9dd1` | 5626 | `2026-11-23T00:25:21+07:00` |
| 9 | `apps/patient-portal/app/_lib/bff-store.ts` | `6a6a6aacd71427a3ac72974dda07fde0edbdb710b211fea5187acc1bddc4e2af` | 24836 | `2026-11-23T00:26:03+07:00` |
| 10 | `apps/patient-portal/app/_components/PortalThemeProvider.tsx` | `e5631f6798f9fb82ff8305075951c6b46ed0e9451486b0556ee409ae4e0b1f37` | 887 | `2026-11-23T00:28:16+07:00` |
| 11 | `apps/patient-portal/app/_components/portal-utils.ts` | `2e5246869933ff4167d1b30a3df46996740f7912da2b8963482e1f229129e057` | 1772 | `2026-11-23T00:28:40+07:00` |
| 12 | `apps/patient-portal/app/_components/SessionGate.tsx` | `727b3c7e6b7404866df9aa16bba6ded34d3af1ed85f0aef7fabf316bad150e5d` | 3292 | `2026-11-23T00:28:56+07:00` |
| 13 | `apps/patient-portal/app/_components/BookingWorkspace.tsx` | `0a7e3baba2c6d0f859ab37d0985f5178d84920a03c0456e4f2a1d4b4b768b93a` | 23042 | `2026-11-23T00:38:38+07:00` |
| 14 | `apps/patient-portal/app/_components/AppointmentsWorkspace.tsx` | `812ce463765a2710d05c0e6d57fe7f708483f362e45823d540bf6487c7f09b33` | 19286 | `2026-11-23T00:31:03+07:00` |
| 15 | `apps/patient-portal/app/_components/StaffDeskWorkspace.tsx` | `67dc7b9e4f7e4a26cfa2e73975aa07ad8137001ab69f598930341c05c1bae8bb` | 14653 | `2026-11-23T00:31:04+07:00` |
| 16 | `apps/patient-portal/app/_components/PortalApp.tsx` | `d618e168d26a424ce1bebdcf9c0dabe38b7ea55da510e5decfca87508e84880a` | 14438 | `2026-11-23T00:38:37+07:00` |
| 17 | `apps/patient-portal/app/api/bff/session/route.ts` | `66d00654fd69ed3608075762713172b4e44897e2e4a8cdbc8214aa8a5d817843` | 4235 | `2026-11-23T00:26:48+07:00` |
| 18 | `apps/patient-portal/app/api/bff/catalog/route.ts` | `ca611da3c521076f943d9a09cb8d61ef5e8ac49c0db6307bc90b47fd608142b3` | 1341 | `2026-11-23T00:26:50+07:00` |
| 19 | `apps/patient-portal/app/api/bff/slots/route.ts` | `c2fed47d164394791a36e71d4e463ed981723dcc85b6f7c87fe8109ebcf4d4dc` | 1454 | `2026-11-23T00:26:51+07:00` |
| 20 | `apps/patient-portal/app/api/bff/appointments/route.ts` | `f182ce52a5a12cd4a7888c40ddb5019b25c7f2f69ee00ee03b876a097f1927c9` | 3059 | `2026-11-23T00:26:52+07:00` |
| 21 | `apps/patient-portal/app/api/bff/appointments/[id]/route.ts` | `d2e4d17d420d737aa4405a3efa2413f46d512c25efa53a15fe1a599b960e26a1` | 1495 | `2026-11-23T00:26:53+07:00` |
| 22 | `apps/patient-portal/app/api/bff/appointments/[id]/check-in/route.ts` | `6719d6aefa5bc78c0fa4764224be19ad2a6105545fb7165a1236d207caac6388` | 1989 | `2026-11-23T00:26:55+07:00` |
| 23 | `tests/portal-bff.test.ts` | `bdb8e97558a90845455825469498ece5073e293e125210aaba891d30b87a29a2` | 13961 | `2026-11-23T00:32:31+07:00` |
| 24 | `output/playwright/t08_browser_check.py` | `e6703a931004c788372caeac4d3f64b6dbd52a253b791745544e4e031b559efa` | 10809 | `2026-11-23T00:39:44+07:00` |

### 1.2 Evidence Screenshots (SHA-256, Byte Sizes, Timestamps, Visual Verification)

All 5 PNG captures in `docs/evidence/` were independently hashed, sized, timestamp-checked, and directly inspected. All 5 SHA-256 digests and byte counts match `docs/evidence/t08-test-report.md` and `docs/reviews/t08-code-review.md` identically, and their disk timestamps fall within the recorded `t08_browser_check.py` execution window (`2026-11-23T01:03:40+07:00` – `2026-11-23T01:03:48+07:00`).

| Artifact | Recomputed SHA-256 (Disk) | Bytes | Disk LastWriteTime (`+07:00`) | Direct Visual Check |
|---|---|---|---|---|
| `docs/evidence/t08-desktop.png` | `4447ff64dcb7d0769c93faed9db404ff683142912aaa0bd2bb13d472a69a75a3` | 90535 | `2026-11-23T01:03:42+07:00` | `1440x900` patient booking workspace (`Bệnh nhân mẫu #1`, `Vai trò: Bệnh nhân`, `Bệnh viện Tổng hợp A (Mẫu)`), 3 slot rows (`2/3`, `1/2`, `0/1` `Hết chỗ`), synthetic disclaimer footer, zero overlap/clipping. |
| `docs/evidence/t08-tablet.png` | `f3c4660b0256cd54839f5a1f964bf41fc0e5fad2efee5ce84e318ac9a46be42f` | 91701 | `2026-11-23T01:03:48+07:00` | `768x1024` booking table (`Lễ tân quầy tiếp nhận A`, `Vai trò: Lễ tân`, capacity updated `1/3`), clean column wrapping, zero horizontal overflow. |
| `docs/evidence/t08-mobile.png` | `ab63ffaa8050e7c8262438533a1b0d62be487b0fd40a921e3f20922323971c73` | 73990 | `2026-11-23T01:03:48+07:00` | `390x844` mobile layout using compact `List` rows (`08:30`, `09:30`, `10:30` `Hết chỗ`), vertically stacked filters, scrollable tab chevron, zero horizontal overflow. |
| `docs/evidence/t08-staff.png` | `4e54e14e2f08fdbeea7af28228cca1f4e2ec3e1449d1d027206a4c611a0a49fd` | 125697 | `2026-11-23T01:03:47+07:00` | `1440x900` `Quầy tiếp nhận bệnh nhân (Staff Check-In)` view (`synthetic-profile-1`, `synthetic-profile-9`), green check-in confirmation banner (`synthetic-portal-c00e7d11-f3f`), idempotent `Kiểm tra lại (Idempotent)`, disabled action on cancelled row (`Đã huỷ`). |
| `docs/evidence/t08-degraded.png` | `8c71d4b9eb5d8de4c092075877841962c424b78862d7e34626bdf90582c80977` | 152225 | `2026-11-23T01:03:45+07:00` | `1440x900` AC-10 degraded banners (page-level `Cảnh báo AC-10` and modal `Gián đoạn ranh giới lâm sàng: chưa đặt lịch`) displaying `synthetic-ac10-e2e-check` while preserving `Idempotency-Key` and showing zero false confirmation. |

---

## 2. Constitution Section 8 Verification Checklist

- [x] **Reproducible command records (`docs/evidence/t08-test-report.md`):** Every one of the 8 recorded commands/checks includes explicit start/end timestamps in `+07:00` (`2026-11-23T01:02:57+07:00` – `2026-11-23T01:04:02+07:00`), explicit exit code (`0`), full runtime/environment details (Windows 11 local workspace, Node `v24.16.0`, npm `12.2.0`, Corepack pnpm `10.22.0`, Python `3.12.0`, Playwright `1.60.0`, Next.js `15.5.29`, `@astryxdesign/core` & `@astryxdesign/cli` `v0.7.17`, `CLINICAL_API_BASE_URL` unset, `DATABASE_URL` unset), and explicit counts/assertions (`7` test files / `45` tests passed including `6/6` in `tests/portal-bff.test.ts`; `2` DB integration files / `20` tests explicitly reported as skipped because `DATABASE_URL` is unset; `tsc --noEmit` `0` errors; ESLint `0` errors; `contracts:validate` passed; `next build` `3.7s`, `7/7` static pages, `6` `/api/bff/*` routes; `astryx doctor` `pass: 26, warn: 1, fail: 0, info: 10`; `t08_browser_check.py` `unauth_tabs=5`, `tablet_tabs=6`, `mobile_tabs=5`, `console_errors=0`, `unexpected_http_errors=0`; ephemeral `next start` read-only `401` + `localStorage.length === 0`, `sessionStorage.length === 0`, `httpOnly: true`, `sameSite: "Lax"`, `200` catalog check).
- [x] **Accurate Acceptance & NFR mapping without claim inflation:**
  - `AC-02` (Patient slot lookup & booking): mapped to `tests/portal-bff.test.ts`, `t08_browser_check.py`, and `t08-desktop.png`, `t08-tablet.png`, `t08-mobile.png`, explicitly scoped to **local synthetic BFF mode** (explicitly excluding live GCP-to-OpenStack DB persistence).
  - `AC-04` (`Idempotency-Key` safety): mapped to `tests/portal-bff.test.ts` (same-payload replay `201` + `X-Idempotent-Replay: true` without extra capacity decrement, `409 idempotency_conflict`, `409 slot_capacity_exhausted`, `400 unknown_field`), scoped strictly to **local synthetic BFF mode**.
  - `AC-05 & T04/T05 RBAC / tenant / session boundaries`: mapped to `tests/portal-bff.test.ts`, `t08_browser_check.py`, `t08-staff.png`, and the independent `401`/storage check (`401` unauthenticated/tampered cookie, disclosure-safe `404` for cross-tenant and other-patient lookup, `403 role_action_denied` for `PATIENT` check-in, idempotent `200` `RECEPTIONIST` check-in, `403 resource_state_denied` on cancelled appointment, `HttpOnly; SameSite=Lax` cookie, `localStorage.length === 0`, `sessionStorage.length === 0`), scoped strictly to **local synthetic BFF mode**.
  - `AC-10` (Degraded / timeout integrity): mapped to `tests/portal-bff.test.ts` (synthetic `x-medicloud-sim: degraded` `503` leaving appointment list unchanged, plus slow local HTTP upstream server with `CLINICAL_API_TIMEOUT_MS=30` returning `503 private_boundary_degraded`) and `t08_browser_check.py` + `t08-degraded.png` (`synthetic-ac10-e2e-check`, zero false booking confirmation, recovery restores slots).
  - `NFRs`: mapped to `astryx doctor` (`26 pass, 1 warn, 0 fail, 10 info`), keyboard `Tab` focus checks (`unauth_tabs=5`, `tablet_tabs=6`, `mobile_tabs=5`), zero horizontal overflow across `1440x900`, `768x1024`, and `390x844`, mobile `List` adaptation, empty state simulation, zero console/page/unexpected HTTP errors, and redacted BFF log schema (`tests/portal-bff.test.ts`).
  - No artifact converts local/synthetic verification into `DEPLOYED` or `MEASURED` claims.
- [x] **Consistent disposition of all 3 warning/info notes:**
  1. `built-astryx-purity` `[warn]` (`apps/patient-portal/app/layout.tsx:4` imports `../styles/globals.css`): consistently documented across `t08-handoff.md`, `t08-test-report.md`, and `t08-code-review.md` as accepted non-blocking T01 pattern (`docs/reviews/t01-code-review.md`); direct inspection of `apps/patient-portal/styles/globals.css` confirms `@layer` ordering and token-only rules with zero raw `#hex`, `px`, or `:root` overrides.
  2. ESLint / Next.js `Pages directory cannot be found` advisory (plus `next build` ESLint plugin detection notice): consistently documented across `t08-handoff.md`, `t08-test-report.md`, and `t08-code-review.md` as accepted non-blocking advisory; direct inspection of `eslint.config.mjs` confirms `@next/eslint-plugin-next` is explicitly configured for App Router without `pages/` and `npm run lint` exits `0` with `0` errors.
  3. `button-actions` `[info]` note from `astryx doctor` (`.agents/skills/impeccable/scripts/live-browser-dom.js`): consistently documented across `t08-handoff.md`, `t08-test-report.md`, and `t08-code-review.md` as accepted non-blocking info note from vendored third-party skill assets confirmed present on disk (`Test-Path` = `True`), unused by `apps/patient-portal/`, with interactive handlers verified in code and Playwright.
- [x] **Gate independence & post-handoff immutability:**
  - Separate independent gate sessions verified: implementation owner finalized source/tests by `2026-11-23T00:39:44+07:00` and handoff (`docs/medicloud/t08-handoff.md`, `READY_FOR_TEST`) at `01:01:36+07:00`; independent `t08_quality_tester` (`f84da8f5...`) executed verification `01:02:05+07:00`–`01:04:09+07:00` and wrote `docs/evidence/t08-test-report.md` (`PASS`, `01:05:20+07:00`); independent `t08_security_reviewer` (`5035b762...`) wrote `docs/reviews/t08-security-privacy-review.md` (`APPROVE`, `01:09:42+07:00`); independent `t08_code_reviewer` (`4cc3dec8...`) wrote `docs/reviews/t08-code-review.md` (`APPROVE`, `01:10:01+07:00`); and this independent Evidence Review session (`563a9149...`) wrote only `docs/reviews/t08-evidence-review.md`.
  - Zero source or test files were modified after handoff or testing (all 24 canonical timestamps `<= 2026-11-23T00:39:44+07:00` and hashes match `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc`).
  - Out-of-scope boundary confirmed untouched: `apps/clinical-api/` latest timestamp is `2026-11-22T22:38:08+07:00` (with T06 baseline hashes `policy-gateway.ts` `a3388300...`, `schema.prisma` `c957a974...`, migrations `b7266a20...`, `ea6567a5...` verified intact on disk) and `packages/contracts/` latest timestamp is `2026-11-22T02:38:14+07:00`, both predating T08 start (`2026-11-23T00:23:08+07:00`).
  - `docs/medicloud/tasks.md` and `docs/medicloud/t08-handoff.md` remain at `READY_FOR_TEST` pending orchestrator transition after all gates pass.
- [x] **Sanitization & synthetic-only compliance:** Read-only regex secret/token/cookie scan across T08 decision records, handoff, test report, code/security reviews, tests, Playwright script, and `apps/patient-portal/app/` returned `0` hits; visual inspection of all 5 PNG screenshots confirmed synthetic Vietnamese personas/practitioners/facilities only with zero raw secrets, bearer tokens, cookies, or real PHI/PII exposed.

---

## 3. Explicit Non-Claims & Scope Boundaries

- This Evidence Review covers **local T08 UI/BFF verification, synthetic automated tests, Astryx compliance, and local Playwright captures only** (`CLINICAL_API_BASE_URL` unset; `DATABASE_URL` unset so `2` PostgreSQL integration test files / `20` tests were skipped).
- Live Keycloak OIDC/JWKS login, live OpenStack PostgreSQL / `apps/clinical-api` HTTP round-trips from the Portal BFF, GCP Cloud Run deployment, and backend follow-up changes tracked in `docs/decisions/t08-backend-followup.md` (plus pre-staging hardening notes in `t08-code-review.md` and `t08-security-privacy-review.md` for `T11`–`T15`) were **not** exercised in T08.
- This approval makes **no claim** of production deployment, multi-cloud runtime connectivity, measured latency/throughput/SLA/RPO/RTO performance, legal or regulatory compliance, or clinical safety.

---

## 4. Conclusion

The T08 evidence package satisfies all Constitution Section 5, Section 7, and Section 8 requirements for fingerprint integrity, screenshot verification, reproducible timestamped command records, accurate local-synthetic acceptance/NFR mapping, consistent warning dispositions, reviewer independence, and synthetic-only sanitization. **Evidence gate: APPROVE.**
