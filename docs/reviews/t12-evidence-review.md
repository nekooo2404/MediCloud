# T12 Independent Evidence and Governance Review

**Task:** T12 — CI Quality, Dependency/Secret Scan, and Immutable Image Build  
**Decision Record:** `T12-CI-001` (`APPROVED` in [docs/decisions/t12-ci-policy-approval.md](../decisions/t12-ci-policy-approval.md))  
**Governance:** [.medicloud/agent-company/CONSTITUTION.md](../../.medicloud/agent-company/CONSTITUTION.md) (v1.0.0) and [docs/medicloud/tasks.md](../medicloud/tasks.md)  
**Reviewer:** Independent Evidence Review session (strictly separate from T12 implementation owner, `quality.tester`, Code Review, and Security/Privacy Review)  
**Review Timestamp (+07:00):** `2026-11-23T02:58:30+07:00`  
**Decision: APPROVE** (Evidence & Governance gate only, strictly tied to Cycle-2 canonical 9-file aggregate SHA-256 **`066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`** within verified local CI dry-run, deterministic secret/PHI scan, lockfile supply-chain audit, static Dockerfile/workflow policy check, direct Node entrypoint check, and unit/policy test scope; stopped local Docker daemon image compilation/execution, unset `DATABASE_URL` PostgreSQL integration tests, and live GitHub Actions execution including online `pnpm audit --audit-level=high` remain **NOT RUN / SKIPPED**)  
**Data Classification:** Synthetic data only ([packages/contracts/data-classification.json](../../packages/contracts/data-classification.json)). Zero real PHI/PII, credentials, bearer tokens, private keys, or real patient-record content.  
**Files Modified by This Review:** Only `docs/reviews/t12-evidence-review.md` (zero edits to source, Dockerfile, workflow, script, config, test, handoff, `TestReport`, code review, security review, decision record, or `docs/medicloud/tasks.md` files).

---

## 1. Recomputed Fingerprints & Cross-Artifact Consistency

### 1.1 Cycle-2 Canonical 9-File T12 Manifest & Aggregate SHA-256

Independently recomputed lowercase SHA-256 digests directly from disk via PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath`, formatted as lexicographically sorted `path=lowercase_sha256` lines joined by LF (`\n`) in UTF-8 without BOM:

- **Recomputed Aggregate SHA-256 (Disk):** `066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`
- **Programmatic Cross-Artifact Parity:**
  - All `9/9` per-file SHA-256 hashes and the aggregate SHA-256 match identically across [docs/medicloud/t12-handoff.md](../medicloud/t12-handoff.md), [docs/evidence/t12-test-report.md](../evidence/t12-test-report.md), [docs/reviews/t12-code-review.md](./t12-code-review.md), and [docs/reviews/t12-security-privacy-review.md](./t12-security-privacy-review.md).
  - [docs/evidence/t12-ci-dry-run-and-scan-report.md](../evidence/t12-ci-dry-run-and-scan-report.md) records the identical Cycle-2 aggregate SHA-256 `066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38` (`hasAggregate=True`).

| # | Path | Recomputed SHA-256 (Disk) | Bytes | Disk LastWriteTime (`+07:00`) |
|---|---|---|---|---|
| 1 | `.github/docker/Dockerfile.clinical-api` | `a7264bc2112a379971885aee0c48db41da4617b4ac2686cd0d86281675122ab6` | 2024 | `2026-11-23T02:49:19.5149042+07:00` |
| 2 | `.github/docker/Dockerfile.patient-portal` | `caa96fa789a96d7bbe8dd3968d86860e6ce82bcd4e143302b4101ffadd51ce59` | 1766 | `2026-11-23T02:49:21.8826863+07:00` |
| 3 | `.github/scripts/ci-dry-run.mjs` | `862be9d0cef7488a1c9b837eb47fedf0df2688ef7d68917f10754155b2dfbb92` | 2554 | `2026-11-23T02:49:35.6640485+07:00` |
| 4 | `.github/scripts/dependency-audit.mjs` | `10a1709f8ac1ccca1864b07e455da001566a21df98a272f2de0853c99533e4dd` | 4841 | `2026-11-23T02:49:25.2021402+07:00` |
| 5 | `.github/scripts/secret-and-phi-scan.mjs` | `5acc9dfe0abb0d13ea64e6f7f041028531c53355d75965c62448be6c2138965f` | 7279 | `2026-11-23T02:50:46.1985465+07:00` |
| 6 | `.github/scripts/t12-policy.test.mjs` | `d452a79f1227db0387ca8406dc68e2ca335b437fc00c21f9de4c62c617367aa7` | 9038 | `2026-11-23T02:50:37.6102385+07:00` |
| 7 | `.github/scripts/verify-immutable-images.mjs` | `1a119659163794ccd2943ac9914153e099f5ab32096778f8dec0c0f833ffa177` | 6122 | `2026-11-23T02:49:23.6471740+07:00` |
| 8 | `.github/workflows/ci.yml` | `570675e1631dc9365baed14c1358e39f075f46d01c1e19074a6763c2fc509642` | 4162 | `2026-11-23T02:36:27.7423353+07:00` |
| 9 | `package.json` | `b639915f6ccfd1e68cf15c6d84bb4f4ea57289671a5d4bcde6f8bd69d10963e3` | 2391 | `2026-11-23T02:37:02.1953987+07:00` |

### 1.2 Out-of-Scope Immutability (T08, T09 & Post-T09 Boundary)

Independently recomputed SHA-256 hashes directly from disk via PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath`:

- **T08 (`24` canonical files in [docs/medicloud/t08-handoff.md](../medicloud/t08-handoff.md) order, LF-joined UTF-8 without BOM):** Recomputed aggregate SHA-256 is **`2e3adb5c64a6881ad6954591596eb1e9ed4a6a54a2bab8ef6ffddca3c4839bcc`** — exact match with T08 handoff and test report.
- **T09 (`9` canonical files lexicographically sorted, LF-joined UTF-8 without BOM):** Recomputed aggregate SHA-256 is **`7a16b136c07f3c8007658a1ae63219169635bd7f2b6153cc02c09e8b78f9ee23`** — exact match with T09 handoff, test report, and evidence review.
- **`pnpm-lock.yaml`:** Untouched (`136943` bytes, `LastWriteTime: 2026-11-21T18:53:53.8401836+07:00`, SHA-256 `05f77bd13eb933c36691541466c7ed9ee51cca6abfa4468c76d8623cfb129f46`).
- **Workspace Timestamp Sweep (`LastWriteTime > 2026-11-23T01:52:00+07:00`, excluding `node_modules/`, `.next/`, `.git/`):**
  - `apps/` (excluding `.next/`): **`0`** modified files.
  - `packages/`: **`0`** modified files.
  - `tests/`: **`0`** modified files.
  - All `16` files modified/created after `2026-11-23T01:52:00+07:00` reside strictly inside `.github/` (`8` files), `package.json` (`1` file), and `docs/` (`7` files: `tasks.md`, `t12-ci-policy-approval.md`, `t12-ci-dry-run-and-scan-report.md`, `t12-handoff.md`, `t12-test-report.md`, `t12-security-privacy-review.md`, `t12-code-review.md`). No files in `.medicloud/`, `tools/`, `themes/`, `src/`, or `output/` were modified.

---

## 2. Independent Read-Only Verification & Environment State

Executed read-only verification commands directly against `d:\hoapuiii\Code\MediCloud` (`Node v24.16.0`, `npm 12.2.0`, Corepack `pnpm 10.22.0`; `.git` absent at project root and parent directory):

| Check / Environment State | Exit | Observed Result / Counts |
|---|---|---|
| Environment variables | — | `DATABASE_URL`: `False` (unset); `HAPI_FHIR_BASE_URL`: `False` (unset); `CLINICAL_API_BASE_URL`: `False` (unset) |
| `docker info` | `1` | Docker CLI `29.4.3` & Buildx `v0.33.0-desktop.1` present; local Docker Desktop daemon **stopped** (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine ... The system cannot find the file specified.`) |
| `npm run ci:scan:secrets` | `0` | `files_discovered: 186`, `files_scanned: 169`, `secret_findings_count: 0`, `phi_policy_violations_count: 0`, `status: "PASS"` |
| `npm run ci:scan:deps` | `0` | `package_manager: "pnpm@10.22.0"`, `direct_dependencies: 13`, `dev_dependencies: 10`, `locked_packages_checked: 450`, `locked_snapshots_checked: 450`, `unpinned_or_untrusted_specs: 0`, `lockfile_drift: 0`, `missing_integrity_hashes: 0`, `blocked_packages: 0`, `status: "PASS"` |
| `npm run ci:verify-images` | `0` | `dockerfiles_verified: 2`, `workflow_verified: true`, `mutable_latest_tags: 0`, `non_root_enforced: true`, `digest_pinned_base_images: true`, `findings: []`, `status: "PASS"` |
| `npm run ci:test` | `0` | `node --test .github/scripts/t12-policy.test.mjs`: `3` suites / `3` tests passed (`0` failed, `0` skipped, `662.2843ms`) |
| `npm test` | `0` | Vitest `v3.2.7`: **`9` test files passed (`52` passed)**, **`3` DB integration test files skipped (`21` skipped: `tests/scheduling.integration.test.ts` `10`, `tests/outbox.integration.test.ts` `10`, `tests/clinical.integration.test.ts` `1`)** because `DATABASE_URL` is unset (`809ms`) |
| `YAML.parseDocument` on `.github/workflows/ci.yml` | `0` | `{ errors: 0, warnings: 0 }` |
| `node packages/contracts/validate.mjs` | `0` | `T02 contract validation passed: OpenAPI, event schema, policy and rejection fixtures.` |
| `node node_modules/next/dist/bin/next --version` | `0` | `Next.js v15.5.29` |
| Dockerfile `COPY` path existence check | — | Confirmed on disk: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `astryx-themes.ts`, `src`, `themes`, `apps/patient-portal`, `packages/contracts`, `apps/clinical-api`, `apps/event-relay`, `apps/clinical-api/prisma/schema.prisma`, `packages/contracts/validate.mjs`, `node_modules/next/dist/bin/next` (`exists=True` for all 13 paths) |

Re-checked post-review via `npm run ci:scan:secrets` after writing `docs/reviews/t12-evidence-review.md` to confirm the new review document introduces `0` secret or PHI findings.

---

## 3. Constitution Sections 4, 5, 6, 7, 8 & 9 Governance Audit

- [x] **Mandatory Work Lifecycle & Human Policy Approval (Sections 4 & 9):**
  - `T12-CI-001` ([docs/decisions/t12-ci-policy-approval.md](../decisions/t12-ci-policy-approval.md)) records `Status: APPROVED` (`2026-11-23`) via project-owner Clarify decisions `A1`–`A2`, unlocking T12 strictly within `.github/`, `package.json`, and `docs/` over `TEST_PASSED` components (`T01`–`T06`, `T08`, `T09`), while keeping `T07` (`apps/cloud-worker/`) excluded.
  - [docs/medicloud/tasks.md](../medicloud/tasks.md) preserves `T07` (`BLOCKED: GCP access`), `T10` (`BLOCKED: OpenStack access`), `T11` (`BLOCKED: GCP/billing access`), `T13` (`BLOCKED: cloud environments`), `T14` (`BLOCKED: T13 evidence`), and `T15` (`BLOCKED: all gates`), while leaving `T12` at `READY_FOR_TEST` pending orchestrator transition after all Cycle-2 gates pass.
- [x] **Gate Presence, Independence & Causal Chronology (Sections 5 & 7):**
  - **Chronology verified from filesystem timestamps and artifact headers:**
    1. Cycle-1 baseline `ci.yml` (`02:36:27+07:00`), `package.json` (`02:37:02+07:00`), and `tasks.md` (`02:38:18+07:00`).
    2. Cycle-2 remediation edits addressing `[BLOCKING-1]`, `[BLOCKING-2]`, and hardening notes completed across `Dockerfile.clinical-api` (`02:49:19+07:00`), `Dockerfile.patient-portal` (`02:49:21+07:00`), `verify-immutable-images.mjs` (`02:49:23+07:00`), `dependency-audit.mjs` (`02:49:25+07:00`), `ci-dry-run.mjs` (`02:49:35+07:00`), `docs/decisions/t12-ci-policy-approval.md` Section 2 alignment (`02:49:54+07:00`), `t12-policy.test.mjs` (`02:50:37+07:00`), and `secret-and-phi-scan.mjs` (`02:50:46+07:00`).
    3. Dry-run evidence collected `02:50:51+07:00` – `02:51:30+07:00` and recorded in [docs/evidence/t12-ci-dry-run-and-scan-report.md](../evidence/t12-ci-dry-run-and-scan-report.md) (`02:51:52+07:00`), followed by [docs/medicloud/t12-handoff.md](../medicloud/t12-handoff.md) (`02:51:53+07:00`).
    4. Independent `quality.tester` executed verification `02:52:25+07:00` – `02:53:35+07:00` and issued [docs/evidence/t12-test-report.md](../evidence/t12-test-report.md) (`Status: PASS`) at `02:54:12+07:00`.
    5. Independent `Security/Privacy Review` issued [docs/reviews/t12-security-privacy-review.md](./t12-security-privacy-review.md) (`Decision: APPROVE`) at `02:56:06+07:00`.
    6. Independent `Code Review` issued [docs/reviews/t12-code-review.md](./t12-code-review.md) (`Decision: APPROVE`) at `02:56:15+07:00`.
  - Zero edits to any of the 9 canonical T12 files occurred after `2026-11-23T02:50:46+07:00`. All Cycle-2 gates are present and independent (`quality.tester`: `PASS`, `Code Review`: `APPROVE`, `Security/Privacy`: `APPROVE`).
- [x] **T12-CI-001 Scope & Policy Traceability (Section 8):**
  - [.github/workflows/ci.yml](../../.github/workflows/ci.yml): top-level `permissions: contents: read`, `immutable-image-build` depends on `needs: [quality, security-scan]`, uses `pnpm install --frozen-lockfile`, runs `pnpm audit --audit-level=high` in `security-scan`, enforces `push: false` and `load: false`, uses immutable `sha-${{ github.sha }}` tags without `:latest`, and contains zero cloud deploy steps, secrets, or `apps/cloud-worker/` builds.
  - [.github/docker/Dockerfile.clinical-api](../../.github/docker/Dockerfile.clinical-api) and [.github/docker/Dockerfile.patient-portal](../../.github/docker/Dockerfile.patient-portal): multi-stage `deps`/`builder`/`runner` pinned to `node:22.15.0-alpine3.21@sha256:ad1aedbcc1b0575074a91ac146d6956476c1f9985994810e4ee02efd932a68fd` (registry OCI index digest match recorded in `t12-test-report.md` and `t12-ci-dry-run-and-scan-report.md`), OCI `org.opencontainers.image.revision` label, `--frozen-lockfile`, `USER node` final stage, and direct `node` `CMD`s (`node packages/contracts/validate.mjs` and `node node_modules/next/dist/bin/next start apps/patient-portal -p 3000`).
  - [.github/scripts/secret-and-phi-scan.mjs](../../.github/scripts/secret-and-phi-scan.mjs), [.github/scripts/dependency-audit.mjs](../../.github/scripts/dependency-audit.mjs), [.github/scripts/verify-immutable-images.mjs](../../.github/scripts/verify-immutable-images.mjs), [.github/scripts/ci-dry-run.mjs](../../.github/scripts/ci-dry-run.mjs), and [.github/scripts/t12-policy.test.mjs](../../.github/scripts/t12-policy.test.mjs): all implemented strictly inside `.github/`, wired via `package.json`, verified statically and by automated tests.
- [x] **Transparent Limitation Disclosures & Zero Unverified Claims (Sections 3, 6, 8 & 10):**
  - Programmatic scan across `docs/decisions/t12-ci-policy-approval.md`, `docs/medicloud/t12-handoff.md`, `docs/evidence/t12-ci-dry-run-and-scan-report.md`, `docs/evidence/t12-test-report.md`, `docs/reviews/t12-code-review.md`, and `docs/reviews/t12-security-privacy-review.md` confirmed every mention of `deployed`, `production-ready`, `measured`, `compliance`, `clinical safety`, `SLA`, `RPO`, `RTO`, `live GitHub`, or registry/cloud execution occurs exclusively inside explicit **non-claims** or **not run / skipped** disclosures.
  - All T12 artifacts consistently disclose: (1) stopped local Docker Desktop daemon (`docker info` exit `1`, so `docker build` / `docker run` was not executed locally), (2) unset `DATABASE_URL` (`21` PostgreSQL integration tests skipped in `npm test`), and (3) non-execution of live GitHub Actions runners (`actions/*`, `docker/build-push-action@v6`) and online `pnpm audit --audit-level=high` (`ci:scan:deps` verifies lockfile integrity/drift and a static 7-entry blocked-package list offline).

---

## 4. Carried-Forward Non-Blocking Observations (Tracked for `T10` / `T14`)

Preserving non-blocking hardening observations recorded by independent Code Review and Security/Privacy Review:
1. **No root `.dockerignore` and unpruned `node_modules` in `runner` images:** Root directory lacks a `.dockerignore`, and both `runner` stages copy full `node_modules` (`--chown=node:node`); `Dockerfile.clinical-api` retains `contracts:validate` as a P0 smoke `CMD` until `T10` introduces the clinical HTTP server entrypoint.
2. **Action commit-SHA pinning and scanner/fixture edge coverage:** `ci.yml` uses major tags (`@v4`/`@v3`/`@v6`, compliant with `T12-CI-001`; 40-char commit-SHA pinning recommended for `T14` hardening); `t12-policy.test.mjs` relies on `npm run ci:dry-run` rather than a dedicated mock-repo test for `ci-dry-run.mjs` and does not yet include negative fixtures for every token/workflow rule (`github_pat`, `slack_token`, `gcp_service_account_key`, `image_build_missing_gate_dependencies`, `forbidden_cloud_deploy_command`); `scanEvidenceJsonTree` and `docs/**/*.md` backtick line matching have minor future-hardening edges noted in `t12-security-privacy-review.md`.

---

## 5. Explicit Non-Claims & Final Decision

- **Explicit Non-Claims (Constitution Sections 3, 8 & 10; `T12-CI-001` Section 3):** This Evidence & Governance Review certifies **only** T12's local Cycle-2 evidence package, hash integrity, out-of-scope boundary immutability, gate independence, causal chronology, and honest disclosure of unexecuted checks. It makes **no claim** of live GitHub Actions workflow execution, online `pnpm audit` pass, local/remote Docker container compilation or Alpine runtime execution, container registry storage, PostgreSQL integration pass, OpenStack/GCP deployment, production readiness, measured latency/throughput/SLA/RPO/RTO performance, legal/regulatory compliance, or clinical safety.
- **Decision: APPROVE** — T12 satisfies Constitution Sections 4, 5, 6, 7, 8, 9, and 10 requirements for Cycle-2 canonical 9-file aggregate SHA-256 **`066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`** within its explicitly bounded local verification scope.
