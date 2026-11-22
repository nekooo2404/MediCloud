import {PrismaClient} from '@prisma/client';

/** Returns a tenant-scoped reconciliation snapshot when tenantId is supplied. */
export async function reconcileOutbox(prisma: PrismaClient, tenantId?: string) {
  const where = tenantId ? {tenantId} : undefined;
  const grouped = await prisma.outboxEvent.groupBy({by: ['status'], where, _count: {_all: true}});
  const counts = {PENDING: 0, CLAIMED: 0, DELIVERED: 0, FAILED: 0, DEAD_LETTER: 0};
  for (const row of grouped) counts[row.status] = row._count._all;
  const eventIds = tenantId ? (await prisma.outboxEvent.findMany({where, select: {eventId: true}})).map((event) => event.eventId) : undefined;
  const duplicateRows = await prisma.processedEvent.aggregate({where: eventIds ? {eventId: {in: eventIds}} : undefined, _sum: {duplicateCount: true}});
  const duplicate_count = duplicateRows._sum.duplicateCount ?? 0;
  const events = await prisma.outboxEvent.findMany({where: {...(where ?? {}), status: {in: ['FAILED', 'DEAD_LETTER']}}, select: {eventId: true, status: true, correlationId: true, attempts: true}, orderBy: {createdAt: 'asc'}});
  return {
    counts,
    duplicate_count,
    failed_events: events.map((event) => ({event_id: event.eventId, status: event.status, correlation_id: event.correlationId, attempts: event.attempts})),
  };
}
