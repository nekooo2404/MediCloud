import {createHash, randomUUID} from 'node:crypto';
import {AppointmentStatus, Prisma, PrismaClient} from '@prisma/client';
import {authorize} from '../security/authorization.js';
import {validateEventEnvelope} from './event-validation.js';
import type {AuthenticatedPrincipal} from '../security/types.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface SchedulingRequestContext {
  principal: AuthenticatedPrincipal;
  correlationId: string;
  idempotencyHeader: string;
  serverChannel?: 'portal' | 'staff';
}

export interface CreateAppointmentInput {
  slotId: string;
  patientId?: string;
  idempotencyKey: string;
}

export interface SchedulingDependencies {
  prisma: PrismaClient;
  /** Resolves the server-side subject for a patient; never sourced from the request body. */
  resolvePatientSubject: (client: DbClient, tenantId: string, patientId: string) => Promise<string>;
  resolveMembership: (client: DbClient, subject: string) => Promise<{tenantId: string; roles: string[]; active: boolean}[]>;
  resolvePatientId: (client: DbClient, tenantId: string, subject: string) => Promise<string | undefined>;
  validateOutboxEvent?: (event: unknown) => void;
}

export class SchedulingError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 404 | 409 | 500, public readonly code: string, message: string) {
    super(message);
    this.name = 'SchedulingError';
  }
}

const ACTIVE_APPOINTMENT_STATUSES = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];
const SYNTHETIC_REF_RE = /^synthetic-[a-z0-9-]+$/;

export function validateCorrelationId(correlationId: string): void {
  if (!SYNTHETIC_REF_RE.test(correlationId)) {
    throw new SchedulingError(400, 'invalid_correlation_id', 'correlation_id is invalid');
  }
}

function validateAppointmentCreatedEvent(event: {event_id: string; event_type: string; schema_version: number; tenant_id: string; occurred_at: string; correlation_id: string; payload: Record<string, unknown>}) {
  if (event.event_type !== 'appointment.created' || event.schema_version !== 1 || !SYNTHETIC_REF_RE.test(event.tenant_id) || !SYNTHETIC_REF_RE.test(event.correlation_id)) throw new SchedulingError(500, 'event_validation_failed', 'event validation failed');
  const keys = Object.keys(event.payload).sort();
  if (keys.length !== 2 || keys[0] !== 'appointment_ref' || keys[1] !== 'channel' || !SYNTHETIC_REF_RE.test(String(event.payload.appointment_ref)) || !['portal', 'staff'].includes(String(event.payload.channel))) throw new SchedulingError(500, 'event_validation_failed', 'event validation failed');
}

export async function effectivePrincipal(deps: Pick<SchedulingDependencies, 'resolveMembership'>, client: DbClient, principal: AuthenticatedPrincipal) {
  const memberships = await deps.resolveMembership(client, principal.subject);
  const matches = memberships.filter((entry) => entry.active);
  if (matches.length !== 1) throw new SchedulingError(403, matches.length ? 'tenant_selection_required' : 'tenant_membership_required', 'an unambiguous active tenant membership is required');
  const membership = matches[0];
  if (!membership) throw new SchedulingError(403, 'tenant_membership_required', 'active tenant membership is required');
  return {tenantId: membership.tenantId, principal: {...principal, tenantIds: [membership.tenantId], roles: membership.roles.filter((role): role is AuthenticatedPrincipal['roles'][number] => ['PATIENT', 'GUARDIAN', 'RECEPTIONIST', 'PHYSICIAN', 'NURSE', 'AUDITOR'].includes(role))}};
}

export function validateBookingRequest(input: CreateAppointmentInput, context: Pick<SchedulingRequestContext, 'correlationId' | 'idempotencyHeader'>): void {
  validateCorrelationId(context.correlationId);
  if (!/^[\w-]{16,128}$/.test(input.idempotencyKey) || input.idempotencyKey !== context.idempotencyHeader) {
    throw new SchedulingError(409, 'idempotency_key_mismatch', 'Idempotency-Key must match body.idempotency_key');
  }
}

export function bookingFingerprint(input: Pick<CreateAppointmentInput, 'slotId' | 'patientId'>, serverChannel: 'portal' | 'staff'): string {
  return createHash('sha256').update(JSON.stringify([input.slotId, input.patientId ?? null, serverChannel])).digest('hex');
}

function appointmentResponse(appointment: {id: string; tenantId: string; slotId: string; status: AppointmentStatus; checkInStatus?: string; checkedInAt?: Date | null}, correlationId: string) {
  return {id: appointment.id, tenant_id: appointment.tenantId, slot_id: appointment.slotId, status: appointment.status.toLowerCase(), check_in_status: (appointment.checkInStatus ?? 'NOT_CHECKED_IN').toLowerCase(), checked_in_at: appointment.checkedInAt?.toISOString() ?? null, correlation_id: correlationId};
}

function appointmentAction(principal: AuthenticatedPrincipal): 'appointment:read:self' | 'appointment:read:tenant' {
  if (principal.roles.includes('RECEPTIONIST')) return 'appointment:read:tenant';
  if (principal.roles.includes('PATIENT')) return 'appointment:read:self';
  throw new SchedulingError(403, 'appointment_read_not_permitted', 'appointment access is not permitted');
}

async function loadAppointment(deps: SchedulingDependencies, context: Pick<SchedulingRequestContext, 'principal' | 'correlationId'>, appointmentId: string) {
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal);
  const {tenantId, principal} = effective;
  const appointment = await deps.prisma.appointment.findFirst({where: {id: appointmentId, tenantId}});
  if (!appointment) throw new SchedulingError(404, 'appointment_not_found', 'appointment not found');
  const patientSubject = await deps.resolvePatientSubject(deps.prisma, tenantId, appointment.patientId);
  return {tenantId, appointment, patientSubject, principal};
}

export async function getAppointment(deps: SchedulingDependencies, context: Pick<SchedulingRequestContext, 'principal' | 'correlationId'>, appointmentId: string) {
  const {tenantId, appointment, patientSubject, principal} = await loadAppointment(deps, context, appointmentId);
  const action = appointmentAction(principal);
  const decision = authorize({principal, action, resourceTenantId: tenantId, resourceOwnerSubject: patientSubject, resourceRef: `synthetic-appointment-${appointment.id}`, correlationId: context.correlationId});
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'appointment access is not permitted');
  return appointmentResponse(appointment, context.correlationId);
}

export async function checkInAppointment(deps: SchedulingDependencies, context: SchedulingRequestContext, appointmentId: string, channel: 'portal' | 'desk') {
  if (!['portal', 'desk'].includes(channel)) throw new SchedulingError(400, 'invalid_channel', 'channel is invalid');
  const {tenantId, appointment, patientSubject, principal} = await loadAppointment(deps, context, appointmentId);
  const decision = authorize({principal, action: 'appointment:check-in', resourceTenantId: tenantId, resourceOwnerSubject: patientSubject, resourceRef: `synthetic-appointment-${appointment.id}`, correlationId: context.correlationId, resourceStateAllowed: appointment.status === AppointmentStatus.CONFIRMED});
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'appointment check-in is not permitted');
  const updated = appointment.checkInStatus === 'CHECKED_IN' ? appointment : await deps.prisma.$transaction(async (tx) => {
    const actor = await tx.user.findUniqueOrThrow({where: {subject: context.principal.subject}});
    const result = await tx.appointment.update({where: {id: appointment.id}, data: {checkInStatus: 'CHECKED_IN', checkedInAt: new Date(), checkedInByUserId: actor.id}});
    await tx.auditEvent.create({data: {tenantId, actorId: actor.id, action: 'appointment.check_in', resourceRef: `synthetic-appointment-${appointment.id}`, purpose: 'operations', correlationId: context.correlationId, metadata: {channel}}});
    return result;
  });
  return appointmentResponse(updated, context.correlationId);
}

export async function createAppointment(deps: SchedulingDependencies, context: SchedulingRequestContext, input: CreateAppointmentInput) {
  validateBookingRequest(input, context);
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal);
  const {tenantId, principal} = effective;
  if (!tenantId) throw new SchedulingError(403, 'tenant_membership_required', 'active tenant membership is required');

  return deps.prisma.$transaction(async (tx) => {
    const slot = await tx.$queryRaw<Array<{id: string; tenantId: string; capacity: number; bookedCount: number}>>`
      SELECT "id", "tenantId", "capacity", "bookedCount"
      FROM "appointment_slots"
      WHERE "id" = ${input.slotId}::uuid AND "tenantId" = ${tenantId}::uuid
      FOR UPDATE
    `;
    const lockedSlot = slot[0];
    if (!lockedSlot) throw new SchedulingError(404, 'slot_not_found', 'slot not found');

    const patientId = input.patientId ?? await deps.resolvePatientId(tx, tenantId, context.principal.subject);
    if (!patientId) throw new SchedulingError(400, 'patient_required', 'patient_id could not be resolved from the active membership');
    const existing = await tx.appointment.findUnique({where: {tenantId_idempotencyKey: {tenantId, idempotencyKey: input.idempotencyKey}}});
    if (existing) {
    const effectiveInput = {...input, patientId};
    if (bookingFingerprint({slotId: existing.slotId, patientId: existing.patientId}, context.serverChannel ?? 'portal') !== bookingFingerprint(effectiveInput, context.serverChannel ?? 'portal')) throw new SchedulingError(409, 'idempotency_conflict', 'idempotency key was used for another request');
      return appointmentResponse(existing, context.correlationId);
    }

    const patient = await tx.patient.findFirst({where: {id: patientId, tenantId, status: 'ACTIVE'}});
    if (!patient) throw new SchedulingError(404, 'patient_not_found', 'patient not found');
    const patientSubject = await deps.resolvePatientSubject(tx, tenantId, patientId);
    const decision = authorize({principal, action: 'appointment:create', resourceTenantId: tenantId, resourceOwnerSubject: patientSubject, resourceRef: `synthetic-appointment-${input.slotId}`, correlationId: context.correlationId});
    if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'appointment creation is not permitted');

    const activeCount = await tx.appointment.count({where: {tenantId, slotId: input.slotId, status: {in: ACTIVE_APPOINTMENT_STATUSES}}});
    if (activeCount >= lockedSlot.capacity) throw new SchedulingError(409, 'slot_capacity_exhausted', 'slot has no remaining capacity');
    await tx.appointmentSlot.update({where: {id: input.slotId}, data: {bookedCount: activeCount + 1}});

    const id = randomUUID();
    const appointment = await tx.appointment.create({data: {id, tenantId, patientId, slotId: input.slotId, status: AppointmentStatus.CONFIRMED, idempotencyKey: input.idempotencyKey}});
    const tenant = await tx.tenant.findUniqueOrThrow({where: {id: tenantId}, select: {code: true}});
    const event = {event_id: randomUUID(), event_type: 'appointment.created', schema_version: 1, tenant_id: tenant.code, occurred_at: new Date().toISOString(), correlation_id: context.correlationId, payload: {appointment_ref: `synthetic-appointment-${id}`, channel: context.serverChannel ?? 'portal'}};
    validateAppointmentCreatedEvent(event);
    validateEventEnvelope(event);
    deps.validateOutboxEvent?.(event);
    await tx.outboxEvent.create({data: {eventId: event.event_id, tenantId, eventType: event.event_type, schemaVersion: event.schema_version, correlationId: event.correlation_id, payload: event.payload}});
    return appointmentResponse(appointment, context.correlationId);
  });
}

export async function listSlots(deps: SchedulingDependencies, context: Pick<SchedulingRequestContext, 'principal' | 'correlationId'>, doctorId: string, from?: Date, to?: Date) {
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal);
  const {tenantId, principal} = effective;
  const decision = authorize({principal, action: 'slot:read', resourceTenantId: tenantId, resourceRef: `synthetic-slot-${doctorId}`, correlationId: context.correlationId});
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'slot access is not permitted');
  const slots = await deps.prisma.appointmentSlot.findMany({where: {tenantId, schedule: {practitionerId: doctorId, ...(from || to ? {startsAt: { ...(from ? {gte: from} : {}), ...(to ? {lte: to} : {})}} : {})}}, orderBy: {startsAt: 'asc'}});
  return {data: slots.map((slot) => ({id: slot.id, starts_at: slot.startsAt.toISOString(), capacity: slot.capacity, remaining: Math.max(0, slot.capacity - slot.bookedCount)})), correlation_id: context.correlationId};
}

export async function listSpecialtiesPublic(prisma: PrismaClient) {
  const rows = await prisma.practitioner.findMany({select: {specialty: true}, distinct: ['specialty'], orderBy: {specialty: 'asc'}});
  return {data: rows.map((row) => ({id: row.specialty, name: row.specialty}))};
}

export async function listSpecialties(deps: SchedulingDependencies, context: Pick<SchedulingRequestContext, 'principal' | 'correlationId'>) {
  validateCorrelationId(context.correlationId);
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal);
  const {tenantId, principal} = effective;
  const decision = authorize({principal, action: 'slot:read', resourceTenantId: tenantId, resourceRef: 'synthetic-specialties-catalog', correlationId: context.correlationId});
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'specialty catalog access is not permitted');
  const rows = await deps.prisma.practitioner.findMany({where: {tenantId}, select: {specialty: true}, distinct: ['specialty'], orderBy: {specialty: 'asc'}});
  return {data: rows.map((row) => ({id: row.specialty, name: row.specialty}))};
}

export async function listDoctors(
  deps: SchedulingDependencies,
  context: Pick<SchedulingRequestContext, 'principal' | 'correlationId'>,
  options: {specialty?: string; requestedTenantCode?: string} = {},
) {
  validateCorrelationId(context.correlationId);
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal);
  const {tenantId, principal} = effective;
  const decision = authorize({principal, action: 'slot:read', resourceTenantId: tenantId, resourceRef: 'synthetic-doctors-catalog', correlationId: context.correlationId});
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'doctor catalog access is not permitted');
  if (options.requestedTenantCode !== undefined) {
    if (!SYNTHETIC_REF_RE.test(options.requestedTenantCode)) throw new SchedulingError(400, 'invalid_tenant_id', 'tenant_id must be a synthetic tenant code');
    const tenant = await deps.prisma.tenant.findUnique({where: {id: tenantId}, select: {code: true}});
    if (!tenant || tenant.code !== options.requestedTenantCode) return {data: []};
  }
  const rows = await deps.prisma.practitioner.findMany({
    where: {tenantId, ...(options.specialty ? {specialty: options.specialty} : {})},
    include: {user: {select: {subject: true}}},
    orderBy: {id: 'asc'},
  });
  return {
    data: rows.map((row) => ({
      id: row.id,
      display_name: row.user?.subject ? `synthetic-doctor-${row.user.subject}` : `synthetic-doctor-${row.id}`,
      specialty: row.specialty,
    })),
  };
}
