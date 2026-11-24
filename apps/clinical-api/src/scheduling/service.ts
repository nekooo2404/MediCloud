import {createHash, randomUUID} from 'node:crypto';
import {AppointmentStatus, CheckInStatus, Prisma, PrismaClient, QueueTicketStatus} from '@prisma/client';
import {setTransactionTenantContext, type RlsSqlExecutor} from '../db/tenant-rls.js';
import {authorize} from '../security/authorization.js';
import type {AuthenticatedPrincipal, Role} from '../security/types.js';
import {validateEventEnvelope} from './event-validation.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface SchedulingRequestContext {
  principal: AuthenticatedPrincipal;
  correlationId: string;
  idempotencyHeader: string;
  serverChannel?: 'portal' | 'staff';
  requestedTenantId?: string;
}

export interface CreateAppointmentInput {
  slotId: string;
  patientId?: string;
  idempotencyKey: string;
  visitType?: string;
  visitReason?: string;
  intakeNote?: string;
}

export interface RescheduleAppointmentInput {
  newSlotId: string;
  idempotencyKey: string;
  reason?: string;
}

export interface PublishDoctorSlotsInput {
  practitionerId: string;
  startsAt: string;
  endsAt: string;
  slotDurationMinutes?: number;
  capacity?: number;
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
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 500,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SchedulingError';
  }
}

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];
const SYNTHETIC_REF_RE = /^synthetic-[a-z0-9-]+$/;
const CORRELATION_ID_RE = /^(?:synthetic-[a-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES: readonly Role[] = ['PATIENT', 'GUARDIAN', 'RECEPTIONIST', 'PHYSICIAN', 'NURSE', 'AUDITOR'];

export function validateCorrelationId(correlationId: string): void {
  if (!CORRELATION_ID_RE.test(correlationId)) {
    throw new SchedulingError(400, 'invalid_correlation_id', 'correlation_id is invalid');
  }
}

function validateAppointmentCreatedEvent(event: {
  event_id: string;
  event_type: string;
  schema_version: number;
  tenant_id: string;
  occurred_at: string;
  correlation_id: string;
  payload: Record<string, unknown>;
}) {
  if (
    event.event_type !== 'appointment.created' ||
    event.schema_version !== 1 ||
    !SYNTHETIC_REF_RE.test(event.tenant_id) ||
    !CORRELATION_ID_RE.test(event.correlation_id)
  ) {
    throw new SchedulingError(500, 'event_validation_failed', 'event validation failed');
  }
  const keys = Object.keys(event.payload).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== 'appointment_ref' ||
    keys[1] !== 'channel' ||
    !SYNTHETIC_REF_RE.test(String(event.payload.appointment_ref)) ||
    !['portal', 'staff'].includes(String(event.payload.channel))
  ) {
    throw new SchedulingError(500, 'event_validation_failed', 'event validation failed');
  }
}

async function resolveTenantIdReference(client: DbClient, requestedTenantId: string): Promise<string | undefined> {
  if (UUID_RE.test(requestedTenantId)) return requestedTenantId;
  const tenantModel = (client as Partial<PrismaClient>).tenant;
  if (!tenantModel || typeof tenantModel.findUnique !== 'function') return undefined;
  const row = await tenantModel.findUnique({where: {code: requestedTenantId}, select: {id: true}});
  return row?.id;
}

export async function effectivePrincipal(
  deps: Pick<SchedulingDependencies, 'resolveMembership'>,
  client: DbClient,
  principal: AuthenticatedPrincipal,
  requestedTenantId?: string,
) {
  const memberships = await deps.resolveMembership(client, principal.subject);
  const activeMemberships = memberships.filter((entry) => entry.active);
  if (activeMemberships.length === 0) {
    throw new SchedulingError(403, 'tenant_membership_required', 'an active tenant membership is required');
  }

  let selectedTenantId: string | undefined;
  if (requestedTenantId) {
    const resolvedId = await resolveTenantIdReference(client, requestedTenantId);
    const hasAccess = activeMemberships.some(
      (entry) => entry.tenantId === requestedTenantId || (resolvedId !== undefined && entry.tenantId === resolvedId),
    );
    if (!hasAccess) {
      throw new SchedulingError(404, 'resource_not_found', 'tenant not found');
    }
    selectedTenantId = resolvedId ?? requestedTenantId;
  } else {
    const distinctTenants = Array.from(new Set(activeMemberships.map((entry) => entry.tenantId)));
    if (distinctTenants.length !== 1) {
      throw new SchedulingError(403, 'tenant_selection_required', 'an unambiguous active tenant membership is required');
    }
    selectedTenantId = distinctTenants[0];
  }

  const aggregatedRoles = Array.from(
    new Set(
      activeMemberships
        .filter((entry) => entry.tenantId === selectedTenantId)
        .flatMap((entry) => entry.roles)
        .filter((role): role is Role => VALID_ROLES.includes(role as Role)),
    ),
  );
  if (aggregatedRoles.length === 0) {
    throw new SchedulingError(403, 'tenant_membership_required', 'active tenant role is required');
  }

  const delegations = await hydrateActiveDelegations(client, selectedTenantId, principal);

  return {
    tenantId: selectedTenantId,
    principal: {
      ...principal,
      tenantIds: [selectedTenantId],
      roles: aggregatedRoles,
      ...(delegations.length > 0 ? {delegations} : {}),
    },
  };
}

async function hydrateActiveDelegations(
  client: DbClient,
  tenantId: string,
  principal: AuthenticatedPrincipal,
): Promise<NonNullable<AuthenticatedPrincipal['delegations']>> {
  const baseDelegations = principal.delegations ? [...principal.delegations] : [];
  const delModel = (client as Partial<PrismaClient>).guardianDelegation;
  if (!delModel || typeof delModel.findMany !== 'function') return baseDelegations;
  const userModel = (client as Partial<PrismaClient>).user;
  if (!userModel || typeof userModel.findUnique !== 'function') return baseDelegations;
  const user = await userModel.findUnique({where: {subject: principal.subject}, select: {id: true}});
  if (!user) return baseDelegations;

  const dbDelegations = await delModel.findMany({
    where: {tenantId, guardianUserId: user.id, revokedAt: null},
    include: {patient: {include: {user: {select: {subject: true}}}}},
  });
  for (const row of dbDelegations) {
    const subject = row.patient?.user?.subject;
    if (!subject) continue;
    baseDelegations.push({
      tenantId,
      patientSubject: subject,
      scope: row.scope,
      expiresAt: (row.expiresAt ?? new Date(Date.now() + 86_400_000)).toISOString(),
      revoked: row.revokedAt !== null,
    });
  }
  return baseDelegations;
}

export function validateBookingRequest(
  input: CreateAppointmentInput,
  context: Pick<SchedulingRequestContext, 'correlationId' | 'idempotencyHeader'>,
): void {
  validateCorrelationId(context.correlationId);
  if (!/^[\w-]{16,128}$/.test(input.idempotencyKey) || input.idempotencyKey !== context.idempotencyHeader) {
    throw new SchedulingError(409, 'idempotency_key_mismatch', 'Idempotency-Key must match body.idempotency_key');
  }
}

export function bookingFingerprint(input: Pick<CreateAppointmentInput, 'slotId' | 'patientId'>, serverChannel: 'portal' | 'staff'): string {
  return createHash('sha256').update(JSON.stringify([input.slotId, input.patientId ?? null, serverChannel])).digest('hex');
}

function canonicalBookingRequestHash(
  input: Pick<CreateAppointmentInput, 'slotId' | 'patientId' | 'visitType' | 'visitReason' | 'intakeNote'>,
  patientId: string,
  actorSubject: string,
  serverChannel: 'portal' | 'staff',
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        slotId: input.slotId,
        patientId,
        actorSubject,
        serverChannel,
        visitType: input.visitType ?? null,
        visitReason: input.visitReason ?? null,
        intakeNote: input.intakeNote ?? null,
      }),
    )
    .digest('hex');
}

function appointmentResponse(
  appointment: {
    id: string;
    tenantId: string;
    slotId: string;
    status: AppointmentStatus;
    checkInStatus?: string;
    checkedInAt?: Date | null;
    visitType?: string | null;
    visitReason?: string | null;
    intakeNote?: string | null;
    cancelReason?: string | null;
    cancelledAt?: Date | null;
    rescheduledFromId?: string | null;
  },
  correlationId: string,
) {
  return {
    id: appointment.id,
    tenant_id: appointment.tenantId,
    slot_id: appointment.slotId,
    status: appointment.status.toLowerCase(),
    check_in_status: (appointment.checkInStatus ?? 'NOT_CHECKED_IN').toLowerCase(),
    checked_in_at: appointment.checkedInAt?.toISOString() ?? null,
    ...(appointment.visitType !== undefined ? {visit_type: appointment.visitType} : {}),
    ...(appointment.visitReason !== undefined ? {visit_reason: appointment.visitReason} : {}),
    ...(appointment.intakeNote !== undefined ? {intake_note: appointment.intakeNote} : {}),
    ...(appointment.cancelReason !== undefined ? {cancel_reason: appointment.cancelReason} : {}),
    ...(appointment.cancelledAt !== undefined ? {cancelled_at: appointment.cancelledAt?.toISOString() ?? null} : {}),
    ...(appointment.rescheduledFromId !== undefined ? {rescheduled_from_id: appointment.rescheduledFromId} : {}),
    correlation_id: correlationId,
  };
}

function appointmentAction(principal: AuthenticatedPrincipal): 'appointment:read:self' | 'appointment:read:delegated' | 'appointment:read:tenant' {
  if (principal.roles.includes('RECEPTIONIST') || principal.roles.includes('PHYSICIAN') || principal.roles.includes('NURSE')) {
    return 'appointment:read:tenant';
  }
  if (principal.roles.includes('PATIENT')) return 'appointment:read:self';
  if (principal.roles.includes('GUARDIAN')) return 'appointment:read:delegated';
  throw new SchedulingError(403, 'appointment_read_not_permitted', 'appointment access is not permitted');
}

async function applyRlsIfSupported(tx: DbClient, tenantId: string): Promise<void> {
  const executor = tx as unknown as Partial<RlsSqlExecutor>;
  if (typeof executor.$executeRawUnsafe === 'function') {
    await setTransactionTenantContext(executor as RlsSqlExecutor, tenantId);
  }
}

async function loadAppointment(
  deps: SchedulingDependencies,
  context: Pick<SchedulingRequestContext, 'principal' | 'correlationId' | 'requestedTenantId'>,
  appointmentId: string,
) {
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal, context.requestedTenantId);
  const {tenantId, principal} = effective;
  const appointment = await deps.prisma.appointment.findFirst({where: {id: appointmentId, tenantId}});
  if (!appointment) throw new SchedulingError(404, 'appointment_not_found', 'appointment not found');
  const patientSubject = await deps.resolvePatientSubject(deps.prisma, tenantId, appointment.patientId);
  return {tenantId, appointment, patientSubject, principal};
}

export async function getAppointment(
  deps: SchedulingDependencies,
  context: Pick<SchedulingRequestContext, 'principal' | 'correlationId' | 'requestedTenantId'>,
  appointmentId: string,
) {
  const {tenantId, appointment, patientSubject, principal} = await loadAppointment(deps, context, appointmentId);
  const action = appointmentAction(principal);
  const decision = authorize({
    principal,
    action,
    resourceTenantId: tenantId,
    resourceOwnerSubject: patientSubject,
    delegatedSubject: patientSubject,
    resourceRef: `synthetic-appointment-${appointment.id}`,
    correlationId: context.correlationId,
  });
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'appointment access is not permitted');
  return appointmentResponse(appointment, context.correlationId);
}

export async function checkInAppointment(
  deps: SchedulingDependencies,
  context: Pick<SchedulingRequestContext, 'principal' | 'correlationId' | 'requestedTenantId'> & {idempotencyHeader?: string},
  appointmentId: string,
  channel: 'portal' | 'desk',
) {
  if (!['portal', 'desk'].includes(channel)) throw new SchedulingError(400, 'invalid_channel', 'channel is invalid');
  const {tenantId, appointment, patientSubject, principal} = await loadAppointment(deps, context, appointmentId);
  const decision = authorize({
    principal,
    action: 'appointment:check-in',
    resourceTenantId: tenantId,
    resourceOwnerSubject: patientSubject,
    resourceRef: `synthetic-appointment-${appointment.id}`,
    correlationId: context.correlationId,
    resourceStateAllowed: appointment.status === AppointmentStatus.CONFIRMED,
  });
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'appointment check-in is not permitted');

  const updated =
    appointment.checkInStatus === CheckInStatus.CHECKED_IN
      ? appointment
      : await deps.prisma.$transaction(async (tx) => {
          await applyRlsIfSupported(tx, tenantId);
          const actor = await tx.user.findUniqueOrThrow({where: {subject: context.principal.subject}});
          const result = await tx.appointment.update({
            where: {id: appointment.id},
            data: {checkInStatus: CheckInStatus.CHECKED_IN, checkedInAt: new Date(), checkedInByUserId: actor.id},
          });

          const ticketDelegate = (tx as Partial<PrismaClient>).queueTicket;
          if (ticketDelegate && typeof ticketDelegate.upsert === 'function') {
            const ticketCode = `MC-${appointment.id.slice(0, 4).toUpperCase()}`;
            await ticketDelegate.upsert({
              where: {tenantId_appointmentId: {tenantId, appointmentId: appointment.id}},
              update: {status: QueueTicketStatus.WAITING},
              create: {
                id: randomUUID(),
                tenantId,
                appointmentId: appointment.id,
                patientId: appointment.patientId,
                ticketNumber: ticketCode,
                status: QueueTicketStatus.WAITING,
              },
            });
          }

          await tx.auditEvent.create({
            data: {
              tenantId,
              actorId: actor.id,
              action: 'appointment.check_in',
              resourceRef: `synthetic-appointment-${appointment.id}`,
              purpose: 'operations',
              correlationId: context.correlationId,
              metadata: {channel},
            },
          });
          return result;
        });

  return appointmentResponse(updated, context.correlationId);
}

export async function createAppointment(
  deps: SchedulingDependencies,
  context: SchedulingRequestContext,
  input: CreateAppointmentInput,
) {
  validateBookingRequest(input, context);
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal, context.requestedTenantId);
  const {tenantId, principal} = effective;
  if (!tenantId) throw new SchedulingError(403, 'tenant_membership_required', 'active tenant membership is required');

  const channel = context.serverChannel ?? 'portal';

  return deps.prisma.$transaction(async (tx) => {
    await applyRlsIfSupported(tx, tenantId);

    // 1. Resolve patient and authorize BEFORE any idempotency replay (SEC-F).
    const patientId = input.patientId ?? (await deps.resolvePatientId(tx, tenantId, context.principal.subject));
    if (!patientId) throw new SchedulingError(400, 'patient_required', 'patient_id could not be resolved from the active membership');

    const patient = await tx.patient.findFirst({where: {id: patientId, tenantId, status: 'ACTIVE'}});
    if (!patient) throw new SchedulingError(404, 'patient_not_found', 'patient not found');

    const patientSubject = await deps.resolvePatientSubject(tx, tenantId, patientId);
    const decision = authorize({
      principal,
      action: 'appointment:create',
      resourceTenantId: tenantId,
      resourceOwnerSubject: patientSubject,
      delegatedSubject: patientSubject,
      resourceRef: `synthetic-appointment-${input.slotId}`,
      correlationId: context.correlationId,
    });
    if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'appointment creation is not permitted');

    // 2. Check idempotency key AFTER authorization, verifying actor and canonical request hash (SEC-F).
    const requestHash = canonicalBookingRequestHash(input, patientId, principal.subject, channel);
    const existing = await tx.appointment.findUnique({
      where: {tenantId_idempotencyKey: {tenantId, idempotencyKey: input.idempotencyKey}},
    });
    if (existing) {
      if (existing.actorSubject && existing.actorSubject !== principal.subject) {
        throw new SchedulingError(409, 'idempotency_conflict', 'idempotency key belongs to another actor');
      }
      if (existing.requestHash) {
        if (existing.requestHash !== requestHash) {
          throw new SchedulingError(409, 'idempotency_conflict', 'idempotency key was used for another request');
        }
      } else {
        const effectiveInput = {...input, patientId};
        if (
          bookingFingerprint({slotId: existing.slotId, patientId: existing.patientId}, channel) !==
          bookingFingerprint(effectiveInput, channel)
        ) {
          throw new SchedulingError(409, 'idempotency_conflict', 'idempotency key was used for another request');
        }
      }
      return appointmentResponse(existing, context.correlationId);
    }

    // 3. Lock published slot FOR UPDATE (never synthesize slots on the fly: DB-A / CL-B).
    const slot = await tx.$queryRaw<Array<{id: string; tenantId: string; capacity: number; bookedCount: number}>>`
      SELECT "id", "tenantId", "capacity", "bookedCount"
      FROM "appointment_slots"
      WHERE "id" = ${input.slotId}::uuid AND "tenantId" = ${tenantId}::uuid
      FOR UPDATE
    `;
    const lockedSlot = slot[0];
    if (!lockedSlot) throw new SchedulingError(404, 'slot_not_found', 'slot not found');

    const appointmentDelegate = tx.appointment as Partial<typeof tx.appointment>;
    if (typeof appointmentDelegate.findFirst === 'function') {
      const duplicateActive = await appointmentDelegate.findFirst({
        where: {tenantId, patientId, slotId: input.slotId, status: {in: ACTIVE_APPOINTMENT_STATUSES}},
        select: {id: true},
      });
      if (duplicateActive) {
        throw new SchedulingError(409, 'duplicate_active_booking', 'patient already holds an active appointment for this slot');
      }
    }

    const activeCount = await tx.appointment.count({
      where: {tenantId, slotId: input.slotId, status: {in: ACTIVE_APPOINTMENT_STATUSES}},
    });
    if (activeCount >= lockedSlot.capacity) throw new SchedulingError(409, 'slot_capacity_exhausted', 'slot has no remaining capacity');

    await tx.appointmentSlot.update({where: {id: input.slotId}, data: {bookedCount: activeCount + 1}});

    const id = randomUUID();
    const appointment = await tx.appointment.create({
      data: {
        id,
        tenantId,
        patientId,
        slotId: input.slotId,
        status: AppointmentStatus.CONFIRMED,
        idempotencyKey: input.idempotencyKey,
        actorSubject: principal.subject,
        requestHash,
        ...(input.visitType ? {visitType: input.visitType.slice(0, 40)} : {}),
        ...(input.visitReason ? {visitReason: input.visitReason.slice(0, 120)} : {}),
        ...(input.intakeNote ? {intakeNote: input.intakeNote.slice(0, 600)} : {}),
      },
    });

    const tenant = await tx.tenant.findUniqueOrThrow({where: {id: tenantId}, select: {code: true}});
    const event = {
      event_id: randomUUID(),
      event_type: 'appointment.created',
      schema_version: 1,
      tenant_id: tenant.code,
      occurred_at: new Date().toISOString(),
      correlation_id: context.correlationId,
      payload: {appointment_ref: `synthetic-appointment-${id}`, channel},
    };
    validateAppointmentCreatedEvent(event);
    validateEventEnvelope(event);
    deps.validateOutboxEvent?.(event);
    await tx.outboxEvent.create({
      data: {
        eventId: event.event_id,
        tenantId,
        eventType: event.event_type,
        schemaVersion: event.schema_version,
        correlationId: event.correlation_id,
        payload: event.payload,
      },
    });

    const auditDelegate = (tx as Partial<PrismaClient>).auditEvent;
    if (auditDelegate && typeof auditDelegate.create === 'function') {
      const userModel = (tx as Partial<PrismaClient>).user;
      const actor = userModel && typeof userModel.findUnique === 'function'
        ? await userModel.findUnique({where: {subject: principal.subject}, select: {id: true}})
        : null;
      await auditDelegate.create({
        data: {
          tenantId,
          actorId: actor?.id ?? null,
          action: 'appointment.create',
          resourceRef: `synthetic-appointment-${id}`,
          purpose: 'care_coordination',
          correlationId: context.correlationId,
          metadata: {channel},
        },
      });
    }

    return appointmentResponse(appointment, context.correlationId);
  });
}

export async function cancelAppointment(
  deps: SchedulingDependencies,
  context: Pick<SchedulingRequestContext, 'principal' | 'correlationId' | 'requestedTenantId'>,
  appointmentId: string,
  reason: string,
) {
  validateCorrelationId(context.correlationId);
  const {tenantId, appointment, patientSubject, principal} = await loadAppointment(deps, context, appointmentId);

  const isStaff = principal.roles.includes('RECEPTIONIST') || principal.roles.includes('PHYSICIAN');
  const action = isStaff
    ? 'appointment:cancel:tenant'
    : principal.roles.includes('PATIENT')
      ? 'appointment:cancel:self'
      : 'appointment:cancel:delegated';
  const decision = authorize({
    principal,
    action,
    resourceTenantId: tenantId,
    resourceOwnerSubject: patientSubject,
    delegatedSubject: patientSubject,
    resourceRef: `synthetic-appointment-${appointment.id}`,
    correlationId: context.correlationId,
    resourceStateAllowed: ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status),
  });
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'appointment cancellation is not permitted');

  const cleanReason = reason.trim().slice(0, 300);
  if (cleanReason.length < 3) {
    throw new SchedulingError(400, 'cancel_reason_required', 'cancellation reason must be at least 3 characters');
  }

  return deps.prisma.$transaction(async (tx) => {
    await applyRlsIfSupported(tx, tenantId);
    await tx.$queryRaw`
      SELECT "id" FROM "appointment_slots" WHERE "id" = ${appointment.slotId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE
    `;
    const actor = await tx.user.findUnique({where: {subject: principal.subject}, select: {id: true}});
    const updated = await tx.appointment.update({
      where: {id: appointment.id},
      data: {
        status: AppointmentStatus.CANCELLED,
        checkInStatus: CheckInStatus.VOIDED,
        cancelReason: cleanReason,
        cancelledAt: new Date(),
        cancelledByUserId: actor?.id ?? null,
      },
    });
    const remainingActive = await tx.appointment.count({
      where: {tenantId, slotId: appointment.slotId, status: {in: ACTIVE_APPOINTMENT_STATUSES}},
    });
    await tx.appointmentSlot.update({where: {id: appointment.slotId}, data: {bookedCount: remainingActive}});

    await tx.queueTicket.updateMany({
      where: {tenantId, appointmentId: appointment.id, status: {notIn: [QueueTicketStatus.DONE, QueueTicketStatus.SKIPPED]}},
      data: {status: QueueTicketStatus.SKIPPED, completedAt: new Date()},
    });

    await tx.auditEvent.create({
      data: {
        tenantId,
        actorId: actor?.id ?? null,
        action: 'appointment.cancel',
        resourceRef: `synthetic-appointment-${appointment.id}`,
        purpose: 'care_coordination',
        correlationId: context.correlationId,
        metadata: {previous_status: appointment.status.toLowerCase()},
      },
    });

    return appointmentResponse(updated, context.correlationId);
  });
}

export async function rescheduleAppointment(
  deps: SchedulingDependencies,
  context: SchedulingRequestContext,
  appointmentId: string,
  input: RescheduleAppointmentInput,
) {
  validateCorrelationId(context.correlationId);
  if (!/^[\w-]{16,128}$/.test(input.idempotencyKey) || input.idempotencyKey !== context.idempotencyHeader) {
    throw new SchedulingError(409, 'idempotency_key_mismatch', 'Idempotency-Key must match body.idempotency_key');
  }
  const {tenantId, appointment, patientSubject, principal} = await loadAppointment(deps, context, appointmentId);
  if (input.newSlotId === appointment.slotId) {
    throw new SchedulingError(409, 'same_slot_reschedule', 'new slot must differ from existing slot');
  }

  const isStaff = principal.roles.includes('RECEPTIONIST') || principal.roles.includes('PHYSICIAN');
  const action = isStaff
    ? 'appointment:reschedule:tenant'
    : principal.roles.includes('PATIENT')
      ? 'appointment:reschedule:self'
      : 'appointment:reschedule:delegated';
  const decision = authorize({
    principal,
    action,
    resourceTenantId: tenantId,
    resourceOwnerSubject: patientSubject,
    delegatedSubject: patientSubject,
    resourceRef: `synthetic-appointment-${appointment.id}`,
    correlationId: context.correlationId,
  });
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'appointment reschedule is not permitted');

  const channel = context.serverChannel ?? 'portal';

  return deps.prisma.$transaction(async (tx) => {
    await applyRlsIfSupported(tx, tenantId);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({appointmentId, newSlotId: input.newSlotId, actorSubject: principal.subject, channel}))
      .digest('hex');

    const replay = await tx.appointment.findUnique({
      where: {tenantId_idempotencyKey: {tenantId, idempotencyKey: input.idempotencyKey}},
    });
    if (replay) {
      if (replay.requestHash !== requestHash || replay.actorSubject !== principal.subject) {
        throw new SchedulingError(409, 'idempotency_conflict', 'idempotency key was used for another reschedule');
      }
      return appointmentResponse(replay, context.correlationId);
    }

    if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) {
      throw new SchedulingError(403, 'resource_state_denied', 'appointment reschedule is not permitted in current state');
    }

    // Lock slots in deterministic UUID order to prevent deadlocks.
    const slotPair = [appointment.slotId, input.newSlotId].sort();
    const locked = await tx.$queryRaw<Array<{id: string; capacity: number}>>`
      SELECT "id", "capacity" FROM "appointment_slots"
      WHERE "tenantId" = ${tenantId}::uuid AND "id" IN (${slotPair[0]}::uuid, ${slotPair[1]}::uuid)
      ORDER BY "id" ASC FOR UPDATE
    `;
    const targetSlot = locked.find((row) => row.id === input.newSlotId);
    if (!targetSlot) throw new SchedulingError(404, 'slot_not_found', 'target slot not found');

    const targetActive = await tx.appointment.count({
      where: {tenantId, slotId: input.newSlotId, status: {in: ACTIVE_APPOINTMENT_STATUSES}},
    });
    if (targetActive >= targetSlot.capacity) {
      throw new SchedulingError(409, 'slot_capacity_exhausted', 'target slot has no remaining capacity');
    }

    const actor = await tx.user.findUnique({where: {subject: principal.subject}, select: {id: true}});
    await tx.appointment.update({
      where: {id: appointment.id},
      data: {
        status: AppointmentStatus.CANCELLED,
        checkInStatus: CheckInStatus.VOIDED,
        cancelReason: input.reason?.trim().slice(0, 300) || 'rescheduled',
        cancelledAt: new Date(),
        cancelledByUserId: actor?.id ?? null,
      },
    });
    const oldRemaining = await tx.appointment.count({
      where: {tenantId, slotId: appointment.slotId, status: {in: ACTIVE_APPOINTMENT_STATUSES}},
    });
    await tx.appointmentSlot.update({where: {id: appointment.slotId}, data: {bookedCount: oldRemaining}});
    await tx.appointmentSlot.update({where: {id: input.newSlotId}, data: {bookedCount: targetActive + 1}});

    const createdId = randomUUID();
    const created = await tx.appointment.create({
      data: {
        id: createdId,
        tenantId,
        patientId: appointment.patientId,
        slotId: input.newSlotId,
        status: AppointmentStatus.CONFIRMED,
        idempotencyKey: input.idempotencyKey,
        actorSubject: principal.subject,
        requestHash,
        visitType: appointment.visitType,
        visitReason: appointment.visitReason,
        intakeNote: appointment.intakeNote,
        rescheduledFromId: appointment.id,
      },
    });

    const tenant = await tx.tenant.findUniqueOrThrow({where: {id: tenantId}, select: {code: true}});
    const event = {
      event_id: randomUUID(),
      event_type: 'appointment.created',
      schema_version: 1,
      tenant_id: tenant.code,
      occurred_at: new Date().toISOString(),
      correlation_id: context.correlationId,
      payload: {appointment_ref: `synthetic-appointment-${createdId}`, channel},
    };
    validateAppointmentCreatedEvent(event);
    validateEventEnvelope(event);
    deps.validateOutboxEvent?.(event);
    await tx.outboxEvent.create({
      data: {
        eventId: event.event_id,
        tenantId,
        eventType: event.event_type,
        schemaVersion: event.schema_version,
        correlationId: event.correlation_id,
        payload: event.payload,
      },
    });

    await tx.auditEvent.create({
      data: {
        tenantId,
        actorId: actor?.id ?? null,
        action: 'appointment.reschedule',
        resourceRef: `synthetic-appointment-${createdId}`,
        purpose: 'care_coordination',
        correlationId: context.correlationId,
        metadata: {rescheduled_from: `synthetic-appointment-${appointment.id}`},
      },
    });

    return appointmentResponse(created, context.correlationId);
  });
}

export async function markNoShowAppointment(
  deps: SchedulingDependencies,
  context: Pick<SchedulingRequestContext, 'principal' | 'correlationId' | 'requestedTenantId'>,
  appointmentId: string,
  reason = 'patient_no_show',
) {
  validateCorrelationId(context.correlationId);
  const {tenantId, appointment, patientSubject, principal} = await loadAppointment(deps, context, appointmentId);
  const decision = authorize({
    principal,
    action: 'appointment:no-show:tenant',
    resourceTenantId: tenantId,
    resourceOwnerSubject: patientSubject,
    resourceRef: `synthetic-appointment-${appointment.id}`,
    correlationId: context.correlationId,
    resourceStateAllowed: ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status),
  });
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'marking no-show is not permitted');

  return deps.prisma.$transaction(async (tx) => {
    await applyRlsIfSupported(tx, tenantId);
    await tx.$queryRaw`
      SELECT "id" FROM "appointment_slots" WHERE "id" = ${appointment.slotId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE
    `;
    const actor = await tx.user.findUnique({where: {subject: principal.subject}, select: {id: true}});
    const updated = await tx.appointment.update({
      where: {id: appointment.id},
      data: {
        status: AppointmentStatus.NO_SHOW,
        checkInStatus: CheckInStatus.VOIDED,
        cancelReason: reason.trim().slice(0, 300),
      },
    });
    const remaining = await tx.appointment.count({
      where: {tenantId, slotId: appointment.slotId, status: {in: ACTIVE_APPOINTMENT_STATUSES}},
    });
    await tx.appointmentSlot.update({where: {id: appointment.slotId}, data: {bookedCount: remaining}});
    await tx.queueTicket.updateMany({
      where: {tenantId, appointmentId: appointment.id, status: {notIn: [QueueTicketStatus.DONE, QueueTicketStatus.SKIPPED]}},
      data: {status: QueueTicketStatus.SKIPPED, completedAt: new Date()},
    });
    await tx.auditEvent.create({
      data: {
        tenantId,
        actorId: actor?.id ?? null,
        action: 'appointment.no_show',
        resourceRef: `synthetic-appointment-${appointment.id}`,
        purpose: 'operations',
        correlationId: context.correlationId,
        metadata: {reason: reason.slice(0, 80)},
      },
    });
    return appointmentResponse(updated, context.correlationId);
  });
}

const ALLOWED_QUEUE_TRANSITIONS: Record<QueueTicketStatus, readonly QueueTicketStatus[]> = {
  CHECKED_IN: [QueueTicketStatus.WAITING, QueueTicketStatus.CALLED, QueueTicketStatus.SKIPPED],
  WAITING: [QueueTicketStatus.CALLED, QueueTicketStatus.SKIPPED],
  CALLED: [QueueTicketStatus.IN_SERVICE, QueueTicketStatus.WAITING, QueueTicketStatus.SKIPPED],
  IN_SERVICE: [QueueTicketStatus.DONE, QueueTicketStatus.SKIPPED],
  DONE: [],
  SKIPPED: [],
};

export async function transitionQueueTicket(
  deps: SchedulingDependencies,
  context: Pick<SchedulingRequestContext, 'principal' | 'correlationId' | 'requestedTenantId'>,
  ticketId: string,
  toStatusRaw: string,
) {
  validateCorrelationId(context.correlationId);
  const toStatus = toStatusRaw.toUpperCase() as QueueTicketStatus;
  if (!Object.values(QueueTicketStatus).includes(toStatus)) {
    throw new SchedulingError(400, 'invalid_queue_status', 'invalid queue target status');
  }
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal, context.requestedTenantId);
  const {tenantId, principal} = effective;
  const ticket = await deps.prisma.queueTicket.findFirst({where: {id: ticketId, tenantId}});
  if (!ticket) throw new SchedulingError(404, 'queue_ticket_not_found', 'queue ticket not found');

  const allowedTargets = ALLOWED_QUEUE_TRANSITIONS[ticket.status];
  const decision = authorize({
    principal,
    action: 'queue:manage:tenant',
    resourceTenantId: tenantId,
    resourceRef: `synthetic-queue-${ticket.id}`,
    correlationId: context.correlationId,
    resourceStateAllowed: allowedTargets.includes(toStatus),
  });
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'queue transition is not permitted');

  return deps.prisma.$transaction(async (tx) => {
    await applyRlsIfSupported(tx, tenantId);
    const now = new Date();
    const cas = await tx.queueTicket.updateMany({
      where: {id: ticket.id, tenantId, status: ticket.status},
      data: {
        status: toStatus,
        ...(toStatus === QueueTicketStatus.CALLED ? {calledAt: now} : {}),
        ...(toStatus === QueueTicketStatus.IN_SERVICE ? {startedAt: now} : {}),
        ...(toStatus === QueueTicketStatus.DONE || toStatus === QueueTicketStatus.SKIPPED ? {completedAt: now} : {}),
      },
    });
    if (cas.count !== 1) {
      throw new SchedulingError(409, 'queue_state_conflict', 'queue ticket state changed concurrently');
    }
    const actor = await tx.user.findUnique({where: {subject: principal.subject}, select: {id: true}});
    await tx.auditEvent.create({
      data: {
        tenantId,
        actorId: actor?.id ?? null,
        action: 'queue.transition',
        resourceRef: `synthetic-queue-${ticket.id}`,
        purpose: 'operations',
        correlationId: context.correlationId,
        metadata: {from: ticket.status.toLowerCase(), to: toStatus.toLowerCase()},
      },
    });
    const updated = await tx.queueTicket.findUniqueOrThrow({where: {id: ticket.id}});
    return {
      id: updated.id,
      appointment_id: updated.appointmentId,
      ticket_number: updated.ticketNumber,
      status: updated.status.toLowerCase(),
      called_at: updated.calledAt?.toISOString() ?? null,
      started_at: updated.startedAt?.toISOString() ?? null,
      completed_at: updated.completedAt?.toISOString() ?? null,
      correlation_id: context.correlationId,
    };
  });
}

export async function publishDoctorSlots(
  deps: SchedulingDependencies,
  context: Pick<SchedulingRequestContext, 'principal' | 'correlationId' | 'requestedTenantId'>,
  input: PublishDoctorSlotsInput,
) {
  validateCorrelationId(context.correlationId);
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal, context.requestedTenantId);
  const {tenantId, principal} = effective;
  const decision = authorize({
    principal,
    action: 'schedule:publish',
    resourceTenantId: tenantId,
    resourceRef: `synthetic-schedule-${input.practitionerId}`,
    correlationId: context.correlationId,
  });
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'schedule publish not permitted');

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const durationMinutes = input.slotDurationMinutes ?? 60;
  const capacity = input.capacity ?? 3;
  if (
    Number.isNaN(startsAt.valueOf()) ||
    Number.isNaN(endsAt.valueOf()) ||
    endsAt <= startsAt ||
    durationMinutes < 15 ||
    durationMinutes > 180 ||
    capacity < 1 ||
    capacity > 20
  ) {
    throw new SchedulingError(400, 'invalid_schedule_window', 'schedule window or capacity is invalid');
  }

  return deps.prisma.$transaction(async (tx) => {
    await applyRlsIfSupported(tx, tenantId);
    const practitioner = await tx.practitioner.findFirst({where: {id: input.practitionerId, tenantId}});
    if (!practitioner) throw new SchedulingError(404, 'practitioner_not_found', 'practitioner not found');

    const overlapping = await tx.schedule.findFirst({
      where: {
        tenantId,
        practitionerId: practitioner.id,
        startsAt: {lt: endsAt},
        endsAt: {gt: startsAt},
      },
    });
    if (overlapping) {
      throw new SchedulingError(409, 'schedule_overlap', 'schedule overlaps with an existing doctor schedule');
    }

    const schedule = await tx.schedule.create({
      data: {id: randomUUID(), tenantId, practitionerId: practitioner.id, startsAt, endsAt},
    });
    const slotsToCreate: Array<{id: string; tenantId: string; scheduleId: string; startsAt: Date; endsAt: Date; capacity: number}> = [];
    const stepMs = durationMinutes * 60_000;
    for (let cursor = startsAt.getTime(); cursor + stepMs <= endsAt.getTime(); cursor += stepMs) {
      slotsToCreate.push({
        id: randomUUID(),
        tenantId,
        scheduleId: schedule.id,
        startsAt: new Date(cursor),
        endsAt: new Date(cursor + stepMs),
        capacity,
      });
    }
    if (slotsToCreate.length === 0) {
      throw new SchedulingError(400, 'invalid_schedule_window', 'window is shorter than slot duration');
    }
    await tx.appointmentSlot.createMany({data: slotsToCreate});

    const actor = await tx.user.findUnique({where: {subject: principal.subject}, select: {id: true}});
    await tx.auditEvent.create({
      data: {
        tenantId,
        actorId: actor?.id ?? null,
        action: 'schedule.publish',
        resourceRef: `synthetic-schedule-${schedule.id}`,
        purpose: 'operations',
        correlationId: context.correlationId,
        metadata: {slot_count: slotsToCreate.length},
      },
    });

    return {
      schedule_id: schedule.id,
      practitioner_id: practitioner.id,
      slots_created: slotsToCreate.length,
      correlation_id: context.correlationId,
    };
  });
}

export async function listSlots(
  deps: SchedulingDependencies,
  context: Pick<SchedulingRequestContext, 'principal' | 'correlationId' | 'requestedTenantId'>,
  doctorId: string,
  from?: Date,
  to?: Date,
) {
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal, context.requestedTenantId);
  const {tenantId, principal} = effective;
  const decision = authorize({
    principal,
    action: 'slot:read',
    resourceTenantId: tenantId,
    resourceRef: `synthetic-slot-${doctorId}`,
    correlationId: context.correlationId,
  });
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'slot access is not permitted');
  const slots = await deps.prisma.appointmentSlot.findMany({
    where: {
      tenantId,
      schedule: {
        practitionerId: doctorId,
        ...(from || to ? {startsAt: {...(from ? {gte: from} : {}), ...(to ? {lte: to} : {})}} : {}),
      },
    },
    orderBy: {startsAt: 'asc'},
  });
  return {
    data: slots.map((slot) => ({
      id: slot.id,
      starts_at: slot.startsAt.toISOString(),
      ends_at: slot.endsAt?.toISOString() ?? new Date(slot.startsAt.getTime() + 3_600_000).toISOString(),
      capacity: slot.capacity,
      remaining: Math.max(0, slot.capacity - slot.bookedCount),
    })),
    correlation_id: context.correlationId,
  };
}

export async function listSpecialtiesPublic(prisma: PrismaClient) {
  const rows = await prisma.practitioner.findMany({select: {specialty: true}, distinct: ['specialty'], orderBy: {specialty: 'asc'}});
  return {data: rows.map((row) => ({id: row.specialty, name: row.specialty}))};
}

export async function listSpecialties(
  deps: SchedulingDependencies,
  context: Pick<SchedulingRequestContext, 'principal' | 'correlationId' | 'requestedTenantId'>,
) {
  validateCorrelationId(context.correlationId);
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal, context.requestedTenantId);
  const {tenantId, principal} = effective;
  const decision = authorize({
    principal,
    action: 'slot:read',
    resourceTenantId: tenantId,
    resourceRef: 'synthetic-specialties-catalog',
    correlationId: context.correlationId,
  });
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'specialty catalog access is not permitted');
  const rows = await deps.prisma.practitioner.findMany({where: {tenantId}, select: {specialty: true}, distinct: ['specialty'], orderBy: {specialty: 'asc'}});
  return {data: rows.map((row) => ({id: row.specialty, name: row.specialty}))};
}

export async function listDoctors(
  deps: SchedulingDependencies,
  context: Pick<SchedulingRequestContext, 'principal' | 'correlationId' | 'requestedTenantId'>,
  options: {specialty?: string; requestedTenantCode?: string} = {},
) {
  validateCorrelationId(context.correlationId);
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal, context.requestedTenantId);
  const {tenantId, principal} = effective;
  const decision = authorize({
    principal,
    action: 'slot:read',
    resourceTenantId: tenantId,
    resourceRef: 'synthetic-doctors-catalog',
    correlationId: context.correlationId,
  });
  if (!decision.allowed) throw new SchedulingError(decision.status as 403 | 404, decision.reason, 'doctor catalog access is not permitted');
  if (options.requestedTenantCode !== undefined) {
    if (!SYNTHETIC_REF_RE.test(options.requestedTenantCode)) throw new SchedulingError(400, 'invalid_tenant_id', 'tenant_id must be a synthetic tenant code');
    const tenant = await deps.prisma.tenant.findUnique({where: {id: tenantId}, select: {code: true}});
    if (!tenant || tenant.code !== options.requestedTenantCode) return {data: []};
  }
  const rows = await deps.prisma.practitioner.findMany({
    where: {tenantId, ...(options.specialty ? {specialty: options.specialty} : {})},
    include: {user: {select: {subject: true}}, department: {select: {name: true}}},
    orderBy: {id: 'asc'},
  });
  return {
    data: rows.map((row) => ({
      id: row.id,
      display_name: row.displayName ?? (row.user?.subject ? `synthetic-doctor-${row.user.subject}` : `synthetic-doctor-${row.id}`),
      specialty: row.specialty,
      ...(row.roomLabel ? {room_label: row.roomLabel} : {}),
      ...(row.degreeTitle ? {degree_title: row.degreeTitle} : {}),
      ...(row.department?.name ? {department_name: row.department.name} : {}),
    })),
  };
}
