# T05 Independent Code, Security and Evidence Review

**Task:** T05 — scheduling endpoints, capacity locking and idempotency  
**Review date:** 2026-11-22  
**Scope:** Exact current working tree, T05 decision, scheduling service, HTTP adapter, Prisma schema, contracts and tests.  
**Data scope:** Synthetic fixtures only.

## Code review result

**BLOCKED — DO NOT APPROVE.**

Release-blocking findings:

1. The HTTP request shape conflicts with the approved contract: implementation requires `channel`, while the approved create request does not define it.
2. `patient_id` is optional in the approved contract but is unconditionally required by the service.
3. Idempotency replay compares slot and patient but not channel; `bookingFingerprint()` is unused.
4. Check-in performs authorization and returns the appointment without a persisted state transition.
5. Unknown request properties are silently accepted despite `additionalProperties: false` requirements.
6. Unexpected server/database failures are returned as HTTP 400 instead of a generic server error.
7. HTTP adapter, check-in, strict-validation and error-redaction tests are missing.

Positive controls: parameterized raw SQL, tenant filters on primary reads, transactional appointment/outbox insertion, and generic disclosure-safe not-found responses.

## Security/privacy result

**BLOCKED.**

- The service selects `principal.tenantIds[0]` but does not verify active database membership or tenant-scoped role assignment.
- Outbox event payloads are inserted without validating the complete approved envelope/payload schema.
- The implementation has no connected scheduling mutation log/redaction boundary or corresponding evidence.
- Correlation IDs are not consistently validated on all adapter routes.
- The `desk` channel is inconsistent with the approved event schema’s channel values.

No real PHI/PII, bearer token or secret was observed in reviewed fixtures. This does not establish production safety.

## Evidence result

**BLOCKED/GATED.**

The available unit and integration results demonstrate useful behavior, but do not support unconditional T05 acceptance. T05-AC-05, T05-AC-06 and T05-AC-08 fail or remain blocked; T05-AC-07 and T05-AC-09 are partial/gated. Missing evidence includes HTTP behavior, strict payload rejection, tenant-specific membership, injected transaction failure, check-in state, event validation, and log/response scans.

## Status recommendation

Keep `docs/medicloud/tasks.md` T05 at `IMPLEMENTING`. Do not transition to `TEST_PASSED`, `REVIEWING`, `SECURITY_CHECK`, `EVIDENCE_CHECK`, `CONVERGING` or `COMPLETED` until the blockers are corrected and all independent gates are rerun against a complete, fingerprinted diff.

No deployment, production-readiness, legal-compliance, clinical-safety or performance claim is made.
