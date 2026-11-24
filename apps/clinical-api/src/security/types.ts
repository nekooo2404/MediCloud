export const ROLES = ['PATIENT', 'GUARDIAN', 'RECEPTIONIST', 'PHYSICIAN', 'NURSE', 'AUDITOR'] as const;
export type Role = (typeof ROLES)[number];

export interface AuthenticatedPrincipal {
  subject: string;
  issuer: string;
  audience: string | string[];
  roles: readonly Role[];
  tenantIds: readonly string[];
  delegations?: readonly {
    tenantId: string;
    patientSubject: string;
    scope?: string;
    expiresAt: string;
    revoked: boolean;
  }[];
  active: boolean;
  organizationId?: string;
  departmentId?: string;
}

export interface AuthorizationContext {
  principal: AuthenticatedPrincipal;
  action: string;
  resourceTenantId: string;
  resourceOwnerSubject?: string;
  delegatedSubject?: string;
  resourceRef?: string;
  correlationId?: string;
  assignedPractitionerSubject?: string;
  purpose?: string;
  resourceStateAllowed?: boolean;
  breakGlassReason?: string;
}

export interface AuthorizationDecision {
  allowed: boolean;
  status: 200 | 401 | 403 | 404;
  reason: string;
  audit: {action: string; reason: string; resourceTenantId: string; resourceRef: string};
}
