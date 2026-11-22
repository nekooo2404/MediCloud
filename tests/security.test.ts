import {describe, expect, it} from 'vitest';
import {authorize} from '../apps/clinical-api/src/security/authorization.js';
import {toAuthorizationAudit} from '../apps/clinical-api/src/security/redacted-audit.js';
import {redactedMutationLog} from '../apps/clinical-api/src/security/redacted-log.js';
import {AuthenticationError, createOidcVerifier} from '../apps/clinical-api/src/security/oidc-verifier.js';
import type {AuthenticatedPrincipal} from '../apps/clinical-api/src/security/types.js';

const principal = (overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal => ({
  subject: 'synthetic-user-a', issuer: 'https://keycloak.synthetic', audience: 'medicloud-api', roles: ['PHYSICIAN'], tenantIds: ['synthetic-hospital-a'], active: true, ...overrides,
});

describe('T04 RBAC/ABAC authorization', () => {
  it('rejects a missing bearer token with 401 before network access', async () => {
    const verify = createOidcVerifier({issuer: 'https://keycloak.synthetic', audience: 'medicloud-api', jwksUrl: 'https://keycloak.synthetic/jwks', isActiveSubject: async () => true});
    await expect(verify(undefined)).rejects.toBeInstanceOf(AuthenticationError);
  });
  it('rejects a malformed bearer token with 401', async () => {
    const verify = createOidcVerifier({issuer: 'https://keycloak.synthetic', audience: 'medicloud-api', jwksUrl: 'https://keycloak.synthetic/jwks', isActiveSubject: async () => true});
    await expect(verify('Bearer malformed')).rejects.toBeInstanceOf(AuthenticationError);
  });
  const resource = {resourceRef: 'synthetic-resource-1', correlationId: 'synthetic-correlation'};
  it('allows an assigned physician with purpose', () => expect(authorize({principal: principal(), action: 'observation:create:assigned', resourceTenantId: 'synthetic-hospital-a', assignedPractitionerSubject: 'synthetic-user-a', purpose: 'treatment', ...resource}).allowed).toBe(true));
  it('requires patient ownership for appointment creation', () => expect(authorize({principal: principal({roles: ['PATIENT']}), action: 'appointment:create', resourceTenantId: 'synthetic-hospital-a', resourceOwnerSubject: 'synthetic-user-b', ...resource}).status).toBe(403));
  it('requires an allowed purpose', () => expect(authorize({principal: principal(), action: 'observation:create:assigned', resourceTenantId: 'synthetic-hospital-a', assignedPractitionerSubject: 'synthetic-user-a', purpose: 'unapproved', ...resource}).status).toBe(403));
  it('requires an active same-tenant guardian delegation', () => expect(authorize({principal: principal({roles: ['GUARDIAN'], delegations: [{tenantId: 'synthetic-hospital-b', patientSubject: 'synthetic-patient', expiresAt: '2999-01-01T00:00:00Z', revoked: false}]}), action: 'appointment:create', resourceTenantId: 'synthetic-hospital-a', resourceOwnerSubject: 'synthetic-patient', ...resource}).status).toBe(403));
  it('rejects expired or revoked delegation', () => expect(authorize({principal: principal({roles: ['GUARDIAN'], delegations: [{tenantId: 'synthetic-hospital-a', patientSubject: 'synthetic-patient', expiresAt: '2020-01-01T00:00:00Z', revoked: true}]}), action: 'appointment:create', resourceTenantId: 'synthetic-hospital-a', resourceOwnerSubject: 'synthetic-patient', ...resource}).status).toBe(403));
  it('rejects spoofed audit context without echoing caller resource data', () => {
    const decision = authorize({principal: principal(), action: 'slot:read', resourceTenantId: 'synthetic-hospital-a', resourceRef: 'raw-record', correlationId: 'raw-trace'});
    expect(decision.status).toBe(403);
    expect(toAuthorizationAudit(decision, 'synthetic-correlation').resource_ref).toBe('synthetic-redacted-resource');
  });
  it('denies a physician outside assignment', () => expect(authorize({principal: principal(), action: 'observation:create:assigned', resourceTenantId: 'synthetic-hospital-a', assignedPractitionerSubject: 'synthetic-user-b', purpose: 'treatment', ...resource}).status).toBe(403));
  it('uses disclosure-safe 404 for another tenant', () => expect(authorize({principal: principal(), action: 'appointment:read:tenant', resourceTenantId: 'synthetic-hospital-b', ...resource}).status).toBe(404));
  it('denies receptionist clinical access', () => expect(authorize({principal: principal({roles: ['RECEPTIONIST']}), action: 'record:read:self', resourceTenantId: 'synthetic-hospital-a', resourceOwnerSubject: 'synthetic-user-a', ...resource}).status).toBe(403));
  it('denies self access to another subject', () => expect(authorize({principal: principal({roles: ['PATIENT']}), action: 'record:read:self', resourceTenantId: 'synthetic-hospital-a', resourceOwnerSubject: 'synthetic-user-b', ...resource}).status).toBe(404));
  it('requires purpose for clinical actions', () => expect(authorize({principal: principal(), action: 'encounter:create:assigned', resourceTenantId: 'synthetic-hospital-a', assignedPractitionerSubject: 'synthetic-user-a', ...resource}).status).toBe(403));
  it('produces redacted audit data without token or raw claims', () => {
    const audit = toAuthorizationAudit(authorize({principal: principal({roles: ['PATIENT']}), action: 'record:read:self', resourceTenantId: 'synthetic-hospital-a', ...resource, resourceOwnerSubject: 'synthetic-user-a'}), 'synthetic-correlation');
    expect(JSON.stringify(audit)).not.toContain('Bearer');
    expect(audit).toEqual({action: 'record:read:self', reason: 'allowed', resource_ref: 'synthetic-resource-1', correlation_id: 'synthetic-correlation'});
  });
  it('redacts untrusted mutation log resource values', () => expect(redactedMutationLog({action: 'appointment.create', status: 403, correlationId: 'synthetic-correlation', resourceRef: 'raw-phi'}).resource_ref).toBe('synthetic-redacted-resource'));
});
