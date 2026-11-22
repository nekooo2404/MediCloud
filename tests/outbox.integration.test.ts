import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest';
import {PrismaClient, OutboxStatus} from '@prisma/client';
import {insertOutboxEvent} from '../apps/clinical-api/src/outbox/policy-gateway.js';
import {processOnce, relayOne} from '../apps/event-relay/src/relay.js';
import {reconcileOutbox} from '../apps/event-relay/src/reconciliation.js';

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const prisma = new PrismaClient();
const uuid = () => crypto.randomUUID();
const runNamespace = `synthetic-t06-${uuid()}`;
const tenantCode = `${runNamespace}-tenant`;
const otherTenantCode = `synthetic-t06-other-${uuid()}`;
const runEventIds = new Set<string>();

async function createEvent(tenantId: string, eventCode: string, eventId = uuid()) {
  const event = await insertOutboxEvent(prisma, {
    eventId,
    eventType: 'appointment.created',
    tenantId: eventCode,
    databaseTenantId: tenantId,
    correlationId: `${runNamespace}-${uuid()}`,
    payload: {appointment_ref: `synthetic-appointment-${uuid()}`, channel: 'portal'}
  });
  runEventIds.add(event.eventId);
  return event;
}

describeDatabase('T06 PostgreSQL outbox and relay integration', () => {
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({data: {code: tenantCode, name: 'Synthetic T06 Relay'}});
    tenantId = tenant.id;
  });

  afterAll(async () => {
    if (runEventIds.size > 0) {
      await prisma.processedEvent.deleteMany({where: {eventId: {in: [...runEventIds]}}});
      await prisma.outboxEvent.deleteMany({where: {eventId: {in: [...runEventIds]}}});
    }
    if (tenantId) await prisma.tenant.delete({where: {id: tenantId}});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    const events = await prisma.outboxEvent.findMany({where: {tenantId}, select: {eventId: true}});
    const eventIds = events.map((event) => event.eventId);
    if (eventIds.length > 0) {
      eventIds.forEach((eventId) => runEventIds.add(eventId));
      await prisma.processedEvent.deleteMany({where: {eventId: {in: eventIds}}});
      await prisma.outboxEvent.deleteMany({where: {eventId: {in: eventIds}}});
    }
  });

  it('rolls back the business transaction when policy validation fails', async () => {
    const code = `${runNamespace}-rollback-${uuid()}`;
    await expect(prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({data: {code, name: 'Synthetic rollback'}});
      await insertOutboxEvent(tx, {eventType: 'appointment.created', tenantId: `${runNamespace}-rollback`, databaseTenantId: tenant.id, correlationId: `${runNamespace}-rollback`, payload: {appointment_ref: 'synthetic-appointment-rollback', channel: 'forbidden'}});
    })).rejects.toThrow();
    expect(await prisma.tenant.findUnique({where: {code}})).toBeNull();
  });

  it('rolls back the business mutation when the outbox database write fails', async () => {
    const code = `${runNamespace}-db-rollback-${uuid()}`;
    const eventId = uuid();
    await createEvent(tenantId, tenantCode, eventId);
    await expect(prisma.$transaction(async (tx) => {
      await tx.tenant.create({data: {code, name: 'Synthetic database rollback'}});
      await insertOutboxEvent(tx, {eventId, eventType: 'appointment.created', tenantId: tenantCode, databaseTenantId: tenantId, correlationId: `synthetic-${uuid()}`, payload: {appointment_ref: `synthetic-${uuid()}`, channel: 'portal'}});
    })).rejects.toThrow();
    expect(await prisma.tenant.findUnique({where: {code}})).toBeNull();
    await prisma.outboxEvent.delete({where: {eventId}});
  });

  it('retries publisher failures with backoff and eventually dead-letters', async () => {
    const event = await createEvent(tenantId, tenantCode);
    const now = new Date('2026-11-22T00:00:00.000Z');
    const failing = {publish: async () => {throw new Error('synthetic publisher failure');}};
    const first = await relayOne({prisma, tenantId, publisher: failing, maxAttempts: 2, baseBackoffMs: 10, now: () => now});
    expect(first).toMatchObject({eventId: event.eventId, status: 'FAILED', attempts: 1});
    await prisma.outboxEvent.update({where: {eventId: event.eventId}, data: {nextAttemptAt: now}});
    expect((await prisma.outboxEvent.findUniqueOrThrow({where: {eventId: event.eventId}})).status).toBe(OutboxStatus.FAILED);
    const second = await relayOne({prisma, tenantId, publisher: failing, maxAttempts: 2, baseBackoffMs: 10, now: () => now});
    expect(second).toMatchObject({eventId: event.eventId, status: 'DEAD_LETTER', attempts: 2});
    expect((await prisma.outboxEvent.findUniqueOrThrow({where: {eventId: event.eventId}})).status).toBe(OutboxStatus.DEAD_LETTER);
  });

  it('uses the database clock for the claim timestamp and lease eligibility', async () => {
    const event = await createEvent(tenantId, tenantCode);
    await prisma.outboxEvent.update({where: {eventId: event.eventId}, data: {status: OutboxStatus.CLAIMED, claimedAt: new Date('2000-01-01T00:00:00.000Z'), claimToken: uuid()}});
    let claimedAt!: Date;
    const result = await relayOne({
      prisma,
      tenantId,
      publisher: {publish: async () => undefined},
      now: () => new Date('2000-01-01T00:00:00.000Z'),
      beforeStatusUpdate: async () => {
        const row = await prisma.outboxEvent.findUniqueOrThrow({where: {eventId: event.eventId}});
        claimedAt = row.claimedAt!;
      }
    });
    expect(result?.status).toBe('DELIVERED');
    const [{databaseNow}] = await prisma.$queryRaw<Array<{databaseNow: Date}>>`SELECT CURRENT_TIMESTAMP AS "databaseNow"`;
    expect(claimedAt.getTime()).toBeGreaterThan(new Date('2020-01-01T00:00:00.000Z').getTime());
    expect(Math.abs(databaseNow.getTime() - claimedAt.getTime())).toBeLessThan(5_000);
  });

  it('recovers an expired claimed lease and only one concurrent worker claims it', async () => {
    const event = await createEvent(tenantId, tenantCode);
    await prisma.outboxEvent.update({where: {eventId: event.eventId}, data: {status: OutboxStatus.CLAIMED, claimedAt: new Date('2026-11-21T00:00:00.000Z'), claimToken: uuid()}});
    const published: string[] = [];
    const publisher = {publish: async (value: {eventId: string}) => {published.push(value.eventId);}};
    const results = await Promise.all([
      relayOne({prisma, tenantId, publisher, leaseMs: 60_000, now: () => new Date('2026-11-22T00:00:00.000Z')}),
      relayOne({prisma, tenantId, publisher, leaseMs: 60_000, now: () => new Date('2026-11-22T00:00:00.000Z')})
    ]);
    expect(results.filter((result) => result?.eventId === event.eventId)).toHaveLength(1);
    expect(published).toEqual([event.eventId]);
  });

  it('protects reclaimed handler claims from stale completion and cleanup', async () => {
    const event = await createEvent(tenantId, tenantCode);
    const firstNow = new Date('2026-11-22T00:00:00.000Z');
    const reclaimedNow = new Date('2026-11-22T00:02:00.000Z');
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const first = processOnce(prisma, event.eventId, `${runNamespace}-race`, async () => firstBlocked, {leaseMs: 60_000, now: () => firstNow});
    await new Promise((resolve) => setImmediate(resolve));
    const second = await processOnce(prisma, event.eventId, `${runNamespace}-race`, async () => undefined, {leaseMs: 60_000, now: () => reclaimedNow});
    expect(second).toBe('PROCESSED');
    releaseFirst();
    expect(await first).toBe('DUPLICATE');
    const row = await prisma.processedEvent.findUniqueOrThrow({where: {eventId_handler: {eventId: event.eventId, handler: `${runNamespace}-race`}}});
    expect(row.status).toBe('PROCESSED');
    expect(row.claimToken).toBeNull();
  });
  it('marks successful publish delivered and handles duplicate processing per handler', async () => {
    const event = await createEvent(tenantId, tenantCode);
    const published: string[] = [];
    const logs: unknown[] = [];
    const result = await relayOne({prisma, tenantId, publisher: {publish: async (value) => {published.push(value.eventId);}}, log: (value) => logs.push(value)});
    expect(result).toMatchObject({eventId: event.eventId, status: 'DELIVERED', attempts: 1});
    expect(published).toEqual([event.eventId]);
    expect(JSON.stringify(logs)).not.toMatch(/access_token|claim_token|full_name|diagnosis|secret|password|raw_payload/);
    const handled: string[] = [];
    expect(await processOnce(prisma, event.eventId, `${runNamespace}-test`, async () => {handled.push(event.eventId);})).toBe('PROCESSED');
    expect(await processOnce(prisma, event.eventId, `${runNamespace}-test`, async () => {handled.push('duplicate');})).toBe('DUPLICATE');
    expect(await processOnce(prisma, event.eventId, `${runNamespace}-other-handler`, async () => {handled.push('other-handler');})).toBe('PROCESSED');
    expect(handled).toEqual([event.eventId, 'other-handler']);
  });

  it('replays a published event safely when the status update fails', async () => {
    const event = await createEvent(tenantId, tenantCode);
    const published: string[] = [];
    const failed = await relayOne({prisma, tenantId, publisher: {publish: async (value) => {published.push(value.eventId);}}, beforeStatusUpdate: async () => {throw new Error('synthetic status database failure');}});
    expect(failed).toMatchObject({eventId: event.eventId, status: 'FAILED', attempts: 1});
    await prisma.outboxEvent.update({where: {eventId: event.eventId}, data: {nextAttemptAt: new Date('2026-11-22T00:00:00.000Z')}});
    expect((await prisma.outboxEvent.findUniqueOrThrow({where: {eventId: event.eventId}})).status).toBe(OutboxStatus.FAILED);
    const replay = await relayOne({prisma, tenantId, publisher: {publish: async (value) => {published.push(value.eventId);}}, now: () => new Date('2026-11-22T00:00:00.000Z')});
    expect(replay).toMatchObject({eventId: event.eventId, status: 'DELIVERED'});
    expect(published).toEqual([event.eventId, event.eventId]);
  });

  it('rejects a mismatched database tenant identifier', async () => {
    const other = await prisma.tenant.create({data: {code: otherTenantCode, name: 'Synthetic other'}});
    await expect(insertOutboxEvent(prisma, {eventType: 'appointment.created', tenantId: tenantCode, databaseTenantId: other.id, correlationId: `synthetic-${uuid()}`, payload: {appointment_ref: 'synthetic-mismatch', channel: 'portal'}})).rejects.toThrow('tenant envelope does not match database tenant');
    await prisma.tenant.delete({where: {id: other.id}});
  });

  it('reconciles status and duplicate counts explicitly', async () => {
    const pending = await createEvent(tenantId, tenantCode);
    const delivered = await createEvent(tenantId, tenantCode);
    const failed = await createEvent(tenantId, tenantCode);
    const dead = await createEvent(tenantId, tenantCode);
    await prisma.outboxEvent.update({where: {eventId: delivered.eventId}, data: {status: OutboxStatus.DELIVERED, deliveredAt: new Date()}});
    await prisma.outboxEvent.update({where: {eventId: failed.eventId}, data: {status: OutboxStatus.FAILED, attempts: 1}});
    await prisma.outboxEvent.update({where: {eventId: dead.eventId}, data: {status: OutboxStatus.DEAD_LETTER, attempts: 2}});
    const processed = await prisma.processedEvent.create({data: {eventId: pending.eventId, handler: `${runNamespace}-reconcile`, duplicateCount: 2}});
    expect(processed.status).toBe('PROCESSING');
    const report = await reconcileOutbox(prisma, tenantId);
    expect(report.counts.PENDING).toBeGreaterThanOrEqual(1);
    expect(report.counts.DELIVERED).toBeGreaterThanOrEqual(1);
    expect(report.counts.FAILED).toBeGreaterThanOrEqual(1);
    expect(report.counts.DEAD_LETTER).toBeGreaterThanOrEqual(1);
    expect(report.duplicate_count).toBeGreaterThanOrEqual(2);
    expect(report.failed_events.some((item) => item.event_id === dead.eventId)).toBe(true);
  });
});
