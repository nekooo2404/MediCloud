# T08 Independent Code Review

**Task:** T08 — Patient and Staff Portal flows using Astryx components, custom `medicloud` theme, and 4 local design skills  
**Decision:** `APPROVE` (for the T08 independent Code Review gate within the approved local synthetic BFF scope under `T08-PORTAL-001`)  
**Reviewer:** Independent code-review session (separate from implementation owner and independent tester)  
**Review date (+07:00):** `2026-11-23`  
**Reviewed canonical 24-file aggregate SHA-256:** `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc`  
**Implementation / Test / Handoff / `tasks.md` modified by this review:** None (strictly read-only review; only `docs/reviews/t08-code-review.md` written)

---

## 1. Scope, Fingerprint, and Out-of-Scope Boundary Verification

### 1.1 Canonical 24-File Fingerprint Alignment

Using PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath` (handling `[id]` dynamic route paths explicitly) and UTF-8 LF-joined `path=lowercase_sha256` manifest hashing, all 24 file hashes and the aggregate SHA-256 on disk match `docs/medicloud/t08-handoff.md` and `docs/evidence/t08-test-report.md` identically:

- **Aggregate SHA-256:** `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc`
- **Verified canonical files (24/24):**
  - `astryx-themes.ts` (`6b749f62023922c069f19f7a5ebbc8aed06186969474a8251276f83f4071b407`)
  - `themes/medicloud/medicloud.settings.json` (`a8893529d04ef1fb9b7b495927b10a65fe557656c8155791706d3aac81e14f3f`)
  - `apps/patient-portal/styles/globals.css` (`44f05bae512541d5e11e9f571bd94ef01638369391c419a62d1d54f68ef8340f`)
  - `apps/patient-portal/app/layout.tsx` (`b61591c079de3ad80c911861f814f1065c966fd7f6dd4a5365a8b598ca8dc507`)
  - `apps/patient-portal/app/page.tsx` (`8b84efd141d4a45bc8d135493a112783da21384888cf893e1dfe39f40466e2d7`)
  - `apps/patient-portal/app/_lib/types.ts` (`8e740a30b14712ac7f34065e7ccd5dd159f67366970ec08b4696b7a7b81d3197`)
  - `apps/patient-portal/app/_lib/redacted-log.ts` (`5a1cb87cc6e537e1d57e9e7370f9b80450d6fcdbe7f3d2603735b1026180bbea`)
  - `apps/patient-portal/app/_lib/session.ts` (`ad2167b29f2936e6ba062a1cc5d3a71873fa68892f72a72568c427eab22b9dd1`)
  - `apps/patient-portal/app/_lib/bff-store.ts` (`6a6a6aacd71427a3ac72974dda07fde0edbdb710b211fea5187acc1bddc4e2af`)
  - `apps/patient-portal/app/_components/PortalThemeProvider.tsx` (`e5631f6798f9fb82ff8305075951c6b46ed0e9451486b0556ee409ae4e0b1f37`)
  - `apps/patient-portal/app/_components/portal-utils.ts` (`2e5246869933ff4167d1b30a3df46996740f7912da2b8963482e1f229129e057`)
  - `apps/patient-portal/app/_components/SessionGate.tsx` (`727b3c7e6b7404866df9aa16bba6ded34d3af1ed85f0aef7fabf316bad150e5d`)
  - `apps/patient-portal/app/_components/BookingWorkspace.tsx` (`0a7e3baba2c6d0f859ab37d0985f5178d84920a03c0456e4f2a1d4b4b768b93a`)
  - `apps/patient-portal/app/_components/AppointmentsWorkspace.tsx` (`812ce463765a2710d05c0e6d57fe7f708483f362e45823d540bf6487c7f09b33`)
  - `apps/patient-portal/app/_components/StaffDeskWorkspace.tsx` (`67dc7b9e4f7e4a26cfa2e73975aa07ad8137001ab69f598930341c05c1bae8bb`)
  - `apps/patient-portal/app/_components/PortalApp.tsx` (`d618e168d26a424ce1bebdcf9c0dabe38b7ea55da510e5decfca87508e84880a`)
  - `apps/patient-portal/app/api/bff/session/route.ts` (`66d00654fd69ed3608075762713172b4e44897e2e4a8cdbc8214aa8a5d817843`)
  - `apps/patient-portal/app/api/bff/catalog/route.ts` (`ca611da3c521076f943d9a09cb8d61ef5e8ac49c0db6307bc90b47fd608142b3`)
  - `apps/patient-portal/app/api/bff/slots/route.ts` (`c2fed47d164394791a36e71d4e463ed981723dcc85b6f7c87fe8109ebcf4d4dc`)
  - `apps/patient-portal/app/api/bff/appointments/route.ts` (`f182ce52a5a12cd4a7888c40ddb5019b25c7f2f69ee00ee03b876a097f1927c9`)
  - `apps/patient-portal/app/api/bff/appointments/[id]/route.ts` (`d2e4d17d420d737aa4405a3efa2413f46d512c25efa53a15fe1a599b960e26a1`)
  - `apps/patient-portal/app/api/bff/appointments/[id]/check-in/route.ts` (`6719d6aefa5bc78c0fa4764224be19ad2a6105545fb7165a1236d207caac6388`)
  - `tests/portal-bff.test.ts` (`bdb8e97558a90845455825469498ece5073e293e125210aaba891d30b87a29a2`)
  - `output/playwright/t08_browser_check.py` (`e6703a931004c788372caeac4d3f64b6dbd52a253b791745544e4e031b559efa`)

### 1.2 Screenshot Evidence & Boundary Integrity

- All 5 evidence screenshots in `docs/evidence/` match the hashes and byte counts in `docs/evidence/t08-test-report.md` (`t08-desktop.png` `4447ff64...` / `90535` B, `t08-tablet.png` `f3c4660b...` / `91701` B, `t08-mobile.png` `ab63ffaa...` / `73990` B, `t08-staff.png` `4e54e14e...` / `125697` B, `t08-degraded.png` `8c71d4b9...` / `152225` B).
- **Out-of-scope write boundary confirmed:** File modification timestamps across `apps/clinical-api/` (latest `2026-11-22T22:38:08+07:00`) and `packages/contracts/` (latest `2026-11-22T02:38:14+07:00`) predate T08 execution (`2026-11-23`), and all files modified during T08 remain inside the boundary approved by `T08-PORTAL-001`.

### 1.3 Read-Only Checks Observed During Review

- `npm test`: exit `0` (`7` files / `45` tests passed including `6/6` in `tests/portal-bff.test.ts`; `2` PostgreSQL integration suites / `20` tests skipped because `DATABASE_URL` is unset).
- `npx tsc --noEmit --incremental false`: exit `0`.
- `npm run lint`: exit `0` (`0` errors; pre-existing `Pages directory cannot be found` advisory only).
- `npm run contracts:validate`: exit `0`.
- `npm run astryx -- doctor --built apps/patient-portal`: exit `0` (`pass: 26, warn: 1, fail: 0, info: 10`; `665` Core props verified).
- Additional build and Playwright runtime execution were verified independently in `docs/evidence/t08-test-report.md` (`PASS`, `2026-11-23T01:02:05+07:00` – `2026-11-23T01:04:09+07:00`) and corroborated by inspecting `themes/medicloud/preview.png`, `themes/medicloud/preview-dark.png`, and all 5 `docs/evidence/t08-*.png` captures.

---

## 2. Review Findings

### 2.1 Astryx v0.7.17 Purity, Theme, and Component Props — `PASS`

- **Zero raw `<div>`/`<span>`, zero Tailwind/utility classes:** Static scanning and full file inspection across `apps/patient-portal/app/` and `apps/patient-portal/styles/globals.css` confirm zero `<div>`, zero `<span>`, and zero `className=` utility attributes. Only semantic HTML elements (`<html>`, `<body>`, `<search>`, `<form>`) appear alongside Astryx layout and UI primitives (`AppShell`, `TopNav`, `TopNavHeading`, `TabList`, `Tab`, `Section`, `VStack`, `HStack`, `List`, `ListItem`, `Table`, `Selector`, `SegmentedControl`, `SegmentedControlItem`, `Dialog`, `DialogHeader`, `Drawer`, `AlertDialog`, `Banner`, `Badge`, `StatusDot`, `Skeleton`, `EmptyState`, `TextInput`, `Button`, `Text`, `Heading`, `Icon`).
- **Token-only styling:** `apps/patient-portal/styles/globals.css` uses `@layer reset, astryx-base, astryx-theme, app;`, Astryx `--color-*`, `--spacing-*`, `--radius-*`, `--focus-outline-color`, and `--size-element-lg` variables, with zero raw `#hex` literals, zero `px` literals, and zero `:root` overrides.
- **Generated theme wiring:** `astryx-themes.ts` preserves its `@generated by astryx theme` header and record, wiring `@astryxdesign/theme-neutral` and `./src/themes/medicloud/medicloud.*` with `defaultThemeSlug = "medicloud"`. `themes/medicloud/medicloud.settings.json` configures healthcare palette dials (`accent: #0F766E`, `neutral: #475569`, `success: #15803D`, `warning: #B45309`, `danger: #B91C1C`, `info: #0369A1`), medium corners, both light/dark modes, and `--on top-nav-item` / `--on side-nav-item` selected states; rendered captures `themes/medicloud/preview.png` and `themes/medicloud/preview-dark.png` confirm visual contrast.
- **Valid props:** `astryx doctor` checked `665` Core props with `0` invalid props. `Button` components intentionally pair descriptive `label` props (accessible names) with concise `children` visible text where appropriate, matching the `@astryxdesign/core/Button` contract.

### 2.2 Conformance to `T08-PORTAL-001` Precedence Over the 4 Local Skills — `PASS`

- Precedence (`Project Owner -> CONSTITUTION.md -> Approved Decisions -> AGENTS.md (Astryx v0.7.17) -> .agents/skills/`) is respected: local skills reside strictly under `.agents/skills/{ui-ux-pro-max,hallmark,impeccable,taste-skill}` with zero Tailwind/raw-HTML/WebGL/photo-scraping leakage.
- **Operate mode & anti-slop floor:** Inspected code and all 5 PNG screenshots (`1440x900`, `768x1024`, `390x844`) confirm direct clinical scheduling utility (`Đặt lịch khám`, `Lịch hẹn & Tra cứu`, `Quầy tiếp nhận`) with Vietnamese `<html lang="vi">` copy, synthetic data only, tabular numbers (`hasTabularNumbers`), zero eyebrows/kickers, zero decorative step numbers, zero gradients, zero card-inside-card nesting, zero middle-dot (`·`) concatenated metadata, zero arrow glyphs (`->`/`→`) on buttons, and zero fake metrics.
- **Responsive table-to-list adaptation:** `BookingWorkspace.tsx`, `AppointmentsWorkspace.tsx`, and `StaffDeskWorkspace.tsx` switch cleanly between scrollable `Table` regions (`data-table-scroll-region`, `tabIndex={0}`) and compact `List`/`ListItem` rows below `768px` (`useMediaQuery('(max-width: 767px)')`), verified visually in `t08-desktop.png`, `t08-tablet.png`, and `t08-mobile.png`.
- **Blur/submit validation & AC-10 stale receipt clearing:**
  - `AppointmentsWorkspace.tsx` validates UUID format after blur when non-empty and enforces required input only on submit (preventing premature red errors on initial render), focusing the invalid field on failed submit.
  - `BookingWorkspace.tsx` validates `Idempotency-Key` (`/^[\\w-]{16,128}$/`) on blur/submit and clears `setReceipt(null)` whenever `handleConfirmBooking` encounters `status >= 500`, a network error, or a non-`normal` `simMode`, matching `t08-degraded.png` where both the page-level AC-10 `Banner` and modal `Banner` display `synthetic-ac10-e2e-check` without any false confirmation banner.

### 2.3 Next.js 15 / React 19 / TypeScript Correctness & BFF Contract Alignment — `PASS` (with non-blocking follow-up notes)

- **Next.js 15 dynamic `params`:** `apps/patient-portal/app/api/bff/appointments/[id]/route.ts` and `apps/patient-portal/app/api/bff/appointments/[id]/check-in/route.ts` both type `context: { params: Promise<{ id: string }> }` and `await context.params`.
- **Session & storage hygiene:** `apps/patient-portal/app/_lib/session.ts` signs `medicloud_demo_session` using HMAC-SHA256 and `timingSafeEqual`, sets `HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` (with `Secure` on HTTPS), and resolves tenant/role strictly from the server-side `PERSONA_MAP`. Static scan confirmed zero `localStorage`, `sessionStorage`, `document.cookie`, or `dangerouslySetInnerHTML` usage in `apps/patient-portal/app/`.
- **Error handling & zero dead controls:** All BFF routes catch malformed JSON (`400 invalid_json`), reject unknown fields (`400 unknown_field`), propagate `x-correlation-id`, and emit redacted structured logs via `redacted-log.ts`. All UI buttons, selectors, tabs, dialogs, drawers, and alert confirmations across all 5 components are wired to active handlers.
- **Synthetic BFF contract fidelity:** `bff-store.ts` aligns with `packages/contracts/openapi.json` and `apps/clinical-api/src/scheduling/service.ts` on header/body `Idempotency-Key` parity (`409 idempotency_key_mismatch`), SHA-256 booking fingerprint replay (`201` + `X-Idempotent-Replay: true`) and conflict (`409 idempotency_conflict`), capacity enforcement (`409 slot_capacity_exhausted`), disclosure-safe `404` on cross-tenant/non-owner appointment lookup, `403 role_action_denied` for `PATIENT` check-in, and idempotent `200` check-in for `RECEPTIONIST` (`403 resource_state_denied` on non-confirmed appointments).

#### Non-blocking Observations & Follow-Up Items (for T13 / Staging Readiness)

1. **Upstream mode gaps deferred beyond T08 synthetic scope (actionable before switching `CLINICAL_API_BASE_URL` on in T13):**
   - `bff-store.ts` (`callUpstream`, lines 289-292) uses a single environment `CLINICAL_API_BEARER_TOKEN` rather than per-user Keycloak OIDC session tokens; before enabling Upstream mode in staging/T13, the BFF must propagate server-validated user OIDC credentials per session.
   - `listAppointmentsForPortal` (`bff-store.ts`, lines 437-443) returns an empty `[]` stub when `CLINICAL_API_BASE_URL` is configured because `packages/contracts/openapi.json` does not yet define a `GET /v1/appointments` list endpoint (alongside the `PATIENT` `slot:read` permission and `/v1/specialties`, `/v1/doctors` routes already tracked in `docs/decisions/t08-backend-followup.md`).
   - `verifySessionCookieValue` (`session.ts`, lines 93-111) verifies HMAC integrity and `personaId` allowlist membership, relying on browser cookie `Max-Age=28800` without server-side `iat` expiration enforcement; live OIDC sessions in T13 must validate token `exp` server-side.
2. **Minor non-blocking code/hygiene notes:**
   - `bff-store.ts` validates `appointmentId` with `UUID_RE` but checks `doctorId` / `slot_id` / `patient_id` only as non-empty strings (whereas `openapi.json` specifies `format: "uuid"`). Also `checkInAppointmentForPortal` checks `session.role !== 'RECEPTIONIST'` (`403 role_action_denied`) before `record.status !== 'confirmed'` (`403 resource_state_denied`), reversing the order in `apps/clinical-api/src/security/authorization.ts` while still returning `403`.
   - `BookingWorkspace.tsx`: `loadCatalog` and `loadSlots` do not clear a previously displayed `receipt` banner on `>= 500` (unlike `handleConfirmBooking` and `simMode !== 'normal'`), and client `fetch` calls do not pass `AbortController` signals across rapid doctor/persona switches.
   - `app/api/bff/session/route.ts`: `POST` returns `400` responses without calling `logBffEvent`, unlike `appointments` and `check-in` routes.
   - `apps/patient-portal/styles/globals.css`: `[data-tabular-cell]` is unused because components use `<Text hasTabularNumbers>`.
   - `apps/patient-portal/app/layout.tsx:8`: HTML metadata `<title>` contains an em-dash (`MediCloud — Cổng Đặt Lịch & Tiếp Nhận P0`); visible page body copy has zero em-dashes.

---

## 3. Warning Dispositions

1. **`built-astryx-purity` `[warn]` (`apps/patient-portal/app/layout.tsx:4` imports `../styles/globals.css`):**
   - **Disposition: Accepted, non-blocking.** Directly inspected `apps/patient-portal/styles/globals.css`: it establishes `@layer reset, astryx-base, astryx-theme, app;` cascade ordering, token-backed focus/selection/scrollbar surface rules, coarse-pointer minimum touch targets (`var(--size-element-lg)`), `prefers-reduced-motion`, and frame/scroll-region tokens with zero raw `#hex`, zero `px`, zero `:root` overrides, and zero utility classes. Consistent with the accepted T01 pattern (`docs/reviews/t01-code-review.md`).
2. **Next.js flat-config ESLint `Pages directory cannot be found` advisory (and `next build` ESLint plugin notice recorded in `TestReport`):**
   - **Disposition: Accepted, non-blocking.** `eslint.config.mjs` explicitly loads `@next/eslint-plugin-next` in ESLint 9 flat config for `apps/patient-portal/**/*.{js,jsx,ts,tsx}` and `npm run lint` exits `0` with `0` errors. MediCloud uses the App Router without a `pages/` or `src/pages/` directory, so `no-html-link-for-pages` emits a benign advisory without failing lint or build.
3. **`button-actions` `[info]` note in `astryx doctor` (`Button actions - Not checked` due to `.agents/skills/impeccable/scripts/live-browser-dom.js`):**
   - **Disposition: Accepted, non-blocking.** `.agents/skills/impeccable/scripts/live-browser-dom.js` is a vendored third-party skill helper inside `.agents/skills/impeccable/` (installed locally under `T08-PORTAL-001`) and is neither imported nor executed by `apps/patient-portal/`. Direct code inspection confirmed every `<Button>` in `SessionGate`, `PortalApp`, `BookingWorkspace`, `AppointmentsWorkspace`, and `StaffDeskWorkspace` has an explicit React `onClick` or `type="submit"` handler, corroborated by interactive Playwright verification in `t08_browser_check.py`.

---

## 4. Independence

This Code Review was conducted in an independent session separate from both the T08 implementation owner and the independent `quality.tester` session. No source, theme, config, test, script, handoff, `TestReport`, screenshot, or `docs/medicloud/tasks.md` file was edited during this review.

---

## 5. Explicit Limitations & Non-Claims

- This review covers the **local T08 UI/BFF implementation, synthetic automated tests, Astryx compliance, and local Playwright captures only** (`CLINICAL_API_BASE_URL` unset; `DATABASE_URL` unset with 2 PostgreSQL integration files / 20 tests skipped).
- Live Keycloak JWKS login, live OpenStack PostgreSQL / `apps/clinical-api` HTTP integration, GCP Cloud Run deployment, and backend follow-up changes (`docs/decisions/t08-backend-followup.md` plus `GET /v1/appointments` and per-session OIDC token propagation) were **not** executed or approved as production-ready.
- This approval makes **no claim** of production deployment, multi-cloud runtime behavior, measured latency/throughput/SLA/RPO/RTO performance, legal/regulatory compliance, or clinical safety.
- Separate `Security/Privacy` and `Evidence` gate reviews remain required before advancing T08 past `READY_FOR_TEST`.
