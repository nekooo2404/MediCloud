import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Prisma, type PrismaClient} from '@prisma/client';
import {
  FhirBoundaryError,
  FhirConformanceError,
  FhirTransportError,
  type PrivateHapiFhirClient,
  toFhirEncounter,
  toFhirObservation,
  toFhirPatient,
} from '../fhir/hapi-fhir-adapter.js';
import {validateEventEnvelope} from '../scheduling/event-validation.js';
import {
  effectivePrincipal,
  type SchedulingDependencies,
  SchedulingError,
  validateCorrelationId,
} from '../scheduling/service.js';
import {authorize} from '../security/authorization.js';
import {toAuthorizationAudit} from '../security/redacted-audit.js';
import type {AuthenticatedPrincipal} from '../security/types.js';

const classificationPath = fileURLToPath(new URL('../../../../packages/contracts/data-classification.json', import.meta.url));
const classification = JSON.parse(readFileSync(classificationPath, 'utf8')) as {
  prohibited_event_fields: readonly string[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYNTHETIC_REF_RE = /^synthetic-[a-z0-9-]+$/;
const UNIT_RE = /^[a-zA-Z0-9/%._-]{1,32}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface ClinicalRequestContext {
  principal: AuthenticatedPrincipal;
  correlationId: string;
  purpose?: string;
  delegatedPatientSubject?: string;
}

export interface ClinicalDependencies extends SchedulingDependencies {
  fhirClient?: PrivateHapiFhirClient;
}

export interface CreateEncounterInput {
  appointmentId: string;
  practitionerId: string;
}

export interface CreateObservationInput {
  code: string;
  value: number;
  unit: string;
  measuredAt: string;
}

function assertUuid(value: string, fieldName: string): void {
  if (!UUID_RE.test(value)) {
    throw new SchedulingError(400, `invalid_${fieldName}`, `${fieldName} must be a valid UUID`);
  }
}

function assertSyntheticObservationInput(input: CreateObservationInput): Date {
  if (input.code.length > 64 || !SYNTHETIC_REF_RE.test(input.code)) {
    throw new SchedulingError(400, 'invalid_synthetic_code', 'observation code must use a synthetic identifier (max 64 chars)');
  }
  const loweredCode = input.code.toLowerCase();
  const loweredUnit = input.unit.toLowerCase();
  for (const prohibited of [...classification.prohibited_event_fields, 'bearer', 'token']) {
    if (loweredCode.includes(prohibited) || loweredUnit.includes(prohibited)) {
      throw new SchedulingError(400, 'prohibited_clinical_content', 'observation input contains a prohibited field marker');
    }
  }
  if (typeof input.value !== 'number' || !Number.isFinite(input.value) || Math.abs(input.value) >= 100_000_000) {
    throw new SchedulingError(400, 'invalid_observation_value', 'observation value must be a finite number within Decimal(12,4) bounds');
  }
  if (!UNIT_RE.test(input.unit)) {
    throw new SchedulingError(400, 'invalid_observation_unit', 'observation unit is invalid');
  }
  if (!ISO_DATETIME_RE.test(input.measuredAt)) {
    throw new SchedulingError(400, 'invalid_measured_at', 'measured_at must be a valid ISO-8601 date-time');
  }
  const measuredAt = new Date(input.measuredAt);
  if (Number.isNaN(measuredAt.valueOf())) {
    throw new SchedulingError(400, 'invalid_measured_at', 'measured_at must be a valid ISO-8601 date-time');
  }
  return measuredAt;
}

function normalizePurposeForAudit(purpose: string | undefined): string {
  return purpose && /^[a-z0-9_-]{1,64}$/.test(purpose) ? purpose : 'unspecified';
}

function safeSyntheticRef(value: string | undefined, fallback = 'synthetic-redacted-resource'): string {
  return value && SYNTHETIC_REF_RE.test(value) ? value : fallback;
}

function sanitizeAuditMetadata(metadata: Record<string, string | number | boolean>): Prisma.InputJsonValue {
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      if (/\bBearer\s+/i.test(value)) continue;
      sanitized[key] = value.slice(0, 120);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as Prisma.InputJsonValue;
}

async function resolveActorId(client: DbClient, subject: string): Promise<string | null> {
  const actor = await client.user.findUnique({where: {subject}, select: {id: true}});
  return actor?.id ?? null;
}

async function recordAuditEvent(
  client: DbClient,
  input: {
    tenantId: string;
    actorSubject: string;
    actorId?: string | null;
    action: string;
    resourceRef: string;
    purpose: string;
    correlationId: string;
    metadata?: Record<string, string | number | boolean>;
  },
) {
  const actorId = input.actorId !== undefined ? input.actorId : await resolveActorId(client, input.actorSubject);
  return client.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorId,
      action: input.action.slice(0, 80),
      resourceRef: safeSyntheticRef(input.resourceRef),
      purpose: input.purpose.slice(0, 120),
      correlationId: safeSyntheticRef(input.correlationId, 'synthetic-redacted-correlation'),
      metadata: sanitizeAuditMetadata(input.metadata ?? {}),
    },
  });
}

function handleFhirBuild<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof FhirConformanceError || error instanceof FhirBoundaryError) {
      throw new SchedulingError(400, error.code, error.message);
    }
    throw error;
  }
}

async function handleFhirSync<T>(
  fn: () => Promise<T>,
  auditContext: {
    prisma: PrismaClient;
    tenantId: string;
    actorSubject: string;
    resourceRef: string;
    purpose: string;
    correlationId: string;
  },
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof FhirConformanceError || error instanceof FhirBoundaryError) {
      throw new SchedulingError(400, error.code, error.message);
    }
    if (error instanceof FhirTransportError) {
      await recordAuditEvent(auditContext.prisma, {
        tenantId: auditContext.tenantId,
        actorSubject: auditContext.actorSubject,
        action: 'fhir.sync.failed',
        resourceRef: auditContext.resourceRef,
        purpose: auditContext.purpose,
        correlationId: auditContext.correlationId,
        metadata: {reason: error.code, status: error.status},
      });
      throw new SchedulingError(500, error.code, 'Private FHIR synchronization failed');
    }
    throw error;
  }
}

export async function createEncounter(
  deps: ClinicalDependencies,
  context: ClinicalRequestContext,
  input: CreateEncounterInput,
) {
  validateCorrelationId(context.correlationId);
  assertUuid(input.appointmentId, 'appointment_id');
  assertUuid(input.practitionerId, 'practitioner_id');

  const effective = await effectivePrincipal(deps, deps.prisma, context.principal);
  const {tenantId, principal} = effective;
  const purposeForAudit = normalizePurposeForAudit(context.purpose);

  const appointment = await deps.prisma.appointment.findUnique({
    where: {id: input.appointmentId},
    include: {
      tenant: {select: {code: true}},
      patient: {select: {id: true, profileRef: true}},
      slot: {include: {schedule: {include: {practitioner: {include: {user: {select: {subject: true}}}}}}}},
    },
  });

  if (!appointment || appointment.tenantId !== tenantId) {
    await recordAuditEvent(deps.prisma, {
      tenantId,
      actorSubject: principal.subject,
      action: 'encounter.create.denied',
      resourceRef: 'synthetic-redacted-resource',
      purpose: purposeForAudit,
      correlationId: context.correlationId,
      metadata: {reason: 'resource_not_found'},
    });
    throw new SchedulingError(404, 'appointment_not_found', 'appointment not found');
  }

  const practitioner = await deps.prisma.practitioner.findFirst({
    where: {id: input.practitionerId, tenantId},
    include: {user: {select: {subject: true}}},
  });
  if (!practitioner) {
    await recordAuditEvent(deps.prisma, {
      tenantId,
      actorSubject: principal.subject,
      action: 'encounter.create.denied',
      resourceRef: `synthetic-appointment-${appointment.id}`,
      purpose: purposeForAudit,
      correlationId: context.correlationId,
      metadata: {reason: 'practitioner_not_found'},
    });
    throw new SchedulingError(404, 'practitioner_not_found', 'practitioner not found');
  }

  const assignedPractitionerSubject =
    appointment.slot.schedule.practitionerId === practitioner.id
      ? practitioner.user.subject
      : undefined;

  const decision = authorize({
    principal,
    action: 'encounter:create:assigned',
    resourceTenantId: tenantId,
    assignedPractitionerSubject,
    purpose: context.purpose,
    resourceStateAllowed: appointment.status === 'CONFIRMED' || appointment.status === 'COMPLETED',
    resourceRef: `synthetic-appointment-${appointment.id}`,
    correlationId: context.correlationId,
  });

  if (!decision.allowed) {
    const redactedAudit = toAuthorizationAudit(decision, context.correlationId);
    await recordAuditEvent(deps.prisma, {
      tenantId,
      actorSubject: principal.subject,
      action: 'encounter.create.denied',
      resourceRef: redactedAudit.resource_ref,
      purpose: purposeForAudit,
      correlationId: redactedAudit.correlation_id,
      metadata: {reason: redactedAudit.reason},
    });
    throw new SchedulingError(decision.status as 401 | 403 | 404, decision.reason, 'encounter creation is not permitted');
  }

  const encounterId = randomUUID();
  const createdAt = new Date();
  const fhirPatient = handleFhirBuild(() =>
    toFhirPatient({
      id: appointment.patient.id,
      tenantCode: appointment.tenant.code,
      profileRef: appointment.patient.profileRef,
    }),
  );
  const fhirEncounter = handleFhirBuild(() =>
    toFhirEncounter({
      id: encounterId,
      tenantCode: appointment.tenant.code,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      practitionerId: practitioner.id,
      status: 'OPEN',
      createdAt,
    }),
  );

  const encounter = await deps.prisma.$transaction(async (tx) => {
    const actorId = await resolveActorId(tx, principal.subject);
    const created = await tx.encounter.create({
      data: {
        id: encounterId,
        tenantId,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        practitionerId: practitioner.id,
        status: 'OPEN',
        createdAt,
      },
    });
    await recordAuditEvent(tx, {
      tenantId,
      actorSubject: principal.subject,
      actorId,
      action: 'encounter.create',
      resourceRef: `synthetic-encounter-${created.id}`,
      purpose: context.purpose!,
      correlationId: context.correlationId,
      metadata: {status: 'open'},
    });
    return created;
  });

  if (deps.fhirClient) {
    const client = deps.fhirClient;
    await handleFhirSync(
      async () => {
        await client.upsertResource(fhirPatient, context.correlationId);
        await client.upsertResource(fhirEncounter, context.correlationId);
      },
      {
        prisma: deps.prisma,
        tenantId,
        actorSubject: principal.subject,
        resourceRef: `synthetic-encounter-${encounter.id}`,
        purpose: context.purpose!,
        correlationId: context.correlationId,
      },
    );
  }

  return {
    id: encounter.id,
    appointment_id: encounter.appointmentId,
    practitioner_id: encounter.practitionerId,
    status: 'open' as const,
    correlation_id: context.correlationId,
  };
}

export async function createObservation(
  deps: ClinicalDependencies,
  context: ClinicalRequestContext,
  encounterId: string,
  input: CreateObservationInput,
) {
  validateCorrelationId(context.correlationId);
  assertUuid(encounterId, 'encounter_id');
  const measuredAt = assertSyntheticObservationInput(input);

  const effective = await effectivePrincipal(deps, deps.prisma, context.principal);
  const {tenantId, principal} = effective;
  const purposeForAudit = normalizePurposeForAudit(context.purpose);

  const encounter = await deps.prisma.encounter.findUnique({
    where: {id: encounterId},
    include: {
      tenant: {select: {code: true}},
      practitioner: {include: {user: {select: {subject: true}}}},
    },
  });

  if (!encounter || encounter.tenantId !== tenantId) {
    await recordAuditEvent(deps.prisma, {
      tenantId,
      actorSubject: principal.subject,
      action: 'observation.create.denied',
      resourceRef: 'synthetic-redacted-resource',
      purpose: purposeForAudit,
      correlationId: context.correlationId,
      metadata: {reason: 'resource_not_found'},
    });
    throw new SchedulingError(404, 'encounter_not_found', 'encounter not found');
  }

  const decision = authorize({
    principal,
    action: 'observation:create:assigned',
    resourceTenantId: tenantId,
    assignedPractitionerSubject: encounter.practitioner.user.subject,
    purpose: context.purpose,
    resourceStateAllowed: encounter.status === 'OPEN',
    resourceRef: `synthetic-encounter-${encounter.id}`,
    correlationId: context.correlationId,
  });

  if (!decision.allowed) {
    const redactedAudit = toAuthorizationAudit(decision, context.correlationId);
    await recordAuditEvent(deps.prisma, {
      tenantId,
      actorSubject: principal.subject,
      action: 'observation.create.denied',
      resourceRef: redactedAudit.resource_ref,
      purpose: purposeForAudit,
      correlationId: redactedAudit.correlation_id,
      metadata: {reason: redactedAudit.reason},
    });
    throw new SchedulingError(decision.status as 401 | 403 | 404, decision.reason, 'observation creation is not permitted');
  }

  const observationId = randomUUID();
  const completedAt = new Date();
  const fhirObservation = handleFhirBuild(() =>
    toFhirObservation({
      id: observationId,
      tenantCode: encounter.tenant.code,
      encounterId: encounter.id,
      patientId: encounter.patientId,
      code: input.code,
      value: input.value,
      unit: input.unit,
      measuredAt,
    }),
  );
  const fhirEncounter = handleFhirBuild(() =>
    toFhirEncounter({
      id: encounter.id,
      tenantCode: encounter.tenant.code,
      appointmentId: encounter.appointmentId,
      patientId: encounter.patientId,
      practitionerId: encounter.practitionerId,
      status: 'COMPLETED',
      createdAt: encounter.createdAt,
      completedAt,
    }),
  );

  const observation = await deps.prisma.$transaction(async (tx) => {
    const actorId = await resolveActorId(tx, principal.subject);
    // Atomic compare-and-set transition prevents concurrent double-completion and duplicate outbox emission.
    const transitioned = await tx.encounter.updateMany({
      where: {id: encounter.id, tenantId, status: 'OPEN'},
      data: {status: 'COMPLETED', completedAt},
    });
    if (transitioned.count !== 1) {
      throw new SchedulingError(403, 'resource_state_denied', 'observation creation is not permitted for a completed encounter');
    }

    const created = await tx.observation.create({
      data: {
        id: observationId,
        tenantId,
        encounterId: encounter.id,
        code: input.code,
        value: input.value,
        unit: input.unit,
        measuredAt,
      },
    });
    const observationCount = await tx.observation.count({
      where: {tenantId, encounterId: encounter.id},
    });

    // Outbox envelope strictly carries allowlisted synthetic reference and aggregate count (AC-08).
    const event = {
      event_id: randomUUID(),
      event_type: 'encounter.completed',
      schema_version: 1,
      tenant_id: encounter.tenant.code,
      occurred_at: completedAt.toISOString(),
      correlation_id: context.correlationId,
      payload: {
        encounter_ref: `synthetic-encounter-${encounter.id}`,
        observation_count: observationCount,
      },
    };
    validateEventEnvelope(event);
    deps.validateOutboxEvent?.(event);
    await tx.outboxEvent.create({
      data: {
        eventId: event.event_id,
        tenantId,
        eventType: event.event_type,
        schemaVersion: event.schema_version,
        correlationId: event.correlation_id,
        payload: event.payload as Prisma.InputJsonValue,
      },
    });

    await recordAuditEvent(tx, {
      tenantId,
      actorSubject: principal.subject,
      actorId,
      action: 'observation.create',
      resourceRef: `synthetic-observation-${created.id}`,
      purpose: context.purpose!,
      correlationId: context.correlationId,
      metadata: {
        encounter_ref: `synthetic-encounter-${encounter.id}`,
        status: 'completed',
      },
    });
    return created;
  });

  if (deps.fhirClient) {
    const client = deps.fhirClient;
    await handleFhirSync(
      async () => {
        await client.upsertResource(fhirEncounter, context.correlationId);
        await client.upsertResource(fhirObservation, context.correlationId);
      },
      {
        prisma: deps.prisma,
        tenantId,
        actorSubject: principal.subject,
        resourceRef: `synthetic-observation-${observation.id}`,
        purpose: context.purpose!,
        correlationId: context.correlationId,
      },
    );
  }

  return {
    id: observation.id,
    encounter_id: observation.encounterId,
    code: observation.code,
    value: Number(observation.value),
    unit: observation.unit,
    correlation_id: context.correlationId,
  };
}

export async function listMyRecords(deps: ClinicalDependencies, context: ClinicalRequestContext) {
  validateCorrelationId(context.correlationId);
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal);
  const {tenantId, principal} = effective;

  const isPatient = principal.roles.includes('PATIENT');
  const isGuardian = !isPatient && principal.roles.includes('GUARDIAN');
  const action = isGuardian ? 'record:read:delegated' : 'record:read:self';
  const targetSubject = isPatient ? principal.subject : isGuardian ? context.delegatedPatientSubject : undefined;

  const decision = authorize({
    principal,
    action,
    resourceTenantId: tenantId,
    resourceOwnerSubject: targetSubject,
    delegatedSubject: targetSubject,
    resourceRef: 'synthetic-records-self',
    correlationId: context.correlationId,
  });

  if (!decision.allowed) {
    const redactedAudit = toAuthorizationAudit(decision, context.correlationId);
    await recordAuditEvent(deps.prisma, {
      tenantId,
      actorSubject: principal.subject,
      action: 'record.read.denied',
      resourceRef: redactedAudit.resource_ref,
      purpose: 'operations',
      correlationId: redactedAudit.correlation_id,
      metadata: {reason: redactedAudit.reason},
    });
    throw new SchedulingError(decision.status as 401 | 403 | 404, decision.reason, 'record access is not permitted');
  }

  const patientId = targetSubject ? await deps.resolvePatientId(deps.prisma, tenantId, targetSubject) : undefined;
  if (!patientId) {
    await recordAuditEvent(deps.prisma, {
      tenantId,
      actorSubject: principal.subject,
      action: 'record.read',
      resourceRef: 'synthetic-records-self',
      purpose: 'treatment',
      correlationId: context.correlationId,
      metadata: {record_count: 0},
    });
    return {data: [] as Array<{resource_ref: string; kind: 'encounter' | 'observation' | 'report'}>};
  }

  const [encounters, observations] = await Promise.all([
    deps.prisma.encounter.findMany({where: {tenantId, patientId}, select: {id: true}, orderBy: {createdAt: 'desc'}}),
    deps.prisma.observation.findMany({where: {tenantId, encounter: {patientId}}, select: {id: true}, orderBy: {measuredAt: 'desc'}}),
  ]);

  const data: Array<{resource_ref: string; kind: 'encounter' | 'observation' | 'report'}> = [
    ...encounters.map((enc) => ({resource_ref: `synthetic-encounter-${enc.id}`, kind: 'encounter' as const})),
    ...observations.map((obs) => ({resource_ref: `synthetic-observation-${obs.id}`, kind: 'observation' as const})),
  ];

  await recordAuditEvent(deps.prisma, {
    tenantId,
    actorSubject: principal.subject,
    action: 'record.read',
    resourceRef: 'synthetic-records-self',
    purpose: 'treatment',
    correlationId: context.correlationId,
    metadata: {record_count: data.length},
  });

  return {data};
}

export async function getAdminMetrics(
  deps: ClinicalDependencies,
  context: ClinicalRequestContext,
  from?: Date,
  to?: Date,
) {
  validateCorrelationId(context.correlationId);
  const effective = await effectivePrincipal(deps, deps.prisma, context.principal);
  const {tenantId, principal} = effective;

  const decision = authorize({
    principal,
    action: 'metrics:read:tenant',
    resourceTenantId: tenantId,
    resourceRef: 'synthetic-metrics-tenant',
    correlationId: context.correlationId,
  });

  if (!decision.allowed) {
    const redactedAudit = toAuthorizationAudit(decision, context.correlationId);
    await recordAuditEvent(deps.prisma, {
      tenantId,
      actorSubject: principal.subject,
      action: 'metrics.read.denied',
      resourceRef: redactedAudit.resource_ref,
      purpose: 'audit',
      correlationId: redactedAudit.correlation_id,
      metadata: {reason: redactedAudit.reason},
    });
    throw new SchedulingError(decision.status as 401 | 403 | 404, decision.reason, 'metrics access is not permitted');
  }

  const rangeFilter = from || to ? {...(from ? {gte: from} : {}), ...(to ? {lte: to} : {})} : undefined;
  const [appointmentsTotal, encountersTotal, observationsTotal, auditEventsTotal, outboxPendingTotal] = await Promise.all([
    deps.prisma.appointment.count({where: {tenantId, ...(rangeFilter ? {createdAt: rangeFilter} : {})}}),
    deps.prisma.encounter.count({where: {tenantId, ...(rangeFilter ? {createdAt: rangeFilter} : {})}}),
    deps.prisma.observation.count({where: {tenantId, ...(rangeFilter ? {measuredAt: rangeFilter} : {})}}),
    deps.prisma.auditEvent.count({where: {tenantId, ...(rangeFilter ? {occurredAt: rangeFilter} : {})}}),
    deps.prisma.outboxEvent.count({where: {tenantId, status: 'PENDING', ...(rangeFilter ? {createdAt: rangeFilter} : {})}}),
  ]);

  await recordAuditEvent(deps.prisma, {
    tenantId,
    actorSubject: principal.subject,
    action: 'metrics.read',
    resourceRef: 'synthetic-metrics-tenant',
    purpose: 'audit',
    correlationId: context.correlationId,
    metadata: {status: 'ok'},
  });

  return {
    data: {
      appointments_total: appointmentsTotal,
      encounters_total: encountersTotal,
      observations_total: observationsTotal,
      audit_events_total: auditEventsTotal,
      outbox_pending_total: outboxPendingTotal,
    },
    correlation_id: context.correlationId,
  };
}
