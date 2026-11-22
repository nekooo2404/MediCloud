# T08 Implementation Handoff

**Task:** T08 — Patient and Staff Portal flows using Astryx components, custom `medicloud` theme, and 4 local design skills  
**Decision:** `T08-PORTAL-001` — `APPROVED` (`docs/decisions/t08-portal-skills-approval.md`)  
**Status:** `TEST_PASSED` (All 4 independent gates passed for canonical 24-file aggregate SHA-256 `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc` within T08's local synthetic BFF scope)  
**Accountable owner:** Project owner  
**Implementation owner:** Coding agent  
**Independent tester:** `t08_quality_tester` (`f84da8f5-9d73-47cb-9a95-b8ce7c80e77e`), separate from implementation  
**Canonical 24-file diff fingerprint (SHA-256):** `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc`  
**Data classification:** Synthetic data only. No real PHI/PII, credentials, bearer tokens, or patient-record content.

## Canonical 24-file source manifest & SHA-256 fingerprints

Canonical manifest uses `path=lowercase_sha256` lines joined by `\n` in the order below, with the aggregate SHA-256 calculated over the UTF-8 manifest string:

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

## Evidence screenshots (recorded independently by `quality.tester`)

- `docs/evidence/t08-desktop.png` (`4447ff64dcb7d0769c93faed9db404ff683142912aaa0bd2bb13d472a69a75a3`, `90535` bytes)
- `docs/evidence/t08-tablet.png` (`f3c4660b0256cd54839f5a1f964bf41fc0e5fad2efee5ce84e318ac9a46be42f`, `91701` bytes)
- `docs/evidence/t08-mobile.png` (`ab63ffaa8050e7c8262438533a1b0d62be487b0fd40a921e3f20922323971c73`, `73990` bytes)
- `docs/evidence/t08-staff.png` (`4e54e14e2f08fdbeea7af28228cca1f4e2ec3e1449d1d027206a4c611a0a49fd`, `125697` bytes)
- `docs/evidence/t08-degraded.png` (`8c71d4b9eb5d8de4c092075877841962c424b78862d7e34626bdf90582c80977`, `152225` bytes)

Additional created/updated artifacts inside allowed paths:
- `.agents/skills/{ui-ux-pro-max,hallmark,impeccable,taste-skill}/` + `.agents/skills/README.md`
- `src/themes/medicloud/*` and generated build outputs in `themes/medicloud/*`
- `docs/decisions/t08-portal-skills-approval.md` (`APPROVED`)
- `docs/decisions/t08-backend-followup.md` (`PROPOSED`)
- `docs/medicloud/t08-design-system.md`
- `docs/evidence/t08-test-report.md` (`PASS`)
- `docs/reviews/t08-code-review.md` (`APPROVE`)
- `docs/reviews/t08-security-privacy-review.md` (`APPROVE`)
- `docs/reviews/t08-evidence-review.md` (`APPROVE`)
- `docs/medicloud/tasks.md` (`T08` transitioned to `TEST_PASSED`)

`apps/clinical-api/` and `packages/contracts/` were **not modified**.

## Delivered behavior & acceptance mapping

| Criterion / Requirement | Delivered implementation | Verification evidence |
|---|---|---|
| AC-02 (Patient slot lookup & booking) | Vietnamese patient booking workspace with specialty/doctor `<search>` filters, tabular slot list / responsive mobile `List`, transactional booking `Dialog`, and verified confirmation `Banner` | `tests/portal-bff.test.ts` + `docs/evidence/t08-desktop.png`, `t08-tablet.png`, `t08-mobile.png` |
| AC-04 (`Idempotency-Key` safety) | Client + BFF enforce header/body `Idempotency-Key` match (`409 idempotency_key_mismatch`), replay (`X-Idempotent-Replay: true`) without extra capacity decrement, and `409 idempotency_conflict` on slot mismatch | `tests/portal-bff.test.ts` |
| AC-05 & T04/T05 RBAC/tenant isolation | Signed HMAC-SHA256 `HttpOnly` `SameSite=Lax` cookie (`medicloud_demo_session`), zero Web Storage tokens, disclosure-safe `404` on cross-tenant/other-patient lookup, `403` for `PATIENT` check-in, idempotent `200` check-in for `RECEPTIONIST`, `403` on cancelled appointments | `tests/portal-bff.test.ts` + `docs/evidence/t08-staff.png` + `t08_browser_check.py` |
| AC-10 (Degraded / timeout integrity) | Upstream `AbortSignal.timeout` + synthetic `degraded` mode both return `503 private_boundary_degraded` with `correlation_id`, clear stale receipts, and surface assertive error `Banner` without false confirmation | `tests/portal-bff.test.ts` + `docs/evidence/t08-degraded.png` |
| NFR UI / Accessibility / Astryx & 4 Skills | Custom Astryx `medicloud` theme (`#0F766E` accent, `#475569` slate neutral, bundled `Figtree` Vietnamese `.woff2`), zero raw `<div>`/`<span>`, `Skeleton` loading, `EmptyState`, `Drawer` detail inspector, keyboard `Tab` focus traversal, blur/submit validation (`validate-input-after-interaction`) | `npm run astryx -- doctor --built apps/patient-portal` + `t08_browser_check.py` |

## Commands run (after final edit)

| Command | Result | Notes |
|---|---|---|
| `npm test` | PASS (exit 0) | 7 test files passed (`45` tests passed, including `6/6` in `tests/portal-bff.test.ts`); 2 DB integration files (`20` tests) skipped because `DATABASE_URL` is unset |
| `npm run typecheck` | PASS (exit 0) | `tsc --noEmit` |
| `npm run lint` | PASS (exit 0) | ESLint passed with 0 errors (pre-existing Next.js Pages-directory advisory only) |
| `npm run contracts:validate` | PASS (exit 0) | OpenAPI, event schemas, policy & rejection fixtures |
| `npm run build` | PASS (exit 0) | `next build apps/patient-portal` |
| `npm run astryx -- doctor --built apps/patient-portal` | PASS WITH WARNING (exit 0) | `26 pass, 1 warn, 0 fail, 10 info` |
| `python output/playwright/t08_browser_check.py` | PASS (exit 0) | `1440x900`, `768x1024`, `390x844`; zero console/page/unexpected HTTP errors; zero horizontal overflow |

## Reviewed warnings & doctor notes

- `built-astryx-purity` warning (`app/layout.tsx:4 imports ../styles/globals.css`): pre-existing accepted non-blocking T01 pattern providing `@layer` cascade ordering, browser surface tokens (`::selection`, `caret-color`, `scrollbar-color`), `:focus-visible`, coarse-pointer minimum touch targets, and `prefers-reduced-motion` without raw `#hex` or `px` values.
- `button-actions` `[info]` note: `astryx doctor` skipped its static button-action scan because `.agents/skills/impeccable/scripts/live-browser-dom.js` exists inside the vendored third-party skill directory.

## Not run & explicit non-claims

- Live Keycloak JWKS login, live OpenStack PostgreSQL/Clinical API integration from the Portal BFF, and GCP Cloud Run deployment were **not** executed (`CLINICAL_API_BASE_URL` unset; local synthetic BFF mode verified instead).
- Backend follow-up gaps (`PATIENT` `slot:read` permission and `/v1/specialties`, `/v1/doctors` routes in `clinical-api`) remain tracked in `docs/decisions/t08-backend-followup.md`.
- No claim of production deployment, measured latency/SLA performance, legal compliance, or clinical safety is made.

## Independent gates

All four independent gates reviewed and verified canonical 24-file aggregate SHA-256 `2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc` with zero source edits after handoff:

- **Tester (`quality.tester`):** `PASS` (`docs/evidence/t08-test-report.md`, session `f84da8f5-9d73-47cb-9a95-b8ce7c80e77e`). Independently executed `npm test` (`7` files / `45` passed; `2` DB files / `20` skipped), `typecheck`, `lint`, `contracts:validate`, `build`, `astryx doctor --built apps/patient-portal`, `t08_browser_check.py`, and read-only Web Storage / `401` verification.
- **Code Review:** `APPROVE` (`docs/reviews/t08-code-review.md`, session `4cc3dec8-ceb6-4ba5-a024-2d6828e07803`). Verified Astryx purity, `medicloud` theme, 4-skill conformance, warning dispositions, and React/Next.js 15 correctness. Non-blocking pre-staging/T13 follow-ups documented.
- **Security/Privacy Review:** `APPROVE` (`docs/reviews/t08-security-privacy-review.md`, session `5035b762-8d12-4982-a15e-d65ea50aaad7`). Verified HMAC-SHA256 `HttpOnly` `SameSite=Lax` cookies, zero Web Storage tokens, RBAC/tenant isolation (`401`/`403`/`404`), `Idempotency-Key` checks, AC-10 fail-closed `503`, redacted logs, and `.agents/skills/` boundary hygiene. Non-blocking hardening notes documented for `T13`.
- **Evidence Review:** `APPROVE` (`docs/reviews/t08-evidence-review.md`, session `563a9149-e7b5-4a13-9896-75974fb62e49`). Independently recomputed all 24 canonical source hashes and 5 screenshot hashes and confirmed cross-artifact consistency, timestamps, independence, and non-claims.

T08 is now **`TEST_PASSED`** within its approved local synthetic BFF scope. No deployment, production readiness, measured performance, legal compliance, or clinical-safety claim is made.
