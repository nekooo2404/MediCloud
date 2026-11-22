# MediCloud P0 Specification

**Status:** SPECIFIED; implementation has not started.
**Owner:** Project owner
**Implementation boundary:** `apps/`, `packages/`, `infra/`, `deployments/`, `tests/`, `docs/`
**Data classification:** Synthetic data only. No real PHI/PII, credentials, tokens, private keys, or patient-record content.

## 1. Outcome

Deliver a reproducible P0 demonstration of one MediCloud workflow crossing GCP and OpenStack:

`OIDC login -> GCP Portal/BFF -> private OpenStack Clinical API -> PostgreSQL appointment -> transactional outbox -> approved event relay -> GCP Pub/Sub/worker -> audit and synthetic FHIR record`

Production deployment is permitted only after the implementation, independent testing, review, security, evidence, and deployment gates pass. Localhost or mocks may support development but cannot prove multi-cloud deployment.

## 2. In Scope

- Patient Portal and BFF built with Next.js, React 19+, TypeScript and Astryx.
- Clinical API as a modular NestJS application.
- PostgreSQL with Prisma migrations and synthetic seed data.
- Keycloak OIDC authentication.
- Backend authorization using RBAC plus tenant, membership, assignment, purpose and resource-state checks.
- Appointment search, booking, retrieval and check-in.
- Encounter creation and synthetic Observation entry.
- Transactional outbox, policy allowlist, relay and idempotent worker.
- GCP Pub/Sub integration and dead-letter/retry configuration where available.
- Audit events without PHI/PII payloads.
- HAPI FHIR R4 adapter in the private boundary.
- Docker-based P0 deployment on OpenStack VMs and Cloud Run deployment for the GCP workload.
- Observability with correlation IDs, structured redacted logs and traces.
- Synthetic data fixtures, automated tests and evidence collection.

## 3. Explicit Non-Goals

- Real patient data or clinical production use.
- Autonomous diagnosis, prescription, emergency or treatment decisions.
- Full implementation of all 19 modules.
- Production LIS/PACS/DICOM, Orthanc/OHIF, telehealth, payment, insurance or inpatient workflows.
- HA VPN/BGP, K3s, BigQuery historical analytics and advanced AI before P0 evidence exists.
- Legal, regulatory, clinical-safety or SLA certification.

## 4. Functional Acceptance Criteria

| ID | Acceptance criterion | Required evidence |
| --- | --- | --- |
| AC-01 | A valid Keycloak token is accepted; invalid issuer, audience, signature or expiry returns 401. | Integration test output and redacted auth configuration |
| AC-02 | A patient can list permitted slots and create an appointment through the GCP entry point. | E2E trace, API response and OpenStack DB record |
| AC-03 | Booking is transactional and cannot exceed slot capacity under concurrency. | Database assertion and concurrency test report |
| AC-04 | Reusing an `idempotency_key` returns the original result and creates no second appointment. | API test and DB uniqueness assertion |
| AC-05 | Tenant A cannot read or mutate tenant B data. | Negative authorization test with 403/404 and audit record |
| AC-06 | A clinician can create an assigned encounter and synthetic Observation only within allowed scope. | E2E result and audit record |
| AC-07 | Appointment and outbox event are committed atomically. | Transaction test and outbox row evidence |
| AC-08 | Only allowlisted event metadata crosses the cloud boundary; PHI/PII/tokens are rejected and not logged. | Policy tests, payload scan and redacted logs |
| AC-09 | Duplicate delivery is harmless because the worker processes `event_id` idempotently. | Replay test, unique constraint and worker report |
| AC-10 | A private connectivity failure produces an explicit degraded/timeout state and never displays false confirmation. | Failure test, UI capture and logs |
| AC-11 | FHIR Patient/Encounter/Observation synthetic resources can be created or queried in the private HAPI FHIR service. | API test and FHIR response fixture |
| AC-12 | Backup and restore of the synthetic PostgreSQL dataset are executable and measured. | Backup command, restore log, checksum and timestamp |

## 5. Non-Functional Requirements

- Deny-by-default backend authorization; UI visibility is not a security boundary.
- `tenant_id` comes from a server-validated identity/membership, never an untrusted client field.
- Private PostgreSQL has no public exposure.
- Secrets come from a secret manager or CI environment and never from committed files.
- Every cross-service request carries a correlation/trace identifier.
- Logs and events are redacted and contain no PHI/PII or access tokens.
- UI supports keyboard navigation, visible focus, clear validation, loading, empty, error and degraded-network states.
- Performance values are reported only after real measurement with environment, region, version, load and network state recorded.

## 6. Required Gates

Every implementation task must pass `Ownership -> Tester -> Code Review -> Evidence`. Depending on changed paths, activate architecture, schema, authorization, security/privacy, infrastructure, deployment and clinical-boundary gates. A missing environment or credential is `BLOCKED`, never `PASS`.

## 7. Open Prerequisites

- GCP project, billing account, quota and deploy service account.
- OpenStack endpoint, project, quota, image and deploy credentials.
- Approved production domain/TLS approach.
- Secret manager/Vault access.
- Independent tester and reviewer identities.
- Production deployment approval after all pre-production gates.
