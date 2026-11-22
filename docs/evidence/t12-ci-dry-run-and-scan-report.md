# T12 CI Dry-Run and Security Scan Report

**Task:** T12 — CI Quality, Dependency/Secret Scan, and Immutable Image Build  
**Decision:** `T12-CI-001` (`APPROVED` in [docs/decisions/t12-ci-policy-approval.md](../decisions/t12-ci-policy-approval.md))  
**Canonical 9-File Aggregate SHA-256 (Cycle 2):** `066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`  
**Execution Timestamp (+07:00):** `2026-11-23T02:50:51+07:00` – `2026-11-23T02:51:30+07:00`  
**Environment:** Windows 11 local workspace (`Node v24.16.0`, `pnpm 10.22.0`, `npm 12.2.0`; `DATABASE_URL` unset; local Docker Desktop daemon stopped).

## 1. Local CI Dry-Run Pipeline (`npm run ci:dry-run`)

Executed `npm run ci:dry-run` (`node .github/scripts/ci-dry-run.mjs`, exit `0`, zero `DEP0190` warnings):

| # | Stage | Command | Start (UTC) | End (UTC) | Exit | Status |
|---|---|---|---|---|---|---|
| 1 | `contracts:validate` | `npm run contracts:validate` | `2026-11-22T19:51:02.573Z` | `2026-11-22T19:51:02.809Z` | `0` | `PASS` |
| 2 | `ci:scan:secrets` | `npm run ci:scan:secrets` | `2026-11-22T19:51:02.809Z` | `2026-11-22T19:51:03.028Z` | `0` | `PASS` |
| 3 | `ci:scan:deps` | `npm run ci:scan:deps` | `2026-11-22T19:51:03.028Z` | `2026-11-22T19:51:03.274Z` | `0` | `PASS` |
| 4 | `ci:verify-images` | `npm run ci:verify-images` | `2026-11-22T19:51:03.274Z` | `2026-11-22T19:51:03.486Z` | `0` | `PASS` |
| 5 | `ci:test` | `npm run ci:test` | `2026-11-22T19:51:03.486Z` | `2026-11-22T19:51:04.267Z` | `0` | `PASS` |
| 6 | `typecheck` | `npm run typecheck` | `2026-11-22T19:51:04.267Z` | `2026-11-22T19:51:05.429Z` | `0` | `PASS` |
| 7 | `lint` | `npm run lint` | `2026-11-22T19:51:05.429Z` | `2026-11-22T19:51:06.278Z` | `0` | `PASS` |
| 8 | `ci:lint:all` | `npm run ci:lint:all` | `2026-11-22T19:51:06.278Z` | `2026-11-22T19:51:07.363Z` | `0` | `PASS` |
| 9 | `test` | `npm test` | `2026-11-22T19:51:07.363Z` | `2026-11-22T19:51:08.725Z` | `0` | `PASS` |
| 10 | `build` | `npm run build` | `2026-11-22T19:51:08.725Z` | `2026-11-22T19:51:26.045Z` | `0` | `PASS` |
| 11 | `astryx:doctor` | `npm run astryx -- doctor --built apps/patient-portal` | `2026-11-22T19:51:26.045Z` | `2026-11-22T19:51:30.491Z` | `0` | `PASS` |

## 2. Observed Security, Supply-Chain, Image Policy & Policy Test Outputs

- **`npm run ci:scan:secrets` (`exit 0`):** `files_discovered: 186`, `files_scanned: 169`, `secret_findings_count: 0`, `phi_policy_violations_count: 0`, `status: "PASS"`. Enforces balanced `<placeholder>` checks, `ENCRYPTED PRIVATE KEY` detection, non-localhost DB password enforcement, and recursive `docs/evidence/*.json` scanning.
- **`npm run ci:scan:deps` (`exit 0`):** `package_manager: "pnpm@10.22.0"`, `direct_dependencies: 13`, `dev_dependencies: 10`, `locked_packages_checked: 450`, `locked_snapshots_checked: 450`, `unpinned_or_untrusted_specs: 0`, `lockfile_drift: 0`, `missing_integrity_hashes: 0` (strict `sha512-`), `blocked_packages: 0`, `status: "PASS"`.
- **`npm run ci:verify-images` (`exit 0`):** `dockerfiles_verified: 2`, `workflow_verified: true`, `mutable_latest_tags: 0`, `non_root_enforced: true`, `digest_pinned_base_images: true`, `status: "PASS"`. Verifies final-stage `USER node`, prohibits runtime `pnpm`/`npm`/`npx`/`corepack` in `CMD`/`ENTRYPOINT`, prohibits `ADD` and `COPY . .`, checks job-level `permissions`, and enforces `push: false` & `load: false`.
  - Base image digest verified against Docker Hub via `docker buildx imagetools inspect node:22.15.0-alpine3.21`: multi-arch OCI index digest `sha256:ad1aedbcc1b0575074a91ac146d6956476c1f9985994810e4ee02efd932a68fd`.
- **`npm run ci:test` (`exit 0`):** `3` suites / `3` tests passed (`0` failed, `0` skipped) including Cycle-2 negative assertions for final-stage `USER root`, `ADD`, runtime `CMD ["pnpm", ...]`, `ENCRYPTED PRIVATE KEY`, and non-localhost default Postgres passwords.

## 3. Environment Limitations & Non-Claims

- Local Docker Desktop daemon (`docker info` exited `1`) was not running, so `docker build` container compilation was not executed locally; Dockerfile immutability and syntax were verified statically via `ci:verify-images` and base digest inspection (`docker buildx imagetools inspect`).
- `DATABASE_URL` is unset in this shell environment, so `3` PostgreSQL integration test suites (`21` tests) remained skipped inside `npm test`.
- Online `pnpm audit --audit-level=high` and live GitHub Actions runners (`actions/checkout`, `docker/build-push-action`) were not executed locally; no registry push, cloud deployment, performance SLA, legal compliance, or clinical-safety claim is made.
