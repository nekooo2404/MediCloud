import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { ActiveSession, SyntheticPersona, SyntheticPersonaId } from './types';

export const SESSION_COOKIE_NAME = 'medicloud_demo_session';

const SYNTHETIC_SESSION_SECRET =
  process.env.PORTAL_SESSION_SECRET ?? 'synthetic-medicloud-p0-portal-session-secret-not-for-prod';

export const SYNTHETIC_PERSONAS: readonly SyntheticPersona[] = [
  {
    id: 'patient-hospital-a',
    subject: 'synthetic-subject-1',
    tenantId: '00000000-0000-4000-8000-000000000001',
    tenantCode: 'synthetic-hospital-a',
    tenantName: 'Bệnh viện Tổng hợp A (Mẫu)',
    role: 'PATIENT',
    patientId: '00000000-0000-4000-8000-000000000030',
    patientRef: 'synthetic-profile-1',
    displayName: 'Bệnh nhân mẫu #1',
    summary: 'Đặt lịch & tra cứu lịch hẹn cá nhân tại Cơ sở A',
  },
  {
    id: 'receptionist-hospital-a',
    subject: 'synthetic-subject-3',
    tenantId: '00000000-0000-4000-8000-000000000001',
    tenantCode: 'synthetic-hospital-a',
    tenantName: 'Bệnh viện Tổng hợp A (Mẫu)',
    role: 'RECEPTIONIST',
    displayName: 'Lễ tân quầy tiếp nhận A',
    summary: 'Đặt lịch hộ, tra cứu & tiếp nhận tại quầy Cơ sở A',
  },
  {
    id: 'patient-hospital-b',
    subject: 'synthetic-subject-2',
    tenantId: '00000000-0000-4000-8000-000000000002',
    tenantCode: 'synthetic-hospital-b',
    tenantName: 'Bệnh viện Tổng hợp B (Mẫu)',
    role: 'PATIENT',
    patientId: '00000000-0000-4000-8000-000000000031',
    patientRef: 'synthetic-profile-2',
    displayName: 'Bệnh nhân mẫu #2 (Cơ sở B)',
    summary: 'Kiểm chứng ranh giới cách ly dữ liệu đa cơ sở (Tenant B)',
  },
] as const;

const PERSONA_MAP = new Map<SyntheticPersonaId, SyntheticPersona>(
  SYNTHETIC_PERSONAS.map((persona) => [persona.id, persona]),
);

export function getSyntheticPersona(personaId: string): SyntheticPersona | undefined {
  return PERSONA_MAP.get(personaId as SyntheticPersonaId);
}

export function buildCorrelationId(incoming?: string | null): string {
  if (incoming && /^synthetic-[a-z0-9-]{4,64}$/.test(incoming)) {
    return incoming;
  }
  return `synthetic-portal-${randomUUID().slice(0, 12)}`;
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', SYNTHETIC_SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
}

export function createSessionCookieValue(personaId: SyntheticPersonaId): string {
  const persona = PERSONA_MAP.get(personaId);
  if (!persona) {
    throw new Error(`Unknown synthetic persona: ${personaId}`);
  }
  const payload = JSON.stringify({
    personaId: persona.id,
    iat: Date.now(),
  });
  const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionCookieValue(rawCookie: string | undefined | null): ActiveSession | null {
  if (!rawCookie) return null;
  const dotIndex = rawCookie.indexOf('.');
  if (dotIndex <= 0 || dotIndex === rawCookie.length - 1) return null;
  const encodedPayload = rawCookie.slice(0, dotIndex);
  const providedSig = rawCookie.slice(dotIndex + 1);
  const expectedSig = signPayload(encodedPayload);
  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
      personaId?: unknown;
    };
    if (typeof parsed.personaId !== 'string') return null;
    const persona = getSyntheticPersona(parsed.personaId);
    if (!persona) return null;
    return {
      personaId: persona.id,
      subject: persona.subject,
      tenantId: persona.tenantId,
      tenantCode: persona.tenantCode,
      tenantName: persona.tenantName,
      role: persona.role,
      patientId: persona.patientId,
      patientRef: persona.patientRef,
      displayName: persona.displayName,
    };
  } catch {
    return null;
  }
}

export function readCookieFromHeader(cookieHeader: string | null | undefined, cookieName: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    if (key === cookieName) {
      return decodeURIComponent(part.slice(eqIndex + 1).trim());
    }
  }
  return null;
}

export function readSessionFromRequest(request: Request): ActiveSession | null {
  const cookieHeader = request.headers.get('cookie');
  const raw = readCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
  return verifySessionCookieValue(raw);
}

export function buildSetSessionCookieHeader(value: string, request?: Request): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=28800',
  ];
  const forwardedProto = request?.headers.get('x-forwarded-proto');
  let isHttps = forwardedProto === 'https';
  if (!isHttps && request) {
    try {
      isHttps = new URL(request.url).protocol === 'https:';
    } catch {
      isHttps = false;
    }
  }
  if (isHttps) {
    attributes.push('Secure');
  }
  return attributes.join('; ');
}

export function buildClearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
