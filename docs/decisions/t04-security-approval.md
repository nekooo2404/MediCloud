# T04 OIDC and Authorization Security Approval

**Decision ID:** T04-SECURITY-001
**Status:** APPROVED
**Requested approver:** Project owner
**Implementation boundary:** `apps/clinical-api/`, `tests/`, `docs/`
**Dependencies:** T02 contracts and T03 schema are `TEST_PASSED`.
**Data policy:** Synthetic data only; no real PHI/PII or secrets.

## Approval requested

Approve the T04 security design for Keycloak OIDC token verification and backend RBAC/ABAC authorization. This approval permits implementation and security testing only; it does not approve production deployment, real data, legal compliance or clinical use.

## 1. Authentication contract

- Validate JWT signature using issuer JWKS with controlled refresh and no arbitrary remote issuer.
- Validate exact `iss`, `aud`, `exp`, `nbf` when present, token type and active account state.
- Reject missing, malformed, expired, wrong-issuer, wrong-audience and invalid-signature tokens with `401`.
- Never log bearer tokens, cookies, authorization headers or raw claims beyond approved subject/tenant audit references.
- Keep browser tokens out of localStorage/sessionStorage; use the approved server-side/session-cookie approach when the Portal is implemented.
- Keycloak issuer, audience and JWKS URL come from secret/configured environment, never client input.

## 2. Authorization model

### RBAC roles

`PATIENT`, `GUARDIAN`, `RECEPTIONIST`, `PHYSICIAN`, `NURSE`, `AUDITOR`.

Role grants are only a starting point. No role is a global bypass, including auditor or platform operations.

### ABAC decision

```text
allow = valid_session
     AND active_membership
     AND same_tenant
     AND permitted_action
     AND scope_match
     AND purpose_allowed
     AND resource_state_allowed
```

Clinical access additionally requires an authorized treatment relationship, assignment or explicit approved workflow exception. Uncertain decisions default to deny.

## 3. Mandatory security rules

- `tenant_id` is derived from validated membership/session context, never trusted from a client-only field.
- Every repository lookup for tenant-owned data includes tenant scope and ownership/assignment conditions where applicable.
- Patient/guardian access is limited to self or valid delegation.
- Receptionist can schedule/check-in within tenant but cannot read clinical content by default.
- Physician/nurse access requires same tenant plus assignment/treatment relationship.
- Auditor can read restricted audit views only and cannot mutate clinical data or audit history.
- Cross-tenant access returns `403` or disclosure-safe `404` without revealing record existence.
- Frontend visibility checks are UX only; backend guards/policies are authoritative.
- Break-glass is out of T04 P0 scope unless separately approved; no emergency bypass is implemented.

## 4. Required tests and evidence

- Valid token succeeds.
- Wrong issuer, audience, signature, expiry, missing token and inactive user return `401`.
- Patient A cannot read or mutate tenant B records.
- Patient cannot access another patient’s record.
- Receptionist cannot read clinical content.
- Physician outside assignment is denied and an audit event records action/reason safely.
- Auditor cannot mutate clinical data or audit events.
- Query tenant selector cannot expand server-derived scope.
- Error responses contain correlation ID but no token, PHI/PII, stack trace or raw claims.
- Tests are tied to the exact implementation diff and reviewed independently.

## 5. Risks and non-goals

- Keycloak deployment/configuration is not part of this approval; credentials and realm evidence remain environment-gated.
- This does not certify OAuth/OIDC configuration, legal compliance, clinical safety or production readiness.
- Security tests use synthetic identities and database records only.
- Any change to roles, tenant boundary, token validation, data exposure or break-glass behavior requires a new approval or security decision.

## Approval record

**Decision:** APPROVED
**Approver:** Project owner
**Timestamp (+07:00):** 2026-11-21
**Approval text:** I approve `T04-SECURITY-001`, with the scope and conditions outlined in `docs/decisions/t04-security-approval.md`.
**Conditions/exceptions:** No production deployment, real data, legal compliance, clinical safety certification or break-glass bypass is approved by this decision.
