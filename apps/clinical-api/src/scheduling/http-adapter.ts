import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import type {PrismaClient} from '@prisma/client';
import {
  type ClinicalDependencies,
  createEncounter,
  createObservation,
  getAdminMetrics,
  listMyRecords,
} from '../clinical/service.js';
import type {PrivateHapiFhirClient} from '../fhir/hapi-fhir-adapter.js';
import {AuthenticationError} from '../security/oidc-verifier.js';
import {redactedMutationLog} from '../security/redacted-log.js';
import type {AuthenticatedPrincipal} from '../security/types.js';
import {
  checkInAppointment,
  createAppointment,
  getAppointment,
  listDoctors,
  listSlots,
  listSpecialties,
  listSpecialtiesPublic,
  type SchedulingDependencies,
  SchedulingError,
  validateCorrelationId,
} from './service.js';

const SYNTHETIC_CORRELATION_RE = /^synthetic-[a-z0-9-]+$/;
const MAX_JSON_BODY_BYTES = 65_536;

function safeCorrelationId(value: string): string {
  return SYNTHETIC_CORRELATION_RE.test(value) ? value : 'synthetic-redacted-correlation';
}

export interface ClinicalApiAdapterOptions {
  prisma: PrismaClient;
  verifyAuthorizationHeader: (header: string | undefined) => Promise<AuthenticatedPrincipal>;
  resolvePatientSubject?: SchedulingDependencies['resolvePatientSubject'];
  resolveMembership?: SchedulingDependencies['resolveMembership'];
  resolvePatientId?: SchedulingDependencies['resolvePatientId'];
  validateOutboxEvent?: SchedulingDependencies['validateOutboxEvent'];
  fhirClient?: PrivateHapiFhirClient;
}

export function createClinicalApiHandler(options: ClinicalApiAdapterOptions) {
  const resolveMembership: SchedulingDependencies['resolveMembership'] = options.resolveMembership ?? (async (client, subject) => {
    const user = await client.user.findUnique({where: {subject}, include: {memberships: true}});
    return user?.memberships.map((membership) => ({tenantId: membership.tenantId, roles: [membership.role], active: user.status === 'ACTIVE' && !membership.revokedAt})) ?? [];
  });
  const resolvePatientSubjectLookup = options.resolvePatientSubject ?? (async (client, tenantId, patientId) => {
    const patient = await client.patient.findFirst({where: {id: patientId, tenantId}, select: {profileRef: true}});
    return patient?.profileRef;
  });
  const resolvePatientId: SchedulingDependencies['resolvePatientId'] = options.resolvePatientId ?? (async (client, tenantId, subject) => {
    const patient = await client.patient.findFirst({where: {tenantId, profileRef: subject}, select: {id: true}});
    return patient?.id;
  });
  const deps: ClinicalDependencies = {
    prisma: options.prisma,
    resolvePatientSubject: async (...args) => {
      const value = await resolvePatientSubjectLookup(...args);
      if (!value) throw new SchedulingError(404, 'patient_not_found', 'patient not found');
      return value;
    },
    resolveMembership,
    resolvePatientId,
    validateOutboxEvent: options.validateOutboxEvent,
    fhirClient: options.fhirClient,
  };
  return async function clinicalApiHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const correlationId = headerString(request.headers['x-correlation-id']) ?? `synthetic-correlation-${cryptoRandomPart()}`;
    try {
      const url = new URL(request.url ?? '/', 'http://clinical-api.invalid');
      const path = url.pathname;
      const authHeader = headerString(request.headers.authorization);
      if (request.method === 'GET' && path === '/v1/specialties' && !authHeader) {
        validateCorrelationId(correlationId);
        return writeJson(response, 200, await listSpecialtiesPublic(options.prisma), correlationId);
      }

      const principal = await options.verifyAuthorizationHeader(authHeader);
      if (request.method === 'GET' && path === '/v1/specialties') {
        return writeJson(response, 200, await listSpecialties(deps, {principal, correlationId}), correlationId);
      }
      if (request.method === 'GET' && path === '/v1/doctors') {
        const result = await listDoctors(deps, {principal, correlationId}, {
          specialty: url.searchParams.get('specialty') ?? undefined,
          requestedTenantCode: url.searchParams.get('tenant_id') ?? undefined,
        });
        return writeJson(response, 200, result, correlationId);
      }
      if (request.method === 'GET' && path === '/v1/slots') {
        const doctorId = requiredQuery(url, 'doctor_id');
        const result = await listSlots(deps, {principal, correlationId}, doctorId, optionalDate(url, 'from'), optionalDate(url, 'to'));
        return writeJson(response, 200, result, correlationId);
      }
      if (request.method === 'POST' && path === '/v1/appointments') {
        const body = await readJson(request, ['slot_id', 'patient_id', 'idempotency_key']);
        const idempotencyHeader = headerString(request.headers['idempotency-key']);
        if (!idempotencyHeader) throw new SchedulingError(409, 'idempotency_key_required', 'Idempotency-Key is required');
        const result = await createAppointment(deps, {principal, correlationId, idempotencyHeader, serverChannel: 'portal'}, {
          slotId: requiredString(body.slot_id, 'slot_id'), patientId: optionalString(body.patient_id),
          idempotencyKey: requiredString(body.idempotency_key, 'idempotency_key'),
        });
        return writeJson(response, 201, result, correlationId);
      }
      const appointmentMatch = /^\/v1\/appointments\/([^/]+)$/.exec(path);
      if (request.method === 'GET' && appointmentMatch) {
        return writeJson(response, 200, await getAppointment(deps, {principal, correlationId}, appointmentMatch[1]), correlationId);
      }
      const checkInMatch = /^\/v1\/appointments\/([^/]+)\/check-in$/.exec(path);
      if (request.method === 'POST' && checkInMatch) {
        const body = await readJson(request, ['check_in_channel']);
        return writeJson(response, 200, await checkInAppointment(deps, {principal, correlationId, idempotencyHeader: ''}, checkInMatch[1], requiredChannel(body.check_in_channel)), correlationId);
      }
      if (request.method === 'POST' && path === '/v1/encounters') {
        const body = await readJson(request, ['appointment_id', 'practitioner_id']);
        const purpose = headerString(request.headers['x-purpose-of-use']);
        const result = await createEncounter(deps, {principal, correlationId, purpose}, {
          appointmentId: requiredString(body.appointment_id, 'appointment_id'),
          practitionerId: requiredString(body.practitioner_id, 'practitioner_id'),
        });
        return writeJson(response, 201, result, correlationId);
      }
      const observationMatch = /^\/v1\/encounters\/([^/]+)\/observations$/.exec(path);
      if (request.method === 'POST' && observationMatch) {
        const body = await readJson(request, ['code', 'value', 'unit', 'measured_at']);
        const purpose = headerString(request.headers['x-purpose-of-use']);
        const result = await createObservation(deps, {principal, correlationId, purpose}, observationMatch[1], {
          code: requiredString(body.code, 'code'),
          value: requiredFiniteNumber(body.value, 'value'),
          unit: requiredString(body.unit, 'unit'),
          measuredAt: requiredString(body.measured_at, 'measured_at'),
        });
        return writeJson(response, 201, result, correlationId);
      }
      if (request.method === 'GET' && path === '/v1/me/records') {
        const delegatedPatientSubject = headerString(request.headers['x-delegated-patient-subject']);
        const result = await listMyRecords(deps, {principal, correlationId, delegatedPatientSubject});
        return writeJson(response, 200, result, correlationId);
      }
      if (request.method === 'GET' && path === '/v1/admin/metrics') {
        const result = await getAdminMetrics(deps, {principal, correlationId}, optionalDate(url, 'from'), optionalDate(url, 'to'));
        return writeJson(response, 200, result, correlationId);
      }
      return writeError(response, 404, 'not_found', 'route not found', correlationId);
    } catch (error) {
      if (error instanceof AuthenticationError) return writeError(response, 401, 'unauthorized', 'Invalid authentication credentials', correlationId);
      if (error instanceof SchedulingError) return writeError(response, error.status, error.code, error.message, correlationId);
      console.warn(JSON.stringify(redactedMutationLog({action: `${request.method ?? 'UNKNOWN'} ${request.url ?? '/'}`, status: 500, correlationId, reason: 'internal_error'})));
      return writeError(response, 500, 'internal_error', 'Request could not be processed', correlationId);
    }
  };
}

export function createClinicalApiServer(options: ClinicalApiAdapterOptions) {
  return createServer(createClinicalApiHandler(options));
}

function headerString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
function requiredQuery(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (!value) throw new SchedulingError(400, `${name}_required`, `${name} is required`);
  return value;
}
function optionalDate(url: URL, name: string): Date | undefined {
  const value = url.searchParams.get(name);
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new SchedulingError(400, `invalid_${name}`, `${name} is invalid`);
  return date;
}
function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new SchedulingError(400, `${name}_required`, `${name} is required`);
  return value;
}
function requiredFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new SchedulingError(400, `invalid_${name}`, `${name} must be a finite number`);
  return value;
}
function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : requiredString(value, 'patient_id');
}
function requiredChannel(value: unknown): 'portal' | 'desk' {
  if (value !== 'portal' && value !== 'desk') throw new SchedulingError(400, 'invalid_channel', 'channel is invalid');
  return value;
}
async function readJson(request: IncomingMessage, allowedFields: readonly string[]): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const bufferChunk = Buffer.from(chunk);
    totalBytes += bufferChunk.byteLength;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new SchedulingError(400, 'invalid_json', 'request body exceeds maximum allowed size');
    }
    chunks.push(bufferChunk);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not object');
    const record = body as Record<string, unknown>;
    const allowed = new Set(allowedFields);
    if (Object.keys(record).some((key) => !allowed.has(key))) throw new SchedulingError(400, 'unknown_field', 'request contains an unknown field');
    return record;
  } catch (error) {
    if (error instanceof SchedulingError) throw error;
    throw new SchedulingError(400, 'invalid_json', 'request body must be JSON');
  }
}
function writeJson(response: ServerResponse, status: number, body: unknown, correlationId?: string): void {
  const normalizedCorrelationId = correlationId ? safeCorrelationId(correlationId) : undefined;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...(normalizedCorrelationId ? {'x-correlation-id': normalizedCorrelationId} : {}),
  });
  response.end(JSON.stringify(body));
}
function writeError(response: ServerResponse, status: number, code: string, message: string, correlationId: string): void {
  const normalizedCorrelationId = safeCorrelationId(correlationId);
  writeJson(response, status, {error: {code, message, correlation_id: normalizedCorrelationId}}, normalizedCorrelationId);
}
function cryptoRandomPart(): string {
  return Math.random().toString(36).slice(2, 10);
}
