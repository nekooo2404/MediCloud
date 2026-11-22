import {createRemoteJWKSet, jwtVerify, type JWTPayload} from 'jose';
import {ROLES, type AuthenticatedPrincipal, type Role} from './types.js';

export interface OidcVerifierConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
  isActiveSubject: (subject: string) => Promise<boolean>;
}

export class AuthenticationError extends Error {
  readonly status = 401;
  constructor(message = 'Invalid authentication credentials') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

type KeycloakClaims = JWTPayload & {
  realm_access?: {roles?: unknown};
  tenant_ids?: unknown;
  active?: unknown;
  typ?: unknown;
};

export function createOidcVerifier(config: OidcVerifierConfig) {
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  return async function verifyAuthorizationHeader(header: string | undefined): Promise<AuthenticatedPrincipal> {
    if (!header?.startsWith('Bearer ')) throw new AuthenticationError();
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new AuthenticationError();
    try {
      const {payload, protectedHeader} = await jwtVerify<KeycloakClaims>(token, jwks, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['RS256'],
      });
      const subject = typeof payload.sub === 'string' ? payload.sub : '';
      const roles = normalizeRoles(payload.realm_access?.roles);
      const tenantIds = Array.isArray(payload.tenant_ids) && payload.tenant_ids.every((value) => typeof value === 'string')
        ? payload.tenant_ids as string[]
        : [];
      if (!subject || tenantIds.length === 0 || protectedHeader.typ !== 'Bearer' || payload.active === false || !(await config.isActiveSubject(subject))) throw new AuthenticationError();
      return {subject, issuer: config.issuer, audience: config.audience, roles, tenantIds, active: true};
    } catch {
      throw new AuthenticationError();
    }
  };
}

function normalizeRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) return [];
  return value.filter((role): role is Role => typeof role === 'string' && (ROLES as readonly string[]).includes(role));
}
