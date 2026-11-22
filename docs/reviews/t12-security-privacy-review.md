# T12 Independent Security and Privacy Review

**Task:** T12 — CI Quality, Dependency/Secret Scan, and Immutable Image Build  
**Decision:** `T12-CI-001` (`APPROVED` in [docs/decisions/t12-ci-policy-approval.md](../decisions/t12-ci-policy-approval.md))  
**Governance:** [.medicloud/agent-company/CONSTITUTION.md](../../.medicloud/agent-company/CONSTITUTION.md)  
**Handoff & Test Report:** [docs/medicloud/t12-handoff.md](../medicloud/t12-handoff.md), [docs/evidence/t12-test-report.md](../evidence/t12-test-report.md)  
**Reviewer:** Independent Security & Privacy Reviewer session (separate from implementation owner and `quality.tester`)  
**Review date (+07:00):** `2026-11-23` (Cycle 2 fresh re-verification post-remediation)  
**Decision: APPROVE** (strictly for the Security & Privacy gate tied to Cycle-2 canonical 9-file aggregate SHA-256 `066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38` within the verified local CI workflow, scanner, supply-chain audit, Dockerfile policy, and synthetic-data scope; does **not** certify live GitHub Actions execution, online `pnpm audit`, live Docker daemon image builds/runtime execution, container registry storage, PostgreSQL integration tests, OpenStack/GCP deployment, legal compliance, or clinical safety)  
**Canonical 9-File Aggregate SHA-256 (Cycle 2):** `066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`  
**Data classification:** Synthetic data only ([packages/contracts/data-classification.json](../../packages/contracts/data-classification.json)). Zero real PHI/PII, credentials, bearer tokens, private keys, or patient-record content.

---

## 1. Cycle-2 Canonical 9-File Fingerprint & Independent Verification

- Directly read all 9 canonical T12 files and governance/evidence records from disk without modifying any source, Dockerfile, workflow, config, or test file.
- Independently recomputed lowercase SHA-256 hashes on disk via PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath`, formatted as lexicographically sorted `path=lowercase_sha256` lines joined by LF (`\n`) in UTF-8 without BOM:
  - `.github/docker/Dockerfile.clinical-api` = `a7264bc2112a379971885aee0c48db41da4617b4ac2686cd0d86281675122ab6`
  - `.github/docker/Dockerfile.patient-portal` = `caa96fa789a96d7bbe8dd3968d86860e6ce82bcd4e143302b4101ffadd51ce59`
  - `.github/scripts/ci-dry-run.mjs` = `862be9d0cef7488a1c9b837eb47fedf0df2688ef7d68917f10754155b2dfbb92`
  - `.github/scripts/dependency-audit.mjs` = `10a1709f8ac1ccca1864b07e455da001566a21df98a272f2de0853c99533e4dd`
  - `.github/scripts/secret-and-phi-scan.mjs` = `5acc9dfe0abb0d13ea64e6f7f041028531c53355d75965c62448be6c2138965f`
  - `.github/scripts/t12-policy.test.mjs` = `d452a79f1227db0387ca8406dc68e2ca335b437fc00c21f9de4c62c617367aa7`
  - `.github/scripts/verify-immutable-images.mjs` = `1a119659163794ccd2943ac9914153e099f5ab32096778f8dec0c0f833ffa177`
  - `.github/workflows/ci.yml` = `570675e1631dc9365baed14c1358e39f075f46d01c1e19074a6763c2fc509642`
  - `package.json` = `b639915f6ccfd1e68cf15c6d84bb4f4ea57289671a5d4bcde6f8bd69d10963e3`
- Recomputed Cycle-2 aggregate SHA-256: **`066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`** — exact match with [docs/medicloud/t12-handoff.md](../medicloud/t12-handoff.md), [docs/evidence/t12-ci-dry-run-and-scan-report.md](../evidence/t12-ci-dry-run-and-scan-report.md), and [docs/evidence/t12-test-report.md](../evidence/t12-test-report.md).
- Independently executed read-only Cycle-2 checks against the workspace:
  - `npm run ci:scan:secrets`: exit `0` (`files_discovered: 186`, `files_scanned: 169`, `secret_findings_count: 0`, `phi_policy_violations_count: 0`, `status: "PASS"`). Re-verified `exit 0` (`files_discovered: 186`, `files_scanned: 169`, `0` findings) again after overwriting this review file.
  - `npm run ci:scan:deps`: exit `0` (`package_manager: "pnpm@10.22.0"`, `direct_dependencies: 13`, `dev_dependencies: 10`, `locked_packages_checked: 450`, `locked_snapshots_checked: 450`, `unpinned_or_untrusted_specs: 0`, `lockfile_drift: 0`, `missing_integrity_hashes: 0`, `blocked_packages: 0`, `status: "PASS"`).
  - `npm run ci:verify-images`: exit `0` (`dockerfiles_verified: 2`, `workflow_verified: true`, `mutable_latest_tags: 0`, `non_root_enforced: true`, `digest_pinned_base_images: true`, `status: "PASS"`).
  - `npm run ci:test`: exit `0` (`3` suites / `3` tests passed, `0` failed, `0` skipped in `603.0623ms`).
  - `node node_modules/next/dist/bin/next --version`: exit `0` (`Next.js v15.5.29`), confirming the direct Node entrypoint in `Dockerfile.patient-portal` resolves cleanly on disk.
  - Executed independent Cycle-2 adversarial temporary-directory checks (cleaned up immediately; zero workspace writes):
    - `secret-and-phi-scan.mjs`: verified `exit 1` and zero secret value echoing (`echoed: false`) for unbalanced `<realpass` Postgres URIs, remote `postgres:postgres@db.internal` and `admin:changeme@prod.internal` URIs, nested `docs/evidence/sub/bad.json` PHI fixture (`diagnosis`), `ENCRYPTED PRIVATE KEY` PEM blocks, and `docs/*.md` files containing a PEM footer (`hasPemFooter`).
    - `dependency-audit.mjs`: verified `exit 1` for `sha256-` (non-`sha512-`) integrity hashes and peer-suffixed blocked package keys (`colors@1.4.1(foo@1.0.0)`).
    - `verify-immutable-images.mjs`: verified `exit 1` (`missing_non_root_user_node`, `job_level_permission_escalation:quality`, `unexpected_docker_push:immutable-image-build`) when `USER root` follows `USER node`, a job overrides `permissions`, or `load: true` is set.

---

## 2. Detailed Security & Privacy Audit Findings (Cycle-2 Re-Verification)

### 2.1 GitHub Actions Security & Least Privilege
*Audited files: [.github/workflows/ci.yml](../../.github/workflows/ci.yml), [.github/scripts/verify-immutable-images.mjs](../../.github/scripts/verify-immutable-images.mjs), [.github/scripts/ci-dry-run.mjs](../../.github/scripts/ci-dry-run.mjs)*

- **Least-privilege `permissions` & safe triggers (`PASS`):**
  - [ci.yml:3-12](../../.github/workflows/ci.yml#L3-L12) triggers only on `push` and `pull_request` to `main` (avoiding `pull_request_target`) and sets top-level `permissions: contents: read` with zero job-level permission escalations.
  - [verify-immutable-images.mjs:114-120](../../.github/scripts/verify-immutable-images.mjs#L114-L120) now actively verifies per-job `permissions` overrides in addition to top-level permissions.
- **Sequential gate ordering, immutable tagging, `push: false`, and zero cloud deploy/secrets (`PASS`):**
  - `immutable-image-build` ([ci.yml:73-77](../../.github/workflows/ci.yml#L73-L77)) enforces `needs: [quality, security-scan]`.
  - All jobs use `pnpm install --frozen-lockfile` and pinned standard action major tags (`actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`, `docker/setup-buildx-action@v3`, `docker/build-push-action@v6`) with zero `@main`/`@master`/`@latest` refs.
  - `portal_build` and `clinical_build` ([ci.yml:95-118](../../.github/workflows/ci.yml#L95-L118)) enforce `push: false`, `load: false` (both verified by [verify-immutable-images.mjs:127](../../.github/scripts/verify-immutable-images.mjs#L127)), immutable `sha-${{ github.sha }}` tags, zero `:latest`, zero `secrets.*`, zero `apps/cloud-worker` (`T07` remains `BLOCKED: GCP access`), and zero cloud deploy commands.
  - [ci-dry-run.mjs:8,24-44,63-65](../../.github/scripts/ci-dry-run.mjs#L8) restricts direct `npm-cli.js` dispatch by `basename(...) === 'npm-cli.js'` and executes all `spawnSync` calls with `shell: false`.

### 2.2 Container Immutability & Runtime Hardening (Cycle-2 `[BLOCKING-1]` / `[BLOCKING-2]` Remediated)
*Audited files: [.github/docker/Dockerfile.clinical-api](../../.github/docker/Dockerfile.clinical-api), [.github/docker/Dockerfile.patient-portal](../../.github/docker/Dockerfile.patient-portal), [.github/scripts/verify-immutable-images.mjs](../../.github/scripts/verify-immutable-images.mjs)*

- **Digest-pinned multi-stage builds & zero `:latest` (`PASS`):**
  - All 3 stages (`deps`, `builder`, `runner`) in both [Dockerfile.clinical-api:2,8,18](../../.github/docker/Dockerfile.clinical-api#L2) and [Dockerfile.patient-portal:2,8,18](../../.github/docker/Dockerfile.patient-portal#L2) pin `FROM node:22.15.0-alpine3.21@sha256:ad1aedbcc1b0575074a91ac146d6956476c1f9985994810e4ee02efd932a68fd`, matching the Docker Hub OCI index digest verified earlier via `docker buildx imagetools inspect`, with zero `:latest` tags.
- **Direct non-root runtime entrypoints without Corepack network fetches (`PASS`):**
  - `[BLOCKING-1]` remediated: [Dockerfile.clinical-api:28-37](../../.github/docker/Dockerfile.clinical-api#L28-L37) drops `pnpm` from `runner` and uses `CMD ["node", "packages/contracts/validate.mjs"]` under `USER node` (clarifying `PORT=4000` / `EXPOSE 4000` are reserved for `T10` HTTP bootstrap).
  - `[BLOCKING-2]` remediated: [Dockerfile.patient-portal:29-36](../../.github/docker/Dockerfile.patient-portal#L29-L36) removes root `corepack enable && corepack prepare` from `runner` and executes `CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/patient-portal", "-p", "3000"]` under `USER node`, eliminating `/root/.cache/node/corepack` misses and outbound runtime registry fetches.
- **Selective `COPY`, `--frozen-lockfile`, OCI labels, and strengthened verifier (`PASS`):**
  - Both Dockerfiles run `pnpm install --frozen-lockfile`, set `org.opencontainers.image.revision="${GIT_COMMIT_SHA}"`, use selective non-secret `COPY` instructions only (no `.env*`, `.git`, `docs/evidence`, or credentials), and end with `USER node`.
  - [verify-immutable-images.mjs:51-85](../../.github/scripts/verify-immutable-images.mjs#L51-L85) now bans `ADD`, `COPY . .`, runtime `pnpm`/`npm`/`npx`/`corepack` in final-stage `CMD`/`ENTRYPOINT`, and requires the final stage's last `USER` directive to be `USER node`.

### 2.3 Supply-Chain & Lockfile Verification
*Audited files: [.github/scripts/dependency-audit.mjs](../../.github/scripts/dependency-audit.mjs), [package.json](../../package.json), [pnpm-lock.yaml](../../pnpm-lock.yaml), [.github/workflows/ci.yml](../../.github/workflows/ci.yml)*

- **Deterministic semver specs, `pnpm-lock.yaml` v9.0 parity, strict `sha512-`, and blocked-package checks (`PASS`):**
  - [package.json:7,9](../../package.json#L7-L9) pins `"packageManager": "pnpm@10.22.0"` and `"engines": { "node": ">=22" }`. [dependency-audit.mjs:35-63](../../.github/scripts/dependency-audit.mjs#L35-L63) guards missing `package.json` and rejects wildcard/tag/URL/local specifiers (`*`, `latest`, `next`, `file:`, `link:`, `git+`, `http(s)://`, `github:`) across all `13` direct `dependencies` and `10` `devDependencies`.
  - [dependency-audit.mjs:75-115](../../.github/scripts/dependency-audit.mjs#L75-L115) enforces `lockfileVersion: '9.0'`, exact `importers['.']` parity (`0` drift across `450` packages / `450` snapshots), peer-suffix normalization (`pkgKey.split('(')[0]`) against the 7-entry `BLOCKED_PACKAGE_VERSIONS` set, and strict `^sha512-` integrity validation (`0` missing).
  - [ci.yml:66-67](../../.github/workflows/ci.yml#L66-L67) runs online `pnpm audit --audit-level=high` inside `security-scan` before `immutable-image-build`.

### 2.4 Secret & Synthetic-Only PHI Scan Boundaries
*Audited files: [.github/scripts/secret-and-phi-scan.mjs](../../.github/scripts/secret-and-phi-scan.mjs), [packages/contracts/data-classification.json](../../packages/contracts/data-classification.json), [docs/evidence/t09-fhir-conformance-fixtures.json](../evidence/t09-fhir-conformance-fixtures.json), [.github/scripts/t12-policy.test.mjs](../../.github/scripts/t12-policy.test.mjs)*

- **Zero secret value echoing & hardened credential rules (`PASS`):**
  - Outputs only `{file, line, rule}` or `{file, rule}` metadata with zero matched credential/secret text echoed.
  - Detects forbidden files (`.env`, `.env.<non-example>`, `.pem`/`.key`/`.p12`/`.pfx`, `id_*`, `credentials.json`, `service-account*.json`), private key headers including `ENCRYPTED PRIVATE KEY` ([secret-and-phi-scan.mjs:31](../../.github/scripts/secret-and-phi-scan.mjs#L31)), AWS `AKIA` keys, GitHub PATs, Slack tokens, GCP service-account JSON private keys, and unredacted Postgres credentials.
  - [secret-and-phi-scan.mjs:116-127](../../.github/scripts/secret-and-phi-scan.mjs#L116-L127) restricts inline-backtick `PRIVATE KEY` documentation allowance strictly to `docs/**/*.md` files that contain no PEM footer (`!hasPemFooter`).
- **Balanced placeholder & localhost-only dummy Postgres boundaries (`PASS`):**
  - [secret-and-phi-scan.mjs:40-42,138-150](../../.github/scripts/secret-and-phi-scan.mjs#L40-L42) requires balanced `<...>` placeholders (`BALANCED_PLACEHOLDER_RE`), limits non-localhost URI password exemptions strictly to `{'redacted', 'placeholder', 'synthetic'}` (blocking remote default `postgres` / `changeme` passwords), and confines `LOCAL_SAFE_PLACEHOLDERS` strictly to `localhost` / `127.0.0.1`.
- **Synthetic policy & recursive evidence fixture scanning (`PASS`):**
  - Enforces [data-classification.json](../../packages/contracts/data-classification.json) policy flags and recursively traverses `docs/evidence/**/*.json` via `scanEvidenceJsonTree()` ([secret-and-phi-scan.mjs:167-189](../../.github/scripts/secret-and-phi-scan.mjs#L167-L189)) against `PHI_FIXTURE_KEYS`.

---

## 3. Non-Blocking Hardening Observations & Explicit Non-Claims

1. **Remaining non-blocking pre-staging hardening items (tracked for `T10`/`T14`):**
   - **Repository `.dockerignore` & production runner slimming:** The repo root still has no `.dockerignore` (recommended to exclude `.git`, `.env*`, `.next`, `node_modules`, `docs/evidence`, `.medicloud/agent-company/runtime`, `*.pem`, `*.key` from local Docker build contexts), and both `runner` stages copy full `node_modules` with `--chown=node:node` rather than pruning devDependencies and mounting code read-only (`root:root`). `Dockerfile.clinical-api` uses `contracts:validate` as a P0 smoke `CMD` until `T10` supplies a clinical HTTP server entrypoint.
   - **Workflow action pinning & scanner edge precision:** `ci.yml` pins official actions to major tags (`@v4`/`@v3`/`@v6`, compliant with `T12-CI-001`; 40-char commit-SHA pinning recommended for `T14` hardening). In `secret-and-phi-scan.mjs`, `scanEvidenceJsonTree` checks `parsed.fixtures` only when `'fixtures' in parsed` (skipping sibling top-level keys if added in future evidence JSONs), `docs/**/*.md` line-level backtick matching on a line without a PEM footer should avoid mixing raw non-backticked headers on the same line, and AWS STS (`ASIA...`) / `.npmrc` patterns can be added in future hardening.
2. **Environment limitations & unexecuted checks:**
   - **Stopped local Docker Desktop daemon (`docker info` exited `1`):** Live `docker build` / `docker run` compilation and container startup of `Dockerfile.clinical-api` and `Dockerfile.patient-portal` were **NOT RUN** locally.
   - **No live GitHub Actions runner:** Live workflow execution (`actions/*`, `docker/build-push-action@v6`, and online `pnpm audit --audit-level=high`) was **NOT RUN** locally.
   - **Unset `DATABASE_URL`:** PostgreSQL integration suites (`21` tests) remained skipped (`T07`, `T10`, `T11`, `T13`–`T15` remain out of scope / `BLOCKED`).
3. **Explicit non-claims (Constitution Sections 3 & 8; `T12-CI-001` Section 3):**
   - This `APPROVE` decision applies **solely** to the Security & Privacy gate for exact Cycle-2 canonical 9-file aggregate SHA-256 **`066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`** within the verified local scope. It does **not** replace the independent Code Review or Evidence Review gates, and makes **no claim** of live GitHub Actions execution, local/remote container build success, container registry storage, PostgreSQL integration pass, OpenStack/GCP deployment, measured latency/throughput/SLA/RPO/RTO performance, legal/regulatory compliance, or clinical safety.
