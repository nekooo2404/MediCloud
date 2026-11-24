import {createHmac, randomUUID} from 'node:crypto';
import type {ActiveSession, ErrorEnvelope} from './types';

export interface ClinicalApiCallInit {
  method: 'GET' | 'POST';
  body?: string;
  idempotencyKey?: string;
  correlationId?: string;
  tenantCode?: string;
  role?: 'patient' | 'staff';
  actorSubject?: string;
  session?: ActiveSession | null;
}

export interface ClinicalApiResponse<T> {
  status: number;
  body: T | ErrorEnvelope;
  headers?: Record<string, string>;
  reason: string;
}

interface CircuitMetrics {
  state: 'closed' | 'open' | 'half_open';
  consecutiveFailures: number;
  openedAt: number | null;
  totalRequests: number;
  totalFailures: number;
  retriedGets: number;
  shortCircuits: number;
}

const DEFAULT_ACTOR_SIGNING_SECRET = 'synthetic-dev-actor-signing-secret-do-not-use-in-prod';
const FAILURE_THRESHOLD = 4;
const COOLDOWN_MS = 15_000;

const globalCircuit = globalThis as typeof globalThis & {
  __medicloudClinicalCircuit?: CircuitMetrics;
};

function getCircuit(): CircuitMetrics {
  if (!globalCircuit.__medicloudClinicalCircuit) {
    globalCircuit.__medicloudClinicalCircuit = {
      state: 'closed',
      consecutiveFailures: 0,
      openedAt: null,
      totalRequests: 0,
      totalFailures: 0,
      retriedGets: 0,
      shortCircuits: 0,
    };
  }
  return globalCircuit.__medicloudClinicalCircuit;
}

export function resetUpstreamCircuitForTests(): void {
  globalCircuit.__medicloudClinicalCircuit = {
    state: 'closed',
    consecutiveFailures: 0,
    openedAt: null,
    totalRequests: 0,
    totalFailures: 0,
    retriedGets: 0,
    shortCircuits: 0,
  };
}

export function getUpstreamCircuitMetrics(): CircuitMetrics {
  const c = getCircuit();
  if (c.state === 'open' && c.openedAt && Date.now() - c.openedAt >= COOLDOWN_MS) {
    c.state = 'half_open';
  }
  return {...c};
}

export function assertClinicalApiConfigured(role: 'patient' | 'staff'): {
  baseUrl: string;
  serviceToken: string;
  signingSecret: string;
} {
  const isProd = process.env.MEDICLOUD_ENV === 'production';
  const baseUrl = process.env.CLINICAL_API_BASE_URL || (isProd ? '' : 'http://127.0.0.1:4000');
  const defaultDevToken = role === 'staff' ? 'synthetic-bff-staff' : 'synthetic-bff-patient';
  const serviceToken =
    process.env.CLINICAL_API_BEARER_TOKEN || process.env.CLINICAL_API_SERVICE_TOKEN || (isProd ? '' : defaultDevToken);
  const signingSecret = process.env.BFF_ACTOR_SIGNING_SECRET || (isProd ? '' : DEFAULT_ACTOR_SIGNING_SECRET);

  if (isProd && (!baseUrl || !serviceToken || !signingSecret || signingSecret.length < 16)) {
    throw new Error('Fail-closed production config: CLINICAL_API_BASE_URL, CLINICAL_API_SERVICE_TOKEN, and BFF_ACTOR_SIGNING_SECRET are required');
  }

  return {baseUrl, serviceToken, signingSecret};
}

function buildSignedActorHeaders(
  signingSecret: string,
  subject: string,
  portalRole: 'patient' | 'staff',
  tenantCode?: string,
): Record<string, string> {
  const payload = Buffer.from(
    JSON.stringify({
      subject,
      portalRole,
      ...(tenantCode ? {tenantCode} : {}),
      issuedAt: Date.now(),
    }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', signingSecret).update(payload).digest('hex');
  return {
    'x-medicloud-actor': payload,
    'x-medicloud-actor-sig': signature,
  };
}

function errorEnvelope(status: number, code: string, message: string, correlationId: string): ClinicalApiResponse<never> {
  return {
    status,
    reason: code,
    body: {
      error: {
        code,
        message,
        correlation_id: correlationId,
      },
    },
  };
}

export async function callClinicalApi<T>(path: string, init: ClinicalApiCallInit): Promise<ClinicalApiResponse<T>> {
  const role: 'patient' | 'staff' =
    init.role ??
    (init.session?.role && ['RECEPTIONIST', 'PHYSICIAN', 'NURSE', 'AUDITOR'].includes(init.session.role)
      ? 'staff'
      : 'patient');
  const correlationId = init.correlationId || `synthetic-bff-${randomUUID().slice(0, 12)}`;
  const {baseUrl, serviceToken, signingSecret} = assertClinicalApiConfigured(role);
  const circuit = getCircuit();

  if (circuit.state === 'open') {
    if (circuit.openedAt && Date.now() - circuit.openedAt >= COOLDOWN_MS) {
      circuit.state = 'half_open';
    } else {
      circuit.shortCircuits += 1;
      return errorEnvelope(
        503,
        'circuit_breaker_open',
        'Ranh giới lâm sàng tạm ngắt mạch bảo vệ do sự cố liên tiếp. Vui lòng thử lại sau vài giây.',
        correlationId,
      );
    }
  }

  const actorSubject =
    init.actorSubject ?? init.session?.subject ?? (role === 'staff' ? 'synthetic-subject-4' : 'synthetic-subject-1');
  const tenantCode = init.tenantCode ?? init.session?.tenantId;
  const timeoutMs = Number(process.env.CLINICAL_API_TIMEOUT_MS ?? (init.method === 'GET' ? 3500 : 5000));

  const headers: Record<string, string> = {
    'x-correlation-id': correlationId,
    accept: 'application/json',
    ...buildSignedActorHeaders(signingSecret, actorSubject, role, tenantCode),
  };
  if (serviceToken) {
    headers.authorization = `Bearer ${serviceToken}`;
  }
  if (tenantCode) {
    headers['x-tenant-id'] = tenantCode;
  }
  if (init.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (init.idempotencyKey) {
    headers['Idempotency-Key'] = init.idempotencyKey;
  }

  const maxAttempts = init.method === 'GET' ? 2 : 1;
  circuit.totalRequests += 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      circuit.retriedGets += 1;
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    try {
      const response = await fetch(new URL(path, baseUrl), {
        method: init.method,
        headers,
        body: init.body,
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });

      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }

      if (response.status >= 500) {
        if (attempt + 1 < maxAttempts && [502, 503, 504].includes(response.status)) {
          continue;
        }
        circuit.totalFailures += 1;
        circuit.consecutiveFailures += 1;
        if (circuit.consecutiveFailures >= FAILURE_THRESHOLD) {
          circuit.state = 'open';
          circuit.openedAt = Date.now();
        }
        return errorEnvelope(
          503,
          'private_boundary_degraded',
          'Ranh giới lâm sàng nội bộ tạm thời gián đoạn. Chưa có thay đổi nào được xác nhận.',
          correlationId,
        );
      }

      circuit.state = 'closed';
      circuit.consecutiveFailures = 0;
      circuit.openedAt = null;
      const replayHeader = response.headers.get('x-idempotent-replay');
      return {
        status: response.status,
        body: parsed as T | ErrorEnvelope,
        headers: replayHeader ? {'x-idempotent-replay': replayHeader} : undefined,
        reason: response.ok ? 'ok' : 'upstream_error',
      };
    } catch {
      if (attempt + 1 < maxAttempts) {
        continue;
      }
      circuit.totalFailures += 1;
      circuit.consecutiveFailures += 1;
      if (circuit.consecutiveFailures >= FAILURE_THRESHOLD) {
        circuit.state = 'open';
        circuit.openedAt = Date.now();
      }
      return errorEnvelope(
        503,
        'private_boundary_degraded',
        'Quá thời gian chờ hoặc mất kết nối tới ranh giới lâm sàng nội bộ. Chưa có thay đổi nào được xác nhận.',
        correlationId,
      );
    }
  }

  return errorEnvelope(503, 'private_boundary_degraded', 'Không thể kết nối máy chủ lâm sàng.', correlationId);
}
