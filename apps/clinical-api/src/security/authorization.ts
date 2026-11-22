import type {AuthorizationContext, AuthorizationDecision, Role} from './types.js';

const roleActions: Record<Role, readonly string[]> = {
  PATIENT: ['slot:read', 'appointment:read:self', 'appointment:create', 'record:read:self'],
  GUARDIAN: ['slot:read', 'appointment:read:delegated', 'appointment:create', 'record:read:delegated'],
  RECEPTIONIST: ['slot:read', 'appointment:create', 'appointment:read:tenant', 'appointment:check-in'],
  PHYSICIAN: ['slot:read', 'encounter:read:assigned', 'encounter:create:assigned', 'observation:create:assigned'],
  NURSE: ['slot:read', 'encounter:read:assigned', 'observation:create:assigned'],
  AUDITOR: ['audit:read:tenant', 'metrics:read:tenant'],
};
const allowedPurposes = new Set(['treatment', 'care_coordination', 'operations', 'audit']);

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
  if (!context.correlationId || !/^synthetic-[a-z0-9-]+$/.test(context.correlationId) || !context.resourceRef || !/^synthetic-[a-z0-9-]+$/.test(context.resourceRef)) return deny(403, 'audit_context_required', base);
  if (!principal.active) return deny(401, 'inactive_principal', base);
  if (!principal.tenantIds.includes(context.resourceTenantId)) return deny(404, 'resource_not_found', base);
  if (context.resourceStateAllowed === false) return deny(403, 'resource_state_denied', base);
  if (!principal.roles.some((role) => roleActions[role].includes(context.action))) return deny(403, 'role_action_denied', base);
  if (context.action === 'appointment:create' && principal.roles.includes('PATIENT') && context.resourceOwnerSubject !== principal.subject) return deny(403, 'owner_or_delegation_required', base);
  if (context.action === 'appointment:create' && principal.roles.includes('GUARDIAN') && !hasValidDelegation(context)) return deny(403, 'owner_or_delegation_required', base);
  if (context.action.endsWith(':delegated') && !hasValidDelegation(context)) return deny(403, 'owner_or_delegation_required', base);
  if (context.action.endsWith(':self') && context.resourceOwnerSubject !== principal.subject) return deny(404, 'resource_not_found', base);
  if (context.action.endsWith(':assigned') && context.assignedPractitionerSubject !== principal.subject) return deny(403, 'assignment_required', base);
  if (context.action.startsWith('encounter:') || context.action.startsWith('observation:')) {
    if (!context.purpose || !allowedPurposes.has(context.purpose)) return deny(403, 'purpose_not_allowed', base);
  }
  return {allowed: true, status: 200, reason: 'allowed', audit: {...base, reason: 'allowed', resourceRef: context.resourceRef!}};
}

function deny(status: 401 | 403 | 404, reason: string, base: Omit<AuthorizationDecision['audit'], 'reason' | 'resourceRef'>): AuthorizationDecision {
  return {allowed: false, status, reason, audit: {...base, reason, resourceRef: 'synthetic-redacted-resource'}};
}
