import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import type {PrismaClient} from '@prisma/client';
import {validateContractBody} from '../contracts/ajv-validator.js';
import {
  amendObservation,
  cancelEncounter,
  type ClinicalDependencies,
  completeEncounter,
  createEncounter,
  createObservation,
  getAdminMetrics,
  listMyRecords,
} from '../clinical/service.js';
import {
  queryWorkspaceSlice,
  WorkspaceAccessError,
  type WorkspaceSliceName,
} from '../modules/read-models/workspace-queries.js';
import type {PrivateHapiFhirClient} from '../fhir/hapi-fhir-adapter.js';
import {AuthenticationError} from '../security/oidc-verifier.js';
import {redactedMutationLog} from '../security/redacted-log.js';
import type {AuthenticatedPrincipal} from '../security/types.js';
import {
  cancelAppointment,
  checkInAppointment,
  createAppointment,
  getAppointment,
  listDoctors,
  listSlots,
  listSpecialties,
  listSpecialtiesPublic,
  markNoShowAppointment,
  publishDoctorSlots,
  rescheduleAppointment,
  type SchedulingDependencies,
  SchedulingError,
  transitionQueueTicket,
  validateCorrelationId,
} from './service.js';

const CORRELATION_ID_RE = /^(?:synthetic-[a-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const MAX_JSON_BODY_BYTES = 65_536;
const WORKSPACE_RESOURCES = new Set<WorkspaceSliceName>(['overview', 'appointments', 'queue', 'records', 'vitals', 'audit']);

function safeCorrelationId(value: string): string {
  return CORRELATION_ID_RE.test(value) ? value : 'synthetic-redacted-correlation';
}

export interface ClinicalApiAdapterOptions {
  prisma: PrismaClient;
  verifyAuthorizationHeader: (header: string | undefined, req?: IncomingMessage) => Promise<AuthenticatedPrincipal>;
  resolvePatientSubject?: SchedulingDependencies['resolvePatientSubject'];
  resolveMembership?: SchedulingDependencies['resolveMembership'];
  resolvePatientId?: SchedulingDependencies['resolvePatientId'];
  validateOutboxEvent?: SchedulingDependencies['validateOutboxEvent'];
  fhirClient?: PrivateHapiFhirClient;
}

export function createClinicalApiHandler(options: ClinicalApiAdapterOptions) {
  const resolveMembership: SchedulingDependencies['resolveMembership'] =
    options.resolveMembership ??
    (async (client, subject) => {
      const user = await client.user.findUnique({where: {subject}, include: {memberships: true}});
      if (!user) return [];
      const active = user.status === 'ACTIVE';
      const byTenant = new Map<string, string[]>();
      for (const membership of user.memberships) {
        if (membership.revokedAt) continue;
        const roles = byTenant.get(membership.tenantId) ?? [];
        roles.push(membership.role);
        byTenant.set(membership.tenantId, roles);
      }
      return Array.from(byTenant.entries()).map(([tenantId, roles]) => ({tenantId, roles, active}));
    });

  const resolvePatientSubjectLookup =
    options.resolvePatientSubject ??
    (async (client, tenantId, patientId) => {
      const patient = await client.patient.findFirst({
        where: {id: patientId, tenantId},
        include: {user: {select: {subject: true}}},
      });
      return patient?.user?.subject ?? patient?.profileRef;
    });

  const resolvePatientId: SchedulingDependencies['resolvePatientId'] =
    options.resolvePatientId ??
    (async (client, tenantId, subject) => {
      const user = await client.user.findUnique({where: {subject}, select: {id: true}});
      const patient = await client.patient.findFirst({
        where: {
          tenantId,
          status: 'ACTIVE',
          OR: [...(user ? [{userId: user.id}] : []), {profileRef: subject}],
        },
        select: {id: true},
      });
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

      const principal = await options.verifyAuthorizationHeader(authHeader, request);
      const requestedTenantId = headerString(request.headers['x-tenant-id']);

      if (request.method === 'GET' && path === '/v1/specialties') {
        return writeJson(response, 200, await listSpecialties(deps, {principal, correlationId, requestedTenantId}), correlationId);
      }
      if (request.method === 'GET' && path === '/v1/doctors') {
        const result = await listDoctors(
          deps,
          {principal, correlationId, requestedTenantId},
          {
            specialty: url.searchParams.get('specialty') ?? undefined,
            requestedTenantCode: url.searchParams.get('tenant_id') ?? undefined,
          },
        );
        return writeJson(response, 200, result, correlationId);
      }
      if (request.method === 'GET' && path === '/v1/slots') {
        const doctorId = requiredQuery(url, 'doctor_id');
        const result = await listSlots(
          deps,
          {principal, correlationId, requestedTenantId},
          doctorId,
          optionalDate(url, 'from'),
          optionalDate(url, 'to'),
        );
        return writeJson(response, 200, result, correlationId);
      }
      if (request.method === 'POST' && path === '/v1/schedules/publish') {
        const raw = await readJsonObject(request);
        const body = validateContractBody<{
          practitioner_id: string;
          starts_at: string;
          ends_at: string;
          slot_duration_minutes?: number;
          capacity?: number;
        }>('PublishSchedule', raw);
        const result = await publishDoctorSlots(
          deps,
          {principal, correlationId, requestedTenantId},
          {
            practitionerId: body.practitioner_id,
            startsAt: body.starts_at,
            endsAt: body.ends_at,
            slotDurationMinutes: body.slot_duration_minutes,
            capacity: body.capacity,
          },
        );
        return writeJson(response, 201, result, correlationId);
      }
      if (request.method === 'POST' && path === '/v1/appointments') {
        const raw = await readJsonObject(request);
        const body = validateContractBody<{
          slot_id: string;
          patient_id?: string;
          idempotency_key: string;
          visit_type?: string;
          visit_reason?: string;
          intake_note?: string;
        }>('CreateAppointment', raw);
        const idempotencyHeader = headerString(request.headers['idempotency-key']);
        if (!idempotencyHeader) throw new SchedulingError(409, 'idempotency_key_required', 'Idempotency-Key is required');
        const result = await createAppointment(
          deps,
          {principal, correlationId, idempotencyHeader, serverChannel: 'portal', requestedTenantId},
          {
            slotId: body.slot_id,
            patientId: body.patient_id,
            idempotencyKey: body.idempotency_key,
            visitType: body.visit_type,
            visitReason: body.visit_reason,
            intakeNote: body.intake_note,
          },
        );
        return writeJson(response, 201, result, correlationId);
      }
      const appointmentMatch = /^\/v1\/appointments\/([^/]+)$/.exec(path);
      if (request.method === 'GET' && appointmentMatch) {
        return writeJson(
          response,
          200,
          await getAppointment(deps, {principal, correlationId, requestedTenantId}, appointmentMatch[1]),
          correlationId,
        );
      }
      const checkInMatch = /^\/v1\/appointments\/([^/]+)\/check-in$/.exec(path);
      if (request.method === 'POST' && checkInMatch) {
        const raw = await readJsonObject(request);
        const body = validateContractBody<{check_in_channel: 'desk' | 'portal'}>('CheckIn', raw);
        return writeJson(
          response,
          200,
          await checkInAppointment(
            deps,
            {principal, correlationId, requestedTenantId},
            checkInMatch[1],
            requiredChannel(body.check_in_channel),
          ),
          correlationId,
        );
      }
      const cancelMatch = /^\/v1\/appointments\/([^/]+)\/cancel$/.exec(path);
      if (request.method === 'POST' && cancelMatch) {
        const raw = await readJsonObject(request);
        const body = validateContractBody<{reason: string}>('CancelAppointment', raw);
        return writeJson(
          response,
          200,
          await cancelAppointment(deps, {principal, correlationId, requestedTenantId}, cancelMatch[1], body.reason),
          correlationId,
        );
      }
      const rescheduleMatch = /^\/v1\/appointments\/([^/]+)\/reschedule$/.exec(path);
      if (request.method === 'POST' && rescheduleMatch) {
        const raw = await readJsonObject(request);
        const body = validateContractBody<{new_slot_id: string; idempotency_key: string; reason?: string}>('RescheduleAppointment', raw);
        const idempotencyHeader = headerString(request.headers['idempotency-key']);
        if (!idempotencyHeader) throw new SchedulingError(409, 'idempotency_key_required', 'Idempotency-Key is required');
        return writeJson(
          response,
          200,
          await rescheduleAppointment(
            deps,
            {principal, correlationId, idempotencyHeader, serverChannel: 'portal', requestedTenantId},
            rescheduleMatch[1],
            {newSlotId: body.new_slot_id, idempotencyKey: body.idempotency_key, reason: body.reason},
          ),
          correlationId,
        );
      }
      const noShowMatch = /^\/v1\/appointments\/([^/]+)\/no-show$/.exec(path);
      if (request.method === 'POST' && noShowMatch) {
        const raw = await readJsonObject(request, true);
        const body = validateContractBody<{reason?: string}>('MarkNoShow', raw);
        return writeJson(
          response,
          200,
          await markNoShowAppointment(deps, {principal, correlationId, requestedTenantId}, noShowMatch[1], body.reason),
          correlationId,
        );
      }
      const queueMatch = /^\/v1\/queue\/([^/]+)\/transition$/.exec(path);
      if (request.method === 'POST' && queueMatch) {
        const raw = await readJsonObject(request);
        const body = validateContractBody<{to_status: string}>('QueueTransition', raw);
        return writeJson(
          response,
          200,
          await transitionQueueTicket(deps, {principal, correlationId, requestedTenantId}, queueMatch[1], body.to_status),
          correlationId,
        );
      }
      if (request.method === 'POST' && path === '/v1/encounters') {
        const raw = await readJsonObject(request);
        const body = validateContractBody<{appointment_id: string; practitioner_id: string}>('CreateEncounter', raw);
        const purpose = headerString(request.headers['x-purpose-of-use']);
        const result = await createEncounter(
          deps,
          {principal, correlationId, purpose, requestedTenantId},
          {
            appointmentId: requiredString(body.appointment_id, 'appointment_id'),
            practitionerId: requiredString(body.practitioner_id, 'practitioner_id'),
          },
        );
        return writeJson(response, 201, result, correlationId);
      }
      const observationMatch = /^\/v1\/encounters\/([^/]+)\/observations$/.exec(path);
      if (request.method === 'POST' && observationMatch) {
        const raw = await readJsonObject(request);
        const body = validateContractBody<{
          code: string;
          value: number;
          unit: string;
          measured_at: string;
          status?: 'PRELIMINARY' | 'FINAL';
          expected_version?: number;
        }>('CreateObservation', raw);
        const purpose = headerString(request.headers['x-purpose-of-use']);
        const result = await createObservation(
          deps,
          {principal, correlationId, purpose, requestedTenantId},
          observationMatch[1],
          {
            code: requiredString(body.code, 'code'),
            value: requiredFiniteNumber(body.value, 'value'),
            unit: requiredString(body.unit, 'unit'),
            measuredAt: requiredString(body.measured_at, 'measured_at'),
            status: body.status,
            expectedVersion: body.expected_version,
          },
        );
        return writeJson(response, 201, result, correlationId);
      }
      const amendObsMatch = /^\/v1\/encounters\/([^/]+)\/observations\/([^/]+)\/amend$/.exec(path);
      if (request.method === 'POST' && amendObsMatch) {
        const raw = await readJsonObject(request);
        const body = validateContractBody<{
          value: number;
          unit: string;
          measured_at: string;
          reason: string;
          expected_version: number;
        }>('AmendObservation', raw);
        const purpose = headerString(request.headers['x-purpose-of-use']);
        const result = await amendObservation(
          deps,
          {principal, correlationId, purpose, requestedTenantId},
          amendObsMatch[1],
          amendObsMatch[2],
          {
            value: body.value,
            unit: body.unit,
            measuredAt: body.measured_at,
            reason: body.reason,
            expectedVersion: body.expected_version,
          },
        );
        return writeJson(response, 201, result, correlationId);
      }
      const completeEncMatch = /^\/v1\/encounters\/([^/]+)\/complete$/.exec(path);
      if (request.method === 'POST' && completeEncMatch) {
        const raw = await readJsonObject(request, true);
        const body = validateContractBody<{expected_version?: number}>('CompleteEncounter', raw);
        const purpose = headerString(request.headers['x-purpose-of-use']);
        const result = await completeEncounter(
          deps,
          {principal, correlationId, purpose, requestedTenantId},
          completeEncMatch[1],
          {expectedVersion: body.expected_version},
        );
        return writeJson(response, 200, result, correlationId);
      }
      const cancelEncMatch = /^\/v1\/encounters\/([^/]+)\/cancel$/.exec(path);
      if (request.method === 'POST' && cancelEncMatch) {
        const raw = await readJsonObject(request);
        const body = validateContractBody<{reason: string; expected_version?: number}>('CancelEncounter', raw);
        const purpose = headerString(request.headers['x-purpose-of-use']);
        const result = await cancelEncounter(
          deps,
          {principal, correlationId, purpose, requestedTenantId},
          cancelEncMatch[1],
          {reason: body.reason, expectedVersion: body.expected_version},
        );
        return writeJson(response, 200, result, correlationId);
      }
      const workspaceMatch = /^\/v1\/workspace\/([^/]+)$/.exec(path);
      if (request.method === 'GET' && workspaceMatch) {
        const resource = workspaceMatch[1] as WorkspaceSliceName;
        if (!WORKSPACE_RESOURCES.has(resource)) {
          return writeError(response, 404, 'workspace_resource_not_found', 'workspace resource not found', correlationId);
        }
        const effective = await queryWorkspaceSlice(
          options.prisma,
          {
            role: principal.roles.some((r) => ['RECEPTIONIST', 'PHYSICIAN', 'NURSE', 'AUDITOR'].includes(r)) ? 'staff' : 'patient',
            actorSubject: principal.subject,
            tenantCode: requestedTenantId,
            requestedPatientId: url.searchParams.get('patientId') ?? undefined,
          },
          resource,
          {
            cursor: url.searchParams.get('cursor') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
            status: url.searchParams.get('status') ?? undefined,
            q: url.searchParams.get('q') ?? undefined,
            from: url.searchParams.get('from') ?? undefined,
            to: url.searchParams.get('to') ?? undefined,
            sort: (url.searchParams.get('sort') as 'startsAt' | 'status' | 'occurredAt' | 'measuredAt' | null) ?? undefined,
            dir: (url.searchParams.get('dir') as 'asc' | 'desc' | null) ?? undefined,
            patientId: url.searchParams.get('patientId') ?? undefined,
          },
        );
        return writeJson(response, 200, {...effective, correlation_id: correlationId}, correlationId);
      }
      if (request.method === 'GET' && path === '/v1/me/records') {
        const delegatedPatientSubject = headerString(request.headers['x-delegated-patient-subject']);
        const result = await listMyRecords(deps, {principal, correlationId, delegatedPatientSubject, requestedTenantId});
        return writeJson(response, 200, result, correlationId);
      }
      if (request.method === 'GET' && path === '/v1/admin/metrics') {
        const result = await getAdminMetrics(
          deps,
          {principal, correlationId, requestedTenantId},
          optionalDate(url, 'from'),
          optionalDate(url, 'to'),
        );
        return writeJson(response, 200, result, correlationId);
      }
      return writeError(response, 404, 'not_found', 'route not found', correlationId);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return writeError(response, 401, 'unauthorized', 'Invalid authentication credentials', correlationId);
      }
      if (error instanceof WorkspaceAccessError) {
        return writeError(response, error.status, error.code, error.message, correlationId);
      }
      if (error instanceof SchedulingError) {
        return writeError(response, error.status, error.code, error.message, correlationId);
      }
      console.warn(
        JSON.stringify(
          redactedMutationLog({
            action: `${request.method ?? 'UNKNOWN'} ${request.url ?? '/'}`,
            status: 500,
            correlationId,
            reason: 'internal_error',
          }),
        ),
      );
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
function requiredChannel(value: unknown): 'portal' | 'desk' {
  if (value !== 'portal' && value !== 'desk') throw new SchedulingError(400, 'invalid_channel', 'channel is invalid');
  return value;
}
async function readJsonObject(request: IncomingMessage, allowEmpty = false): Promise<Record<string, unknown>> {
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
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw && allowEmpty) return {};
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not object');
    return body as Record<string, unknown>;
  } catch {
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
