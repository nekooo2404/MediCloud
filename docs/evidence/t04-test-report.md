# T04 Independent Security Test Report

**Task:** T04 - Keycloak OIDC verification and backend RBAC/ABAC authorization  
**Decision:** `T04-SECURITY-001` (APPROVED)  
**Test date:** 2026-11-21 19:11:15 +07:00  
**Tester scope:** Fresh final retest after audit-redaction fix; implementation was not modified.  
**Data scope:** Synthetic identities and resource references only.

## Result

**PASS** for the current unit/static security implementation. Live Keycloak/JWKS and database-backed integration checks remain **environment-gated** and are not represented as passing.

## Command Checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test -- --run` | PASS | Exit `0`; 3 test files, `25/25` tests passed, including T04 security tests |
| `npm run typecheck` | PASS | Exit `0`; `tsc --noEmit` completed successfully |
| `npm run lint` | PASS | Exit `0`; only the existing non-failing App Router `no-html-link-for-pages` advisory was emitted |

## Required Security Checks

| Requirement | Result | Evidence |
| --- | --- | --- |
| Protected JWT header `typ` | PASS | Verifier reads `protectedHeader.typ` and requires `Bearer`; it does not trust a payload claim |
| Issuer, audience, JWKS and RS256 | PASS (static) | `jwtVerify` uses configured issuer/audience, remote JWKS and `algorithms: ['RS256']` |
| Server active-account callback | PASS | `isActiveSubject(subject)` is awaited; false rejects authentication |
| Missing/malformed bearer token | PASS | Unit tests verify generic `401` authentication failure |
| Active same-tenant delegation | PASS | Guardian delegation requires matching tenant, patient subject, unrevoked state and future expiry |
| Expired/revoked delegation | PASS | Unit tests reject expired and revoked delegation |
| Patient ownership | PASS | Patient appointment creation rejects a different resource owner |
| Purpose allowlist | PASS | Clinical actions accept only `treatment`, `care_coordination`, `operations`, or `audit` |
| Formatted audit context | PASS | Authorization requires `synthetic-*` `correlationId` and `resourceRef`; malformed/spoofed values are denied |
| Denial resource redaction | PASS | Denied decisions use `synthetic-redacted-resource` and do not echo caller-supplied raw resource references |
| Audit output redaction | PASS | Output contains only action, reason, resource reference and correlation ID; no bearer token or raw claims |
| Tenant isolation | PASS | Resource outside principal tenant scope returns disclosure-safe `404` |
| Assignment and role boundaries | PASS | Unassigned practitioners and unsupported role/action combinations are denied |

## Environment-Gated Checks

The following were not run and remain explicitly **environment-gated**:

- Live signed-token verification against a running Keycloak realm and reachable JWKS endpoint.
- Live wrong-issuer, wrong-audience, expired-token and invalid-signature fixtures.
- Database-backed tenant-negative queries and repository authorization enforcement.
- Live audit persistence and redaction integration.

This report does not claim production readiness, Keycloak deployment, database runtime authorization, legal compliance or clinical safety.

## Current-Diff Fingerprints

SHA-256 fingerprints captured at test time:

```text
apps/clinical-api/src/security/oidc-verifier.ts: FA601EF4E1D1BB4DC77AF4D3509BF13B7955C84EC8CDA9F8501E502E3EECB67B
apps/clinical-api/src/security/authorization.ts: 6AAE73691D01CFF36B8C4815C9BA0F1A542DE09DB3EDFA1AFC11AA9809690E75
apps/clinical-api/src/security/redacted-audit.ts: 39A4051E80FA6202814B71C81E09DD4285E3FCDCC6C7BBA9F59298F61BD7D942
tests/security.test.ts: 7DA026C609B4D3F4AAA323B8A1C428AAC3F33FE22F89F0697B425CCB0CD68D76
```

No real PHI/PII, secrets, bearer tokens or production credentials were used.
