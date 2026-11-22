# T04 Implementation Handoff

**Task:** T04 - Keycloak OIDC verification and backend RBAC/ABAC authorization
**Status:** TEST_PASSED
**Approval:** `docs/decisions/t04-security-approval.md` is APPROVED.
**Implementation owner:** Coding agent
**Independent tester:** Required before `TEST_PASSED`
**Data classification:** Synthetic identities and resource references only.

## Changed paths

- `apps/clinical-api/src/security/types.ts`
- `apps/clinical-api/src/security/oidc-verifier.ts`
- `apps/clinical-api/src/security/authorization.ts`
- `apps/clinical-api/src/security/redacted-audit.ts`
- `tests/security.test.ts`
- `package.json`
- `pnpm-lock.yaml`
- `vitest.config.ts`
- `tsconfig.json`
- `docs/medicloud/tasks.md`
- `docs/medicloud/t04-handoff.md`
- `docs/evidence/t04-test-report.md`
- `docs/reviews/t04-security-review.md`

## Delivered behavior

- Keycloak-compatible JWT verification using issuer-pinned JWKS, exact issuer/audience and RS256 restriction.
- Missing/malformed/invalid credentials produce a generic `AuthenticationError` with status 401.
- Claims normalize only approved roles and synthetic tenant IDs; inactive/missing-subject/missing-tenant claims are rejected.
- RBAC action matrix for patient, guardian, receptionist, physician, nurse and auditor.
- ABAC checks for active session, same tenant, self/delegation, assignment, purpose and resource state.
- Cross-tenant resources use disclosure-safe 404; unauthorized same-tenant actions use 403.
- Redacted authorization audit output contains action/reason/resource reference/correlation ID only.
- Appointment creation requires patient ownership or validated guardian delegation; clinical actions require an allowlisted purpose.
- OIDC accepts only `typ=Bearer` tokens and confirms active account state through a server-side callback, not an untrusted token claim.
- No frontend-only authorization, token logging, browser storage or break-glass bypass was added.

## Validation run

| Command | Result |
| --- | --- |
| `npm test` | PASS: 25 tests, including 14 T04 security tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS with existing non-failing App Router advisory |

## Environment limitations

- No live Keycloak realm or production credentials were used.
- Full signed-token/JWKS integration and database-backed tenant-negative tests require the T04 integration environment; unit policy and malformed-token tests are included here.
