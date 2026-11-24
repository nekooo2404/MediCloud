import type {AuthorizationContext, AuthorizationDecision, Role} from './types.js';

const roleActions: Record<Role, readonly string[]> = {
  PATIENT: [
    'slot:read',
    'appointment:read:self',
    'appointment:create',
    'appointment:cancel:self',
    'appointment:reschedule:self',
    'record:read:self',
    'audit:read:self',
  ],
  GUARDIAN: [
    'slot:read',
    'appointment:read:delegated',
    'appointment:create',
    'appointment:cancel:delegated',
    'appointment:reschedule:delegated',
    'record:read:delegated',
  ],
  RECEPTIONIST: [
    'slot:read',
    'schedule:publish',
    'appointment:create',
    'appointment:read:tenant',
    'appointment:check-in',
    'appointment:cancel:tenant',
    'appointment:reschedule:tenant',
    'appointment:no-show:tenant',
    'queue:read:tenant',
    'queue:manage:tenant',
    'encounter:create:tenant',
    'metrics:read:tenant',
  ],
  PHYSICIAN: [
    'slot:read',
    'schedule:publish',
    'appointment:read:tenant',
    'appointment:check-in',
    'appointment:cancel:tenant',
    'appointment:reschedule:tenant',
    'appointment:no-show:tenant',
    'queue:read:tenant',
    'queue:manage:tenant',
    'encounter:read:assigned',
    'encounter:create:assigned',
    'encounter:complete:assigned',
    'encounter:cancel:assigned',
    'observation:create:assigned',
    'observation:amend:assigned',
    'record:read:tenant',
    'metrics:read:tenant',
    'audit:read:tenant',
  ],
  NURSE: [
    'slot:read',
    'appointment:read:tenant',
    'appointment:check-in',
    'queue:read:tenant',
    'queue:manage:tenant',
    'encounter:read:assigned',
    'encounter:create:assigned',
    'observation:create:assigned',
    'record:read:tenant',
  ],
  AUDITOR: ['audit:read:tenant', 'metrics:read:tenant'],
};

const allowedPurposes = new Set(['treatment', 'care_coordination', 'operations', 'audit', 'break_glass']);
const SAFE_REF_RE = /^(?:synthetic-[a-z0-9-]+|[a-z]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const SAFE_CORRELATION_RE = /^(?:synthetic-[a-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function hasValidDelegation(context: AuthorizationContext): boolean {
  const targetSubject = context.delegatedSubject ?? context.resourceOwnerSubject;
  if (!targetSubject) return false;
  return Boolean(
    context.principal.delegations?.some(
      (delegation) =>
        delegation.tenantId === context.resourceTenantId &&
        delegation.patientSubject === targetSubject &&
        !delegation.revoked &&
        Date.parse(delegation.expiresAt) > Date.now(),
    ),
  );
}

export function authorize(context: AuthorizationContext): AuthorizationDecision {
  const {principal} = context;
  const base = {action: context.action, resourceTenantId: context.resourceTenantId};
  if (
    !context.correlationId ||
    !SAFE_CORRELATION_RE.test(context.correlationId) ||
    !context.resourceRef ||
    !SAFE_REF_RE.test(context.resourceRef)
  ) {
    return deny(403, 'audit_context_required', base);
  }
  if (!principal.active) return deny(401, 'inactive_principal', base);
  if (!principal.tenantIds.includes(context.resourceTenantId)) return deny(404, 'resource_not_found', base);
  if (context.resourceStateAllowed === false) return deny(403, 'resource_state_denied', base);
  if (!principal.roles.some((role) => roleActions[role].includes(context.action))) {
    return deny(403, 'role_action_denied', base);
  }

  if (context.action === 'appointment:create') {
    const canActForTenant = principal.roles.includes('RECEPTIONIST');
    const isSelfPatient =
      principal.roles.includes('PATIENT') && Boolean(context.resourceOwnerSubject) && context.resourceOwnerSubject === principal.subject;
    const isDelegatedGuardian = principal.roles.includes('GUARDIAN') && hasValidDelegation(context);
    if (!canActForTenant && !isSelfPatient && !isDelegatedGuardian) {
      return deny(403, 'owner_or_delegation_required', base);
    }
  }

  if (context.action.endsWith(':delegated') && !hasValidDelegation(context)) {
    return deny(403, 'owner_or_delegation_required', base);
  }
  if (context.action.endsWith(':self') && context.resourceOwnerSubject !== principal.subject) {
    return deny(404, 'resource_not_found', base);
  }
  if (context.action.endsWith(':assigned') && context.assignedPractitionerSubject !== principal.subject) {
    return deny(403, 'assignment_required', base);
  }
  if (context.action.startsWith('encounter:') || context.action.startsWith('observation:')) {
    if (!context.purpose || !allowedPurposes.has(context.purpose)) {
      return deny(403, 'purpose_not_allowed', base);
    }
    if (context.purpose === 'break_glass' && !context.breakGlassReason) {
      return deny(403, 'break_glass_reason_required', base);
    }
  }
  return {allowed: true, status: 200, reason: 'allowed', audit: {...base, reason: 'allowed', resourceRef: context.resourceRef}};
}

function deny(
  status: 401 | 403 | 404,
  reason: string,
  base: Omit<AuthorizationDecision['audit'], 'reason' | 'resourceRef'>,
): AuthorizationDecision {
  return {allowed: false, status, reason, audit: {...base, reason, resourceRef: 'synthetic-redacted-resource'}};
}
