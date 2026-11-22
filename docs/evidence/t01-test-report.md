# TestReport: T01

**Status:** PASS
**Task:** T01 Next.js/React 19/Astryx foundation
**Tester:** Independent retest session
**Retest timestamp:** 2026-11-21 16:51:35 to 16:54:14 (+07:00), Asia/Saigon
**Environment:** Windows PowerShell, Node.js v24.16.0, npm 12.2.0, Corepack pnpm 10.22.0, Python 3.12.0, Playwright Python API
**Project:** `D:\\hoapuiii\\Code\\MediCloud`
**Data classification:** Synthetic only; no patient data was accessed.

## Required commands

| Check | Exit code | Result | Evidence |
|---|---:|---|---|
| `npm test` | 0 | PASS | Vitest: 2 files, 11/11 tests passed |
| `npm run typecheck` | 0 | PASS | `tsc --noEmit` completed |
| `npm run lint` | 0 | PASS | ESLint completed; emitted a non-failing Pages-directory advisory |
| `npm run build` | 0 | PASS | Next.js 15.5.29 production build completed; `/` prerendered |
| `function pnpm { corepack pnpm @args }; pnpm exec astryx doctor --built apps/patient-portal` | 0 | PASS WITH WARNING | Astryx: 27 pass, 9 info, 1 warning, 0 fail |

The Astryx warning is `built-astryx-purity`: `apps/patient-portal/app/layout.tsx` imports `../styles/globals.css`. It is explicitly recorded as a warning; it did not produce a doctor failure and no source/config file was changed during this retest.

## Browser validation

The tester started `npm run dev`, verified `http://localhost:3000`, ran the exact requested Python here-string approach with `PORT=3000`, and stopped the server after verification.

| Viewport | Result | Assertions | Screenshot |
|---|---|---|---|
| Desktop 1440x900 | PASS | Title contains `MediCloud`; `Foundation check` heading visible; `Foundation checks` visible; `scrollWidth=1440 <= clientWidth=1440`; tab loop found focus 7 times | [t01-desktop.png](t01-desktop.png) |
| Mobile 390x844 | PASS | Title contains `MediCloud`; `Foundation check` heading visible; `Foundation checks` visible; `scrollWidth=390 <= clientWidth=390`; tab loop found focus 7 times | [t01-mobile.png](t01-mobile.png) |

The exact assertion script exited `0` and printed:

```text
desktop PASS 7 1440 1440
mobile PASS 7 390 390
```

Screenshots were captured at `docs/evidence/t01-desktop.png` and `docs/evidence/t01-mobile.png`.

## Scope and independence

- Only this TestReport and the two requested evidence screenshots were written during this retest.
- No source, configuration, task, handoff, or implementation file was modified.
- The dev server was stopped after the checks.
- No production, multi-cloud, security, performance, or clinical-safety claim is made by this report.

## Conclusion

T01 is **PASS** for the requested independent tester gate and may transition to `TEST_PASSED`, subject to the separate code-review and evidence gates required by the Constitution. The single Astryx purity warning remains visible for reviewer disposition but is not a failed check.
