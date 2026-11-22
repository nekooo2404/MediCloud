# T08 Independent Test Report

**Task:** T08 — Patient and Staff Portal flows using Astryx components, custom `medicloud` theme, and 4 local design skills  
**Decision:** `T08-PORTAL-001` — `APPROVED` (`docs/decisions/t08-portal-skills-approval.md`)  
**Handoff:** `docs/medicloud/t08-handoff.md` (`READY_FOR_TEST`)  
**Tester:** `Independent quality.tester session`  
**Status:** `PASS` for canonical 24-file aggregate SHA-256 `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc` (within approved T08 local synthetic BFF scope)  
**Test date (+07:00):** `2026-11-23` (`2026-11-23T01:02:05+07:00` – `2026-11-23T01:04:09+07:00`)  
**Data classification:** Synthetic data only; no real PHI/PII, credentials, bearer tokens, private keys, or patient-record content.

## Environment and boundary checks

- **Workspace root:** `d:\hoapuiii\Code\MediCloud` (Windows 11 local workspace)
- **Runtime:** Node `v24.16.0`; npm `12.2.0`; Corepack pnpm `10.22.0`; Python `3.12.0`; Playwright (Python) `1.60.0`; Next.js `15.5.29`; `@astryxdesign/core` & `@astryxdesign/cli` `v0.7.17`
- **BFF / DB environment:** `CLINICAL_API_BASE_URL` unset (Synthetic Local BFF mode active by default); `DATABASE_URL` unset (PostgreSQL integration test suites skipped as expected)
- **Out-of-scope write boundary check (`git status --short -- apps/clinical-api packages/contracts`):** Both directories appear as untracked (`??`) relative to the parent Git root (`D:/hoapuiii`). Independent file timestamp and hash inspection verified zero files in `apps/clinical-api/` or `packages/contracts/` were modified after `2026-11-22T23:57:00+07:00` (prior to T08 start on `2026-11-23T00:23:08+07:00`), and T06 baseline hashes in `apps/clinical-api/` match `docs/evidence/t06-test-report.md` (`policy-gateway.ts` `a3388300...`, `schema.prisma` `c957a974...`, migrations `b7266a20...`, `ea6567a5...`). Zero T08 edits occurred in `apps/clinical-api/` or `packages/contracts/`.
- **Manifest integrity:** Recomputed all 24 canonical paths directly from disk via PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath` (resolving `[id]` dynamic route files accurately), joined by LF (`\n`), UTF-8 without BOM. Aggregate SHA-256 `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc` matches `docs/medicloud/t08-handoff.md` identically.

## Independent commands and assertions run

| Command / Check | Start (`+07:00`) | End (`+07:00`) | Exit | Observed Output & Counts |
|---|---|---|---|---|
| `npm test` | `2026-11-23T01:02:57+07:00` | `2026-11-23T01:02:59+07:00` | `0` | Vitest `v3.2.7`: `7` files passed (`45` tests passed, including `6/6` in `tests/portal-bff.test.ts`); `2` DB integration files skipped (`20` tests skipped: `tests/outbox.integration.test.ts` `10`, `tests/scheduling.integration.test.ts` `10` because `DATABASE_URL` is unset). |
| `npm run typecheck` | `2026-11-23T01:03:00+07:00` | `2026-11-23T01:03:01+07:00` | `0` | `tsc --noEmit` completed with `0` errors. |
| `npm run lint` | `2026-11-23T01:03:03+07:00` | `2026-11-23T01:03:04+07:00` | `0` | `eslint tools/medicloud-agent-company/src apps/patient-portal/app apps/patient-portal/next.config.ts` passed with `0` errors (pre-existing `Pages directory cannot be found` advisory for `no-html-link-for-pages`). |
| `npm run contracts:validate` | `2026-11-23T01:03:05+07:00` | `2026-11-23T01:03:05+07:00` | `0` | `node packages/contracts/validate.mjs`: `T02 contract validation passed: OpenAPI, event schema, policy and rejection fixtures.` |
| `npm run build` | `2026-11-23T01:03:10+07:00` | `2026-11-23T01:03:24+07:00` | `0` | `next build apps/patient-portal` (Next.js `15.5.29`): compiled in `3.7s`, generated `7/7` static pages; built `/`, `/_not-found`, and `6` `/api/bff/*` dynamic routes; pre-existing ESLint plugin migration notice printed. |
| `npm run astryx -- doctor --built apps/patient-portal` | `2026-11-23T01:03:30+07:00` | `2026-11-23T01:03:35+07:00` | `0` | `pass: 26, warn: 1, fail: 0, info: 10` (`built-astryx-usage`: `20` source files and `73` built files read, `78` imports from `@astryxdesign/core` in `7` files, `260` component uses; `core-props`: `665` props read). |
| `python output/playwright/t08_browser_check.py` | `2026-11-23T01:03:40+07:00` | `2026-11-23T01:03:48+07:00` | `0` | `T08 BROWSER PASS unauth_tabs=5 tablet_tabs=6 mobile_tabs=5 console_errors=0 unexpected_http_errors=0`; refreshed all `5` screenshots (`1440x900`, `768x1024`, `390x844`) with zero horizontal overflow and zero uncaught page errors. |
| Independent read-only Python/Playwright storage & `401` check (against ephemeral `next start apps/patient-portal` terminated cleanly in `finally`) | `2026-11-23T01:04:00+07:00` | `2026-11-23T01:04:02+07:00` | `0` | Confirmed `GET /api/bff/catalog` returns `401` unauthenticated (`urllib` HTTP `401` & browser `fetch` `401`). After clicking `Đăng nhập Bệnh nhân mẫu #1`: `localStorage.length === 0`, `sessionStorage.length === 0`, `medicloud_demo_session` absent from `document.cookie`, `context.cookies()` shows `httpOnly: true`, `sameSite: "Lax"`, and authenticated `GET /api/bff/catalog` returns `200`. |

## Acceptance coverage

| Criterion / Requirement | Result | Observed Verification Evidence |
|---|---|---|
| **AC-02** (Patient slot lookup & booking — local synthetic BFF scope) | `PASS` (local synthetic scope) | `tests/portal-bff.test.ts` verifies authenticated slot listing, capacity decrement (`2 -> 1`), and `201 confirmed` appointment creation; `t08_browser_check.py` and screenshots `t08-desktop.png`, `t08-tablet.png`, `t08-mobile.png` verify Vietnamese patient booking flow, confirmation banner with synthetic `Mã đối chiếu:`, and remaining capacity update (`2/3 -> 1/3`). Live GCP-to-OpenStack DB persistence is not covered here. |
| **AC-04** (`Idempotency-Key` safety — local synthetic BFF scope) | `PASS` (local synthetic scope) | `tests/portal-bff.test.ts` verifies same-payload `Idempotency-Key` replay returns `201` with `X-Idempotent-Replay: true` and identical `id` without extra capacity decrement, mismatched `slot_id` with reused key returns `409 idempotency_conflict`, exhausted slot returns `409 slot_capacity_exhausted`, and unknown field (`channel`) returns `400 unknown_field`. |
| **AC-05 & T04/T05 RBAC / tenant / session boundaries** (local synthetic BFF scope) | `PASS` (local synthetic scope) | `tests/portal-bff.test.ts` + independent Playwright check verify: unauthenticated `GET /api/bff/slots` and `GET /api/bff/catalog` return `401`; tampered session cookie returns `401`; cross-tenant (`UUID_APPT_TENANT_B`) and other-patient (`UUID_APPT_OTHER_SAME_TENANT`) reads return disclosure-safe `404`; `PATIENT` check-in returns `403 role_action_denied`; `RECEPTIONIST` check-in returns idempotent `200` preserving `checked_in_at`; cancelled appointment check-in returns `403 resource_state_denied`; `t08-staff.png` verifies staff queue check-in and cross-tenant 404 lookup tested in `t08_browser_check.py`; `localStorage.length === 0`, `sessionStorage.length === 0`, and `medicloud_demo_session` cookie is `HttpOnly` + `SameSite=Lax`. |
| **AC-10** (Degraded / timeout integrity) | `PASS` | `tests/portal-bff.test.ts` verifies both synthetic `x-medicloud-sim: degraded` (`503 private_boundary_degraded`, unchanged appointment list) and local slow-HTTP upstream server with `CLINICAL_API_TIMEOUT_MS=30` (`503 private_boundary_degraded`). `t08_browser_check.py` + `t08-degraded.png` verify modal and top-level AC-10 error banners display correlation ID `synthetic-ac10-e2e-check` without displaying false booking confirmation, and recovery restores slot listing. |
| **NFRs** (UI, accessibility, Astryx compliance, redacted logs) | `PASS` (with pre-existing `globals.css` warning) | `npm run astryx -- doctor --built apps/patient-portal` passes (`26 pass, 1 warn, 0 fail, 10 info`); `t08_browser_check.py` passes keyboard `Tab` focus checks (`unauth_tabs=5`, `tablet_tabs=6`, `mobile_tabs=5`), zero horizontal overflow at `1440x900`, `768x1024`, and `390x844`, responsive mobile `List` replacement for wide table at `390px`, empty state simulation, and zero console/page/unexpected HTTP errors; `tests/portal-bff.test.ts` verifies redacted BFF log schema without `Bearer` or `cookie`. |

## Reviewed warnings & doctor notes

- **`built-astryx-purity` `[warn]`** (`apps/patient-portal/app/layout.tsx:4` imports `../styles/globals.css`): Pre-existing accepted non-blocking T01 pattern providing `@layer` cascade ordering, browser surface rules (`::selection`, `caret-color`, `scrollbar-color`), `:focus-visible`, coarse-pointer minimum touch targets, and `prefers-reduced-motion` without raw `#hex` or `px` literals.
- **`button-actions` `[info]`**: `astryx doctor` skipped static button-action analysis because `.agents/skills/impeccable/scripts/live-browser-dom.js` exists inside the vendored third-party skill directory.
- **ESLint / Next.js advisories**: Pre-existing `Pages directory cannot be found` advisory from `no-html-link-for-pages` during `npm run lint`, and `The Next.js plugin was not detected in your ESLint configuration` advisory during `npm run build`.

## Canonical 24-file source manifest & SHA-256

Canonical manifest uses `path=lowercase_sha256` lines joined by `\n` (UTF-8 without BOM):

**Aggregate SHA-256:** `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc`

| Path | SHA-256 |
|---|---|
| `astryx-themes.ts` | `6b749f62023922c069f19f7a5ebbc8aed06186969474a8251276f83f4071b407` |
| `themes/medicloud/medicloud.settings.json` | `a8893529d04ef1fb9b7b495927b10a65fe557656c8155791706d3aac81e14f3f` |
| `apps/patient-portal/styles/globals.css` | `44f05bae512541d5e11e9f571bd94ef01638369391c419a62d1d54f68ef8340f` |
| `apps/patient-portal/app/layout.tsx` | `b61591c079de3ad80c911861f814f1065c966fd7f6dd4a5365a8b598ca8dc507` |
| `apps/patient-portal/app/page.tsx` | `8b84efd141d4a45bc8d135493a112783da21384888cf893e1dfe39f40466e2d7` |
| `apps/patient-portal/app/_lib/types.ts` | `8e740a30b14712ac7f34065e7ccd5dd159f67366970ec08b4696b7a7b81d3197` |
| `apps/patient-portal/app/_lib/redacted-log.ts` | `5a1cb87cc6e537e1d57e9e7370f9b80450d6fcdbe7f3d2603735b1026180bbea` |
| `apps/patient-portal/app/_lib/session.ts` | `ad2167b29f2936e6ba062a1cc5d3a71873fa68892f72a72568c427eab22b9dd1` |
| `apps/patient-portal/app/_lib/bff-store.ts` | `6a6a6aacd71427a3ac72974dda07fde0edbdb710b211fea5187acc1bddc4e2af` |
| `apps/patient-portal/app/_components/PortalThemeProvider.tsx` | `e5631f6798f9fb82ff8305075951c6b46ed0e9451486b0556ee409ae4e0b1f37` |
| `apps/patient-portal/app/_components/portal-utils.ts` | `2e5246869933ff4167d1b30a3df46996740f7912da2b8963482e1f229129e057` |
| `apps/patient-portal/app/_components/SessionGate.tsx` | `727b3c7e6b7404866df9aa16bba6ded34d3af1ed85f0aef7fabf316bad150e5d` |
| `apps/patient-portal/app/_components/BookingWorkspace.tsx` | `0a7e3baba2c6d0f859ab37d0985f5178d84920a03c0456e4f2a1d4b4b768b93a` |
| `apps/patient-portal/app/_components/AppointmentsWorkspace.tsx` | `812ce463765a2710d05c0e6d57fe7f708483f362e45823d540bf6487c7f09b33` |
| `apps/patient-portal/app/_components/StaffDeskWorkspace.tsx` | `67dc7b9e4f7e4a26cfa2e73975aa07ad8137001ab69f598930341c05c1bae8bb` |
| `apps/patient-portal/app/_components/PortalApp.tsx` | `d618e168d26a424ce1bebdcf9c0dabe38b7ea55da510e5decfca87508e84880a` |
| `apps/patient-portal/app/api/bff/session/route.ts` | `66d00654fd69ed3608075762713172b4e44897e2e4a8cdbc8214aa8a5d817843` |
| `apps/patient-portal/app/api/bff/catalog/route.ts` | `ca611da3c521076f943d9a09cb8d61ef5e8ac49c0db6307bc90b47fd608142b3` |
| `apps/patient-portal/app/api/bff/slots/route.ts` | `c2fed47d164394791a36e71d4e463ed981723dcc85b6f7c87fe8109ebcf4d4dc` |
| `apps/patient-portal/app/api/bff/appointments/route.ts` | `f182ce52a5a12cd4a7888c40ddb5019b25c7f2f69ee00ee03b876a097f1927c9` |
| `apps/patient-portal/app/api/bff/appointments/[id]/route.ts` | `d2e4d17d420d737aa4405a3efa2413f46d512c25efa53a15fe1a599b960e26a1` |
| `apps/patient-portal/app/api/bff/appointments/[id]/check-in/route.ts` | `6719d6aefa5bc78c0fa4764224be19ad2a6105545fb7165a1236d207caac6388` |
| `tests/portal-bff.test.ts` | `bdb8e97558a90845455825469498ece5073e293e125210aaba891d30b87a29a2` |
| `output/playwright/t08_browser_check.py` | `e6703a931004c788372caeac4d3f64b6dbd52a253b791745544e4e031b559efa` |

## Refreshed evidence screenshots & visual inspection

All 5 screenshots were freshly captured by `python output/playwright/t08_browser_check.py` on `2026-11-23T01:03:42+07:00`–`01:03:48+07:00` and directly inspected:

| Artifact | SHA-256 | Size (bytes) | Visual Inspection Notes |
|---|---|---|---|
| `docs/evidence/t08-desktop.png` | `4447ff64dcb7d0769c93faed9db404ff683142912aaa0bd2bb13d472a69a75a3` | `90535` | `1440x900` patient booking workspace (`Bệnh nhân mẫu #1`, `Vai trò: Bệnh nhân`): crisp Vietnamese Figtree typography, teal primary CTAs, 3 slot rows (`2/3`, `1/2`, `0/1` disabled `Hết chỗ`), synthetic P0 disclaimer footer, zero clipping or overlap. |
| `docs/evidence/t08-tablet.png` | `f3c4660b0256cd54839f5a1f964bf41fc0e5fad2efee5ce84e318ac9a46be42f` | `91701` | `768x1024` booking table after persona switch (`Lễ tân quầy tiếp nhận A`, `Vai trò: Lễ tân`) and prior booking (`08:30 24/11/2026` capacity decremented to `1 / 3`): header, filter bar, 5-column table, and footer wrap cleanly with zero horizontal overflow. |
| `docs/evidence/t08-mobile.png` | `ab63ffaa8050e7c8262438533a1b0d62be487b0fd40a921e3f20922323971c73` | `73990` | `390x844` mobile layout: filter controls stack vertically, wide table switches to compact `List` items (`08:30`, `09:30`, `10:30` disabled `Hết chỗ`), tab bar shows scroll chevron, zero horizontal overflow or button clipping. |
| `docs/evidence/t08-staff.png` | `4e54e14e2f08fdbeea7af28228cca1f4e2ec3e1449d1d027206a4c611a0a49fd` | `125697` | `1440x900` `Quầy tiếp nhận` (`Staff Check-In`) view: green confirmation banner with synthetic ID & correlation ID `synthetic-portal-c00e7d11-f3f`, filter chips (`Tất cả`, `Chờ tiếp nhận`, `Đã tiếp nhận`), idempotent repeat buttons (`Kiểm tra lại (Idempotent)`), and disabled action on cancelled row (`Đã huỷ`). |
| `docs/evidence/t08-degraded.png` | `8c71d4b9eb5d8de4c092075877841962c424b78862d7e34626bdf90582c80977` | `152225` | `1440x900` AC-10 degraded alert over open booking modal: top banner (`Cảnh báo AC-10: Gián đoạn kết nối ranh giới lâm sàng nội bộ`) and in-dialog error banner (`Gián đoạn ranh giới lâm sàng: chưa đặt lịch`) both display `synthetic-ac10-e2e-check` while preserving `Idempotency-Key` and showing zero false booking confirmation. |

## Explicit non-claims & limitations

- This report covers **local synthetic verification only** (`CLINICAL_API_BASE_URL` unset; `DATABASE_URL` unset so 2 PostgreSQL integration files / 20 tests were skipped).
- Live Keycloak JWKS authentication, live OpenStack PostgreSQL / `apps/clinical-api` HTTP round-trips from the Portal BFF, GCP Cloud Run deployment, and backend follow-up items tracked in `docs/decisions/t08-backend-followup.md` (`PATIENT` `slot:read` permission and `/v1/specialties`, `/v1/doctors` routes) were **not** exercised or modified in T08.
- This report makes **no claim** of production deployment, measured latency/throughput/SLA/RPO/RTO performance, legal or regulatory compliance, or clinical safety.
- Independent `Code Review`, `Security/Privacy`, and `Evidence` gate approvals remain required after this `TestReport` before advancing T08 beyond `READY_FOR_TEST`.
