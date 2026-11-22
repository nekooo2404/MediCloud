import {randomUUID} from 'node:crypto';
import {Prisma, PrismaClient} from '@prisma/client';
import {validateEventEnvelope} from '../scheduling/event-validation.js';

export type OutboxDb = PrismaClient | Prisma.TransactionClient;
export type ApprovedEventType = 'appointment.created' | 'appointment.cancelled' | 'encounter.completed' | 'report.ready' | 'notification.requested' | 'analytics.daily_summary';

export interface EventInput {
  eventId?: string;
  eventType: ApprovedEventType;
  /** Synthetic tenant code carried in the approved event envelope. */
  tenantId: string;
  /** Internal database UUID used only for the outbox foreign key. */
  databaseTenantId?: string;
  occurredAt?: Date;
  correlationId: string;
  payload: Record<string, unknown>;
}

export function createApprovedEvent(input: EventInput) {
  const event = {
    event_id: input.eventId ?? randomUUID(),
    event_type: input.eventType,
    schema_version: 1,
    tenant_id: input.tenantId,
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
    correlation_id: input.correlationId,
    payload: input.payload,
  };
  validateEventEnvelope(event);
  return event;
}

export async function insertOutboxEvent(db: OutboxDb, input: EventInput) {
  const event = createApprovedEvent(input);
  const tenant = await db.tenant.findUnique({where: {code: event.tenant_id}, select: {id: true}});
  if (!tenant) throw new Error(`unknown tenant code: ${event.tenant_id}`);
  if (input.databaseTenantId && input.databaseTenantId !== tenant.id) throw new Error('tenant envelope does not match database tenant');
  return db.outboxEvent.create({data: {
    eventId: event.event_id,
    tenantId: tenant.id,
    eventType: event.event_type,
    schemaVersion: event.schema_version,
    correlationId: event.correlation_id,
    payload: event.payload as Prisma.InputJsonValue,
  }});
}

export function isApprovedEventType(value: string): value is ApprovedEventType {
  return ['appointment.created', 'appointment.cancelled', 'encounter.completed', 'report.ready', 'notification.requested', 'analytics.daily_summary'].includes(value);
}
