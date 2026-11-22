import {PrismaClient, OutboxStatus, ProcessedEventStatus} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {redactedMutationLog} from '../../clinical-api/src/security/redacted-log.js';

export interface PublishedEvent {
  eventId: string;
  eventType: string;
  tenantId: string;
  correlationId: string;
  payload: unknown;
}

export interface EventPublisher { publish(event: PublishedEvent): Promise<void>; }

export interface RelayOptions {
  prisma: PrismaClient;
  publisher: EventPublisher;
  maxAttempts?: number;
  baseBackoffMs?: number;
  leaseMs?: number;
  tenantId?: string;
  now?: () => Date;
  log?: (record: ReturnType<typeof redactedMutationLog>) => void;
  /** Test/fault-injection hook immediately before the delivered status write. */
  beforeStatusUpdate?: () => Promise<void>;
}

export interface RelayResult {
  eventId: string;
  status: 'DELIVERED' | 'FAILED' | 'DEAD_LETTER';
  attempts: number;
}

const MAX_ATTEMPTS = 100;
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;
const MAX_LEASE_MS = 60 * 60 * 1000;

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number, name: string): number {
  const candidate = value ?? fallback;
  if (!Number.isSafeInteger(candidate) || candidate < min || candidate > max) throw new RangeError(`${name} must be an integer from ${min} to ${max}`);
  return candidate;
}

export function retryDelayMs(attempt: number, baseBackoffMs: number): number {
  const safeAttempt = boundedInteger(attempt, 1, 1, MAX_ATTEMPTS, 'attempt');
  const safeBase = boundedInteger(baseBackoffMs, 1000, 1, MAX_BACKOFF_MS, 'baseBackoffMs');
  return Math.min(MAX_BACKOFF_MS, safeBase * 2 ** Math.min(safeAttempt - 1, 30));
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as {code?: unknown}).code === 'P2002';
}

/** Claims one due or expired-lease event. A lease makes a worker crash recoverable. */
export async function relayOne(options: RelayOptions): Promise<RelayResult | null> {
  const maxAttempts = boundedInteger(options.maxAttempts, 5, 1, MAX_ATTEMPTS, 'maxAttempts');
  const baseBackoffMs = boundedInteger(options.baseBackoffMs, 1000, 1, MAX_BACKOFF_MS, 'baseBackoffMs');
  const leaseMs = boundedInteger(options.leaseMs, 60_000, 1, MAX_LEASE_MS, 'leaseMs');
  const now = options.now ?? (() => new Date());
  const claimToken = randomUUID();
  const claimed = await options.prisma.$transaction(async (tx) => {
    // The database clock owns both the eligibility check and claimedAt. The
    // application clock is intentionally not used for lease acquisition: a
    // worker with skewed time must not steal a live claim or create a lease
    // whose expiry is evaluated against a different clock.
    const rows = await tx.$queryRaw<Array<{eventId: string; eventType: string; tenantId: string; correlationId: string; payload: unknown; attempts: number}>>`
      WITH candidate AS (
        SELECT o."eventId", o."tenantId"
        FROM "outbox_events" o
        WHERE ((o."status" IN ('PENDING', 'FAILED') AND o."nextAttemptAt" <= CURRENT_TIMESTAMP)
           OR (o."status" = 'CLAIMED' AND o."claimedAt" < CURRENT_TIMESTAMP - (${leaseMs} * INTERVAL '1 millisecond')))
           AND (${options.tenantId ?? null} IS NULL OR o."tenantId" = CAST(${options.tenantId ?? null} AS UUID))
        ORDER BY o."createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "outbox_events" AS o
      SET "status" = 'CLAIMED',
          "claimedAt" = CURRENT_TIMESTAMP,
          "claimToken" = CAST(${claimToken} AS UUID),
          "attempts" = o."attempts" + 1
      FROM candidate c
      JOIN "tenants" t ON t."id" = c."tenantId"
      WHERE o."eventId" = c."eventId"
      RETURNING o."eventId", o."eventType", t."code" AS "tenantId", o."correlationId", o."payload", o."attempts"`;
    return rows[0] ?? null;
  });
  if (!claimed) return null;

  try {
    await options.publisher.publish(claimed);
    await options.beforeStatusUpdate?.();
    await options.prisma.outboxEvent.update({where: {eventId_claimToken: {eventId: claimed.eventId, claimToken}}, data: {status: OutboxStatus.DELIVERED, deliveredAt: now(), claimedAt: null, claimToken: null}});
    options.log?.(redactedMutationLog({action: 'outbox.publish', status: 200, correlationId: claimed.correlationId, resourceRef: `synthetic-event-${claimed.eventId}`, reason: 'delivered'}));
    return {eventId: claimed.eventId, status: 'DELIVERED', attempts: claimed.attempts};
  } catch (error) {
    const deadLetter = claimed.attempts >= maxAttempts;
    const nextAttemptAt = new Date(now().getTime() + retryDelayMs(claimed.attempts, baseBackoffMs));
    await options.prisma.outboxEvent.update({where: {eventId_claimToken: {eventId: claimed.eventId, claimToken}}, data: {status: deadLetter ? OutboxStatus.DEAD_LETTER : OutboxStatus.FAILED, nextAttemptAt, claimedAt: null, claimToken: null, lastError: error instanceof Error ? error.message.slice(0, 500) : 'publisher failure'}});
    options.log?.(redactedMutationLog({action: 'outbox.publish', status: deadLetter ? 500 : 503, correlationId: claimed.correlationId, resourceRef: `synthetic-event-${claimed.eventId}`, reason: deadLetter ? 'dead_letter' : 'retry_scheduled'}));
    return {eventId: claimed.eventId, status: deadLetter ? 'DEAD_LETTER' : 'FAILED', attempts: claimed.attempts};
  }
}

/** Claims a handler/event pair; PROCESSING leases are reclaimable after a crash. */
export async function processOnce(prisma: PrismaClient, eventId: string, handler: string, handle: () => Promise<void>, options: {leaseMs?: number; now?: () => Date} = {}): Promise<'PROCESSED' | 'DUPLICATE'> {
  const leaseMs = boundedInteger(options.leaseMs, 60_000, 1, MAX_LEASE_MS, 'leaseMs');
  const now = options.now ?? (() => new Date());
  const key = {eventId_handler: {eventId, handler}};
  const claimToken = randomUUID();
  try {
    await prisma.processedEvent.create({data: {eventId, handler, status: ProcessedEventStatus.PROCESSING, processedAt: now(), claimToken}});
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await prisma.processedEvent.findUnique({where: key});
    if (!existing || existing.status === ProcessedEventStatus.PROCESSED) {
      if (existing) await prisma.processedEvent.update({where: key, data: {duplicateCount: {increment: 1}}});
      return 'DUPLICATE';
    }
    if (existing.processedAt.getTime() >= now().getTime() - leaseMs) return 'DUPLICATE';
    const reclaimed = await prisma.processedEvent.updateMany({
      where: {eventId, handler, status: ProcessedEventStatus.PROCESSING, processedAt: {lt: new Date(now().getTime() - leaseMs)}},
      data: {processedAt: now(), claimToken}
    });
    if (reclaimed.count !== 1) return 'DUPLICATE';
  }
  try {
    await handle();
  } catch (error) {
    await prisma.processedEvent.deleteMany({where: {eventId, handler, status: ProcessedEventStatus.PROCESSING, claimToken}}).catch(() => undefined);
    throw error;
  }
  const completed = await prisma.processedEvent.updateMany({
    where: {eventId, handler, status: ProcessedEventStatus.PROCESSING, claimToken},
    data: {status: ProcessedEventStatus.PROCESSED, processedAt: now(), claimToken: null}
  });
  return completed.count === 1 ? 'PROCESSED' : 'DUPLICATE';
}
