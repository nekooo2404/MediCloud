# T12 CI Quality, Dependency/Secret Scan, and Immutable Image Policy Approval

**Decision ID:** T12-CI-001
**Status:** APPROVED
**Requested approver:** Project owner
**Accountable owner:** Project owner
**Implementation boundary:** `.github/`, `package.json`, `docs/`
**Dependencies:** `T01–T06`, `T08`, `T09` (`TEST_PASSED`); `T07` remains `BLOCKED: GCP access`
**Data policy:** Synthetic data only. CI scripts and workflow definitions must fail on real PHI/PII markers, unredacted credentials/keys, unpinned/drifted dependencies, or mutable `:latest` container tags.

## 1. Approved Decisions (Clarify Record A1–A2)

1. **Unlocked Partial-Backlog Scope (`A1`):**
   - Unlock T12 from `GATED: CI policy approval` -> `READY` -> `IMPLEMENTING` covering all `TEST_PASSED` components (`apps/patient-portal`, `apps/clinical-api`, `apps/event-relay`, `packages/contracts`, `tools/medicloud-agent-company`).
   - Keep `T07` (`apps/cloud-worker/`) explicitly `BLOCKED: GCP access`; cloud-worker CI steps and live cloud push/deploy jobs remain excluded until `T07`, `T10`, `T11`, and `T15` prerequisites and approvals exist.

2. **CI Workflow, Scanners, and Immutable Image Layout (`A2`):**
   - Keep every T12 file strictly inside `.github/`, `package.json`, and `docs/`:
     - **Workflow (`.github/workflows/ci.yml`):** Top-level `permissions: contents: read`, deterministic `pnpm install --frozen-lockfile`, sequential `quality` and `security-scan` gates before `immutable-image-build`, immutable commit SHA image tagging (`sha-${{ github.sha }}`, never `:latest`), `push: false`, zero cloud credentials or live deploy steps.
     - **Secret & PHI/Synthetic Policy Scanner (`.github/scripts/secret-and-phi-scan.mjs`):** Fails on forbidden secret files (`.env*` excluding `.env.example`, private keys, credential JSONs), private key/cloud/GitHub/Slack/unredacted Postgres credential patterns, and synthetic-policy violations (`packages/contracts/data-classification.json`), without echoing matched secret content.
     - **Supply-Chain & Dependency Audit (`.github/scripts/dependency-audit.mjs`):** Enforces pinned `packageManager`, `engines.node`, deterministic semver ranges (no `*`, `latest`, `file:`, `link:`, `git+`, `http(s)`), `pnpm-lock.yaml` v9.0 specifier parity (`0` lockfile drift), `sha512-` integrity hashes on all resolved packages, and malicious/deprecated package blocklist checks (plus `pnpm audit --audit-level=high` inside online GitHub Actions security job).
     - **Multi-Stage Immutable Dockerfiles (`.github/docker/Dockerfile.patient-portal`, `.github/docker/Dockerfile.clinical-api`) & Verifier (`.github/scripts/verify-immutable-images.mjs`):** Pin base image to registry-verified OCI index digest (`node:22.15.0-alpine3.21@sha256:ad1aedbcc1b0575074a91ac146d6956476c1f9985994810e4ee02efd932a68fd`), require OCI labels (`org.opencontainers.image.revision`), run `--frozen-lockfile`, exclude `.env*`/evidence/secrets, drop root (`USER node`), and verify `ci.yml` compliance.
     - **Local CI Dry-Run Runner (`.github/scripts/ci-dry-run.mjs` & `package.json` `ci:*` scripts):** Executes `contracts:validate`, `typecheck`, `lint`, `ci:lint:all`, `ci:scan:secrets`, `ci:scan:deps`, `ci:verify-images`, `test`, `build`, and `astryx doctor --built apps/patient-portal`.

## 2. Required Post-Approval Evidence & Gates

- Independent `quality.tester` `TestReport` (`docs/evidence/t12-test-report.md`) and observed dry-run/scan report (`docs/evidence/t12-ci-dry-run-and-scan-report.md`) tied strictly to canonical 9-file SHA-256 fingerprint (`.github/docker/*`, `.github/scripts/*` including `t12-policy.test.mjs`, `.github/workflows/ci.yml`, and `package.json`).
- Independent Code Review (`docs/reviews/t12-code-review.md`), Security/Privacy Review (`docs/reviews/t12-security-privacy-review.md`), and Evidence Review (`docs/reviews/t12-evidence-review.md`).

## 3. Explicit Non-Claims

This approval covers local T12 workflow authoring, deterministic scanners, immutable Dockerfile authoring/verification, and local CI dry-run verification only. It does **not** approve or claim live GitHub Actions runner execution, live Docker container build/push/registry storage (when local Docker daemon is stopped), OpenStack/GCP deployment, legal compliance, clinical safety, or measured SLA performance.

## Approval record

**Decision:** APPROVED
**Approver:** Project owner (Clarify answers A1–A2)
**Timestamp (+07:00):** 2026-11-23
**Approval text:** Approved via interactive project-owner clarification (`A1` and `A2`) to unlock T12 (`GATED: CI policy approval` -> `READY` -> `IMPLEMENTING`) strictly within `.github/`, `package.json`, and `docs/`.
