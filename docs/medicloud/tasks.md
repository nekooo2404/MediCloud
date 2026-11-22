# MediCloud P0 Task Plan

**Status:** READY for task clarification and planning; no application implementation has started.
**Accountable owner:** Project owner
**Implementation owner:** Assigned coding agent per task
**Independent tester:** `quality.tester` session/person, not the implementation owner

## Task rules

- Each task must declare its allowed paths before implementation.
- Each task gets a Tester step and a TestReport tied to its exact diff.
- Schema, API/event contract, authorization, data-flow and deployment tasks require independent review and evidence.
- Use synthetic data only.
- A task depending on unavailable cloud access remains `BLOCKED` until the dependency is supplied.

## Ordered backlog

| ID | Task | Allowed paths | Depends on | State | Required tester check |
| --- | --- | --- | --- | --- | --- |
| T01 | Establish app workspace and Next.js/React 19/Astryx foundation. | `apps/patient-portal/`, `package.json`, `pnpm-lock.yaml`, `docs/` | Q12 decisions | TEST_PASSED | Independent TestReport, browser evidence, code review and warning dispositions |
| T02 | Define shared API/event contracts and data classification. | `packages/contracts/`, `docs/` | T01 + approved `docs/decisions/t02-contract-approval.md` | TEST_PASSED | Independent TestReport, contract review and evidence |
| T03 | Implement PostgreSQL/Prisma schema, migrations and synthetic seeds. | `apps/clinical-api/`, `packages/`, `tests/`, `docs/` | T02 + approved `docs/decisions/t03-schema-approval.md` | TEST_PASSED | Independent TestReport, schema review and database evidence |
| T04 | Implement Keycloak OIDC verification and backend authorization. | `apps/clinical-api/`, `tests/`, `docs/` | T02 + approved `docs/decisions/t04-security-approval.md` | TEST_PASSED | Independent TestReport, security review and environment limitations |
| T05 | Implement scheduling endpoints, capacity locking and idempotency. | `apps/clinical-api/`, `tests/`, `packages/contracts/` | T03, T04 + approved API/check-in decisions | TEST_PASSED | Independent TestReport, code review, security/privacy review and evidence |
| T06 | Implement transactional outbox, policy gateway and relay. | `apps/clinical-api/`, `apps/event-relay/`, `packages/contracts/`, `tests/` | T03, T05 + approved `docs/decisions/t06-dataflow-approval.md` | TEST_PASSED | Atomicity, allowlist, retry and rejected-payload tests |
| T07 | Implement GCP worker, Pub/Sub subscription and idempotency store. | `apps/cloud-worker/`, `infra/gcp/`, `tests/`, `docs/` | T02, T06 | BLOCKED: GCP access | Replay, dead-letter and redacted-log tests |
| T08 | Implement patient/staff Portal flows using Astryx components and theme. | `apps/patient-portal/`, `docs/`, `.agents/skills/`, `themes/medicloud/`, `src/themes/medicloud/`, `astryx-themes.ts`, `tests/portal-bff.test.ts`, `output/playwright/t08_browser_check.py` | T01, T05 + `T08-PORTAL-001` | TEST_PASSED | Browser tests at desktop/tablet/mobile; loading/empty/error/degraded states; independent TestReport, code/security/evidence review |
| T09 | Implement encounter, Observation, audit and private HAPI FHIR adapter. | `apps/clinical-api/`, `packages/contracts/`, `tests/`, `docs/` | T03, T04 + `T09-CLINICAL-001` | TEST_PASSED | Authorization, FHIR conformance fixture and audit tests |
| T10 | Add Docker Compose deployment for OpenStack P0 VMs. | `deployments/private/`, `infra/openstack/`, `docs/` | T03, T04, T06, T09 | BLOCKED: OpenStack access | Dry-run, private network check, health checks and backup check |
| T11 | Add Cloud Run, Pub/Sub, IAM, budget alert and network IaC. | `infra/gcp/`, `deployments/gcp/`, `docs/` | T07, T08 | BLOCKED: GCP/billing access | Terraform/manifest validation and least-privilege review |
| T12 | Add CI quality, dependency/secret scan and immutable image build. | `.github/`, `package.json`, `docs/` | T01-T06, T08, T09 + `T12-CI-001` (`T07 BLOCKED: GCP access`) | TEST_PASSED | CI dry-run, test/lint/typecheck and scan reports |
| T13 | Run integrated staging workflow and collect evidence. | `docs/evidence/`, `tests/`, `docs/` | T07-T12 | BLOCKED: cloud environments | TC01-TC12 with timestamped artifacts |
| T14 | Independent security, architecture and evidence review. | `docs/reviews/`, `docs/evidence/` | T13 | BLOCKED: T13 evidence | Independent review reports and risk disposition |
| T15 | Production deployment and post-deploy smoke test. | `infra/`, `deployments/`, `docs/evidence/` | T14 + production approval | BLOCKED: all gates | Revision/resource evidence, smoke test and rollback readiness |

## Definition of ready

A task may move to `IMPLEMENTING` only when its prerequisites, owner, allowed paths, acceptance mapping, data classification, test plan, evidence plan and required approvals are recorded.

## Definition of done

A task is not complete until implementation handoff, independent TestReport, code review, security/privacy checks where applicable, evidence check and acceptance mapping are all present. “Designed” and “implemented” must not be reported as “deployed” or “measured”.
