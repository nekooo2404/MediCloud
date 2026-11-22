# T12 Implementation Handoff

**Task:** T12 — CI Quality, Dependency/Secret Scan, and Immutable Image Build  
**Decision:** `T12-CI-001` — `APPROVED` (`docs/decisions/t12-ci-policy-approval.md`)  
**Status:** `TEST_PASSED` (All 4 independent Cycle-2 gates passed/approved for canonical 9-file aggregate SHA-256 `066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38` within verified local scope)  
**Accountable owner:** Project owner  
**Implementation owner:** Coding agent  
**Independent tester:** `t12_quality_tester` (`35282c84-d2cc-4c2c-93ab-d39bdc1d290c`)  
**Canonical 9-file diff fingerprint (SHA-256):** `066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`  
**Data classification:** Synthetic data only (`packages/contracts/data-classification.json`). No secrets, keys, tokens, real credentials, or PHI/PII.

## Canonical 9-file source & test manifest

Canonical manifest uses `path=lowercase_sha256` lines joined by `\n` (UTF-8 without BOM), sorted lexicographically by path:

**Aggregate SHA-256:** `066a02f84fde9f8b067e031814c0ce4cc3c50eff902af51542444112b117ac38`

| Path | SHA-256 |
|---|---|
| `.github/docker/Dockerfile.clinical-api` | `a7264bc2112a379971885aee0c48db41da4617b4ac2686cd0d86281675122ab6` |
| `.github/docker/Dockerfile.patient-portal` | `caa96fa789a96d7bbe8dd3968d86860e6ce82bcd4e143302b4101ffadd51ce59` |
| `.github/scripts/ci-dry-run.mjs` | `862be9d0cef7488a1c9b837eb47fedf0df2688ef7d68917f10754155b2dfbb92` |
| `.github/scripts/dependency-audit.mjs` | `10a1709f8ac1ccca1864b07e455da001566a21df98a272f2de0853c99533e4dd` |
| `.github/scripts/secret-and-phi-scan.mjs` | `5acc9dfe0abb0d13ea64e6f7f041028531c53355d75965c62448be6c2138965f` |
| `.github/scripts/t12-policy.test.mjs` | `d452a79f1227db0387ca8406dc68e2ca335b437fc00c21f9de4c62c617367aa7` |
| `.github/scripts/verify-immutable-images.mjs` | `1a119659163794ccd2943ac9914153e099f5ab32096778f8dec0c0f833ffa177` |
| `.github/workflows/ci.yml` | `570675e1631dc9365baed14c1358e39f075f46d01c1e19074a6763c2fc509642` |
| `package.json` | `b639915f6ccfd1e68cf15c6d84bb4f4ea57289671a5d4bcde6f8bd69d10963e3` |

## Cycle-2 remediations applied since Cycle 1 (`2db63755...` -> `066a02f8...`)

1. **`[BLOCKING-1]` Fixed `.github/docker/Dockerfile.clinical-api` `runner` entrypoint:**
   - Replaced `CMD ["pnpm", "run", "contracts:validate"]` with direct Node invocation `CMD ["node", "packages/contracts/validate.mjs"]` so `runner` executes cleanly as `USER node` with zero Corepack/`pnpm` runtime dependency, and clarified `ENV PORT=4000` / `EXPOSE 4000` as placeholders for `T10` HTTP bootstrap.
2. **`[BLOCKING-2]` Fixed `.github/docker/Dockerfile.patient-portal` `runner` Corepack cache mismatch:**
   - Removed root-level `corepack enable && corepack prepare` from `runner` and switched to direct Node invocation `CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/patient-portal", "-p", "3000"]`, avoiding `/root/.cache` misses and outbound npm registry fetches under `USER node`.
3. **Hardening & policy precision:**
   - `verify-immutable-images.mjs`: verifies final-stage `USER node`, prohibits `pnpm`/`npm`/`npx`/`corepack` in final `CMD`/`ENTRYPOINT`, prohibits `ADD` and `COPY . .`, checks job-level `permissions` overrides, enforces `push: false` and `load: false`, and guards missing `ci.yml`.
   - `dependency-audit.mjs`: enforces `sha512-` integrity hashes, normalizes peer suffixes on `BLOCKED_PACKAGE_VERSIONS`, and guards missing `package.json`.
   - `secret-and-phi-scan.mjs`: adds `ENCRYPTED PRIVATE KEY`, requires balanced `<placeholder>` tokens or non-local safe markers (`redacted`/`placeholder`/`synthetic`) for remote DB URIs, recurses `docs/evidence/**/*.json`, and safely isolates bare inline-backtick header references in `docs/**/*.md` without PEM footers.
   - `ci-dry-run.mjs`: restricts `useDirectNpmCli` check to `basename === 'npm-cli.js'` and surfaces `proc.error?.message`.
   - `t12-policy.test.mjs` & `docs/decisions/t12-ci-policy-approval.md`: expanded negative test cases and aligned decision-record manifest count to `9` files.

## Commands run by implementation owner (Cycle 2)

- `npm run ci:dry-run` (`11/11` stages `PASS`, exit `0`, zero `DEP0190` warnings) -> detailed results in `docs/evidence/t12-ci-dry-run-and-scan-report.md`
- `npm run ci:scan:secrets` -> exit `0` (`169` files scanned, `0` findings)
- `npm run ci:scan:deps` -> exit `0` (`450` locked packages / `450` snapshots verified, strict `sha512-`, `0` drift)
- `npm run ci:verify-images` -> exit `0` (`2` Dockerfiles + `ci.yml` verified)
- `npm run ci:test` -> exit `0` (`3/3` policy test suites passed)

## Not run & explicit limitations

- Local Docker Desktop daemon (`docker info` exit `1`) is stopped; live `docker build` / `docker run` was not executed locally (registry OCI index digest `sha256:ad1aedbcc1b0575074a91ac146d6956476c1f9985994810e4ee02efd932a68fd` verified via `docker buildx imagetools inspect node:22.15.0-alpine3.21`).
- `DATABASE_URL` is unset (`21` PostgreSQL integration tests skipped in `npm test`).
- Live GitHub Actions execution (`pnpm audit --audit-level=high`, `actions/*`, `docker/build-push-action`) was not run; `T07`, `T10`, `T11`, `T13` remain `BLOCKED`.
- `apps/`, `packages/`, `tests/`, and `pnpm-lock.yaml` remain unmodified by T12.

## Independent Gate Results (Cycle 2 — `066a02f8...`)

1. **Independent Tester (`quality.tester`):** `PASS` — [docs/evidence/t12-test-report.md](../evidence/t12-test-report.md) (`t12_quality_tester`, `35282c84-d2cc-4c2c-93ab-d39bdc1d290c`)
2. **Independent Code Review:** `APPROVE` — [docs/reviews/t12-code-review.md](../reviews/t12-code-review.md) (`t12_code_reviewer`, `af85e478-dccd-48dd-887c-fb702e194c87`)
3. **Independent Security & Privacy Review:** `APPROVE` — [docs/reviews/t12-security-privacy-review.md](../reviews/t12-security-privacy-review.md) (`t12_security_reviewer`, `987054d2-c929-435d-86e4-72e87ff77850`)
4. **Independent Evidence & Governance Review:** `APPROVE` — [docs/reviews/t12-evidence-review.md](../reviews/t12-evidence-review.md) (`t12_evidence_reviewer`, `0c8af078-d8a9-4d67-afd1-ae2ce4fbbff8`)
