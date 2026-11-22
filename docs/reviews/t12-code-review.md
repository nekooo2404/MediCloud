# T12 Independent Code Review (Re-Review Cycle 2)

**Task:** T12 — CI Quality, Dependency/Secret Scan, and Immutable Image Build  
**Decision:** `APPROVE` (for Cycle-2 canonical 9-file aggregate SHA-256 `066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`, strictly within verified local CI dry-run, deterministic scanner, lockfile supply-chain audit, static Dockerfile/workflow policy check, direct Node runtime entrypoint verification, ESLint, contract/typecheck/build, and unit/policy test scope)  
**Reviewer:** Independent code-review session (separate from implementation owner and independent `quality.tester`)  
**Review date (+07:00):** `2026-11-23`  
**Prior review cycle:** `REQUEST_CHANGES` on `2db63755e1938949e8a9fde925d6ec48b4f9e4f6c8e4aedbc9f8f4a5ddee732d` (blocking items `[BLOCKING-1]` and `[BLOCKING-2]`)  
**Reviewed governance & handoff inputs:** `docs/decisions/t12-ci-policy-approval.md` (`T12-CI-001`), `docs/medicloud/t12-handoff.md`, `docs/evidence/t12-ci-dry-run-and-scan-report.md`, `docs/evidence/t12-test-report.md`, `.medicloud/agent-company/CONSTITUTION.md`  
**Implementation / Workflow / Dockerfile / Script / Config / Test files modified by this review:** None (strictly read-only review; only `docs/reviews/t12-code-review.md` written)

---

## 1. Canonical Fingerprint & Verification Scope

### 1.1 Cycle-2 Canonical 9-File Manifest Verification

Independently recomputed per-file SHA-256 hashes directly from disk via Node `crypto` (`sha256`) and assembled the lexicographically sorted LF-joined (`\n`, UTF-8 without BOM) `path=lowercase_sha256` manifest. All 9 hashes and the aggregate SHA-256 match `docs/medicloud/t12-handoff.md`, `docs/evidence/t12-ci-dry-run-and-scan-report.md`, and `docs/evidence/t12-test-report.md` identically:

- **Cycle-2 Canonical 9-file aggregate SHA-256:** `066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`

| # | Path | Verified SHA-256 (Disk) | Cycle-2 Status |
|---|---|---|---|
| 1 | `.github/docker/Dockerfile.clinical-api` | `a7264bc2112a379971885aee0c48db41da4617b4ac2686cd0d86281675122ab6` | Remediated & verified (`[BLOCKING-1]` closed) |
| 2 | `.github/docker/Dockerfile.patient-portal` | `caa96fa789a96d7bbe8dd3968d86860e6ce82bcd4e143302b4101ffadd51ce59` | Remediated & verified (`[BLOCKING-2]` closed) |
| 3 | `.github/scripts/ci-dry-run.mjs` | `862be9d0cef7488a1c9b837eb47fedf0df2688ef7d68917f10754155b2dfbb92` | Hardened & re-verified |
| 4 | `.github/scripts/dependency-audit.mjs` | `10a1709f8ac1ccca1864b07e455da001566a21df98a272f2de0853c99533e4dd` | Hardened & re-verified |
| 5 | `.github/scripts/secret-and-phi-scan.mjs` | `5acc9dfe0abb0d13ea64e6f7f041028531c53355d75965c62448be6c2138965f` | Hardened & re-verified |
| 6 | `.github/scripts/t12-policy.test.mjs` | `d452a79f1227db0387ca8406dc68e2ca335b437fc00c21f9de4c62c617367aa7` | Expanded & re-verified |
| 7 | `.github/scripts/verify-immutable-images.mjs` | `1a119659163794ccd2943ac9914153e099f5ab32096778f8dec0c0f833ffa177` | Hardened & re-verified |
| 8 | `.github/workflows/ci.yml` | `570675e1631dc9365baed14c1358e39f075f46d01c1e19074a6763c2fc509642` | Unchanged from Cycle 1; verified |
| 9 | `package.json` | `b639915f6ccfd1e68cf15c6d84bb4f4ea57289671a5d4bcde6f8bd69d10963e3` | Unchanged from Cycle 1; verified |

### 1.2 Independent Read-Only Checks Executed in Cycle 2

- `npm run ci:scan:secrets` -> exit `0` (`files_discovered: 186`, `files_scanned: 169`, `secret_findings_count: 0`, `phi_policy_violations_count: 0`, `status: "PASS"`).
- `npm run ci:scan:deps` -> exit `0` (`package_manager: "pnpm@10.22.0"`, `direct_dependencies: 13`, `dev_dependencies: 10`, `locked_packages_checked: 450`, `locked_snapshots_checked: 450`, `unpinned_or_untrusted_specs: 0`, `lockfile_drift: 0`, `missing_integrity_hashes: 0`, `blocked_packages: 0`, `status: "PASS"`).
- `npm run ci:verify-images` -> exit `0` (`dockerfiles_verified: 2`, `workflow_verified: true`, `mutable_latest_tags: 0`, `non_root_enforced: true`, `digest_pinned_base_images: true`, `findings: []`, `status: "PASS"`).
- `npm run ci:test` (`node --test .github/scripts/t12-policy.test.mjs`) -> exit `0` (`3` suites / `3` tests passed, `0` failed, `0` skipped, `609.4133ms`).
- `npx eslint .github/scripts` -> exit `0` (`0` errors, `0` warnings).
- `npm run ci:lint:all` -> exit `0` (pre-existing Next.js App Router `Pages directory cannot be found` advisory only).
- `node --trace-deprecation .github/scripts/ci-dry-run.mjs` -> exit `0` (`11/11` stages `PASS`, zero `DEP0190` or other Node deprecation warnings).
- `node node_modules/next/dist/bin/next --version` -> exit `0` (`Next.js v15.5.29`).
- `node packages/contracts/validate.mjs` -> exit `0` (`T02 contract validation passed: OpenAPI, event schema, policy and rejection fixtures.`).
- `YAML.parseDocument` on `.github/workflows/ci.yml` -> `0` syntax errors, `0` warnings.

---

## 2. Closure Verification of Cycle-1 Blocking Findings & Hardening Items

### 2.1 `[BLOCKING-1]` `.github/docker/Dockerfile.clinical-api` `runner` Runtime Entrypoint — **CLOSED**

- **Verified fix (`.github/docker/Dockerfile.clinical-api:28, 35–37`):**
  - Replaced `CMD ["pnpm", "run", "contracts:validate"]` with direct Node execution `CMD ["node", "packages/contracts/validate.mjs"]`, removing any runtime `pnpm`/Corepack dependency inside the `runner` stage (`node:22.15.0-alpine3.21@sha256:ad1aedbc...`).
  - Line `28` explicitly documents `# PORT=4000 / EXPOSE 4000 reserved for T10 OpenStack HTTP server bootstrap; T12 smoke runs direct Node contract validation offline without Corepack/pnpm.`
  - Verified `/app/packages/contracts` and `/app/node_modules` (containing `ajv` and `ajv-formats`) are copied with `--chown=node:node` prior to `USER node`, and `node packages/contracts/validate.mjs` executes cleanly (`exit 0`).

### 2.2 `[BLOCKING-2]` `.github/docker/Dockerfile.patient-portal` `runner` Corepack Cache Mismatch — **CLOSED**

- **Verified fix (`.github/docker/Dockerfile.patient-portal:18–36`):**
  - Removed `RUN corepack enable && corepack prepare pnpm@10.22.0 --activate` from `runner` (keeping Corepack strictly in `deps` and `builder`).
  - Replaced `CMD ["pnpm", "exec", "next", "start", "apps/patient-portal", "-p", "3000"]` with `CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/patient-portal", "-p", "3000"]`.
  - Eliminates `/root/.cache/node/corepack` misses and runtime npm registry fetches under `USER node` (`HOME=/home/node`). Verified `node_modules/next/dist/bin/next` executes directly under `node` (`Next.js v15.5.29`, `exit 0`).

### 2.3 Hardening & Policy Precision Closure — **VERIFIED**

- **`verify-immutable-images.mjs`:** Unfolds line continuations, parses multi-stage `FROM` blocks (`stages`), verifies the **final stage's last `USER` directive** is `USER node` (`lines 73–78`), bans `pnpm`/`npm`/`npx`/`corepack` in final `CMD`/`ENTRYPOINT` (`lines 16, 80–85`), bans `ADD` (`lines 51–53`) and `COPY . .` (`lines 57–59`), guards missing `ci.yml` (`lines 92–94`), checks per-job `permissions` overrides (`lines 115–120`), and requires both `push: false` and `load: false` (`line 127`).
- **`dependency-audit.mjs`:** Guards missing `package.json` (`lines 35–37`), normalizes peer suffixes (`pkgKey.split('(')[0]`, `line 105`) before checking `BLOCKED_PACKAGE_VERSIONS`, and enforces strict `sha512-` integrity hashes (`/^sha512-[A-Za-z0-9+/=]+$/`, `line 111`), matching `T12-CI-001`.
- **`secret-and-phi-scan.mjs`:** Adds `ENCRYPTED ` private key header matching (`line 31`), enforces balanced `<placeholder>` syntax (`BALANCED_PLACEHOLDER_RE`, `line 40`) and separates remote vs local safe DB placeholders (`lines 41–42`), recurses `docs/evidence/**/*.json` (`scanEvidenceJsonTree`, `lines 167–189`), and safely exempts inline backtick header references in `docs/**/*.md` only when no PEM footer is present (`lines 116–132`).
- **`ci-dry-run.mjs`:** Restricts direct CLI execution to `basename(npmCliCandidate) === 'npm-cli.js'` (`line 8`) and prints `proc.error?.message` on spawn errors (`lines 63–65`).
- **`t12-policy.test.mjs` & `docs/decisions/t12-ci-policy-approval.md`:** Expanded negative fixtures cover `ENCRYPTED PRIVATE KEY`, remote default `postgres:postgres@db.internal` URI, `ADD`, `USER node` followed by `USER root`, runtime `CMD ["pnpm", ...]`, and `sha1-` non-sha512 integrity hash (`3/3` suites passing, `afterEach` `rmSync` cleanup verified). `docs/decisions/t12-ci-policy-approval.md` Section 2 now references the canonical 9-file manifest consistently.

---

## 3. Comprehensive Audit Summary

| Audit Dimension | Status | Evidence |
|---|---|---|
| **Cross-platform script safety (`shell: false`, `DEP0190`, `--root`, cleanup)** | **PASS** | All `spawnSync` calls in `ci-dry-run.mjs` and `t12-policy.test.mjs` use `shell: false`; `node --trace-deprecation .github/scripts/ci-dry-run.mjs` completed `11/11` stages with `exit 0` and zero `DEP0190` warnings; `--root` resolves via `path.resolve`; `afterEach` recursively cleans every `tempDirs` entry. |
| **Dockerfile build paths, base pins, `--frozen-lockfile`, and runner `CMD`s** | **PASS (static & host verification)** | Digest-pinned `node:22.15.0-alpine3.21@sha256:ad1aedbc...`, `--frozen-lockfile`, OCI labels, `USER node` final stage, direct Node `CMD`s in both `runner` stages, and all copied paths (`package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `astryx-themes.ts`, `src/`, `themes/`, `apps/patient-portal/`, `packages/contracts/`, `apps/clinical-api/`, `apps/event-relay/`) verified on disk. |
| **`.github/workflows/ci.yml` YAML, job graph, and expressions** | **PASS** | `YAML.parseDocument` `0` errors/`0` warnings; `permissions: contents: read`; `immutable-image-build` depends on `needs: [quality, security-scan]`; `push: false`, `load: false`, `sha-${{ github.sha }}` tags; valid `BUILD_TIMESTAMP` fallback. |
| **ESLint & negative-fixture test coverage** | **PASS** | `npx eslint .github/scripts` (`0` errors, `0` warnings), `npm run ci:lint:all` (`exit 0`), and `npm run ci:test` (`3/3` suites passing) cover secret files, AWS keys, PEM/encrypted keys, remote/local unredacted DB URIs, PHI keys, unpinned/drifted/blocked/non-sha512 deps, unpinned base images, `ADD`, `USER root`, runtime `pnpm` `CMD`, `contents: write`, `push: true`, and `:latest` tags. |

### Non-Blocking Observations (Tracked Outside T12 Blockers)

1. **No `.dockerignore` and `devDependencies` retained in `runner` images:** Both `runner` images copy full `node_modules` from `deps`/`builder` (`pnpm install --frozen-lockfile` without production prune), and the repo root lacks a `.dockerignore` (so local `docker build` sends `node_modules/`, `.next/`, `docs/`, etc. in build context and `COPY apps/patient-portal` copies local `.next/` if present). Acceptable for T12 immutable build validation; consider `.dockerignore` + production pruning when packaging for T10/T11 registry targets.
2. **Untested `ci-dry-run.mjs` and workflow-level corner fixtures:** `t12-policy.test.mjs` does not have a dedicated mock-repo test for `ci-dry-run.mjs` (covered by direct execution of `npm run ci:dry-run`) or explicit negative fixtures for `github_pat`, `slack_token`, `gcp_service_account_key`, `image_build_missing_gate_dependencies`, or `forbidden_cloud_deploy_command`.

---

## 4. Independence & Explicit Non-Claims

- Conducted independently from both the T12 implementation owner and the independent `quality.tester` session; zero source, Dockerfile, workflow, script, config, test, handoff, or `TestReport` files were modified.
- Local Docker Desktop daemon remained stopped (`docker info` exited `1`), `DATABASE_URL` remained unset (`21` PostgreSQL integration tests skipped in `npm test`), and GitHub Actions (`pnpm audit --audit-level=high`, `actions/*`, `docker/build-push-action`) was not executed remotely.
- No claim is made regarding live Docker image compilation/container startup inside Alpine, live GitHub Actions execution, container registry storage, PostgreSQL integration pass, OpenStack/GCP deployment, measured latency/throughput/SLA/RPO/RTO performance, legal compliance, or clinical safety.

---

## 5. Final Decision

**Decision:** `APPROVE` (strictly tied to Cycle-2 canonical 9-file aggregate SHA-256 `066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`, subject to the explicit non-claims above and completion of the independent `Security/Privacy` and `Evidence` review gates prior to advancing T12 past `READY_FOR_TEST`).
