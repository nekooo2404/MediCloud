import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const checksum = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function main() {
  const counts = {
    tenants: await prisma.tenant.count(), users: await prisma.user.count(), practitioners: await prisma.practitioner.count(),
    slots: await prisma.appointmentSlot.count(), appointments: await prisma.appointment.count(), encounters: await prisma.encounter.count(),
    observations: await prisma.observation.count(), outboxEvents: await prisma.outboxEvent.count(), auditEvents: await prisma.auditEvent.count(),
  };
  assert.deepEqual(counts, {tenants: 2, users: 8, practitioners: 4, slots: 40, appointments: 20, encounters: 10, observations: 10, outboxEvents: 50, auditEvents: 1});
  const rows = await prisma.appointmentSlot.findMany({select: {id: true, capacity: true, bookedCount: true, appointments: {where: {status: {in: ['PENDING', 'CONFIRMED']}}, select: {id: true}}}, orderBy: {id: 'asc'}});
  for (const row of rows) assert.equal(row.bookedCount, row.appointments.length, `bookedCount mismatch ${row.id}`);
  const events = await prisma.outboxEvent.findMany({select: {eventId: true, tenantId: true, payload: true}, orderBy: {eventId: 'asc'}});
  const appointments = await prisma.appointment.findMany({select: {tenantId: true}, orderBy: {id: 'asc'}});
  for (const event of events) {
    const ref = String((event.payload as {appointment_ref?: string}).appointment_ref);
    const match = /^synthetic-appointment-(\d+)$/.exec(ref);
    assert.ok(match);
    assert.equal(event.tenantId, appointments[(Number(match[1]) - 1) % appointments.length].tenantId);
  }
  assert.equal(events.filter((event) => JSON.stringify(event.payload).includes('rejected')).length, 1);
  assert.equal(events.filter((event) => JSON.stringify(event.payload).includes('duplicate')).length, 1);
  const beforeChecksum = checksum({counts, rows: rows.map(({id, capacity, bookedCount, appointments}) => ({id, capacity, bookedCount, appointmentIds: appointments.map(({id}) => id)}))});
  const reseed = spawnSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), resolve('apps/clinical-api/prisma/seed.ts')], {env: process.env, stdio: 'pipe'});
  assert.equal(reseed.status, 0, reseed.stderr?.toString());
  const afterRows = await prisma.appointmentSlot.findMany({select: {id: true, capacity: true, bookedCount: true, appointments: {where: {status: {in: ['PENDING', 'CONFIRMED']}}, select: {id: true}}}, orderBy: {id: 'asc'}});
  const afterCounts = {tenants: await prisma.tenant.count(), users: await prisma.user.count(), practitioners: await prisma.practitioner.count(), slots: await prisma.appointmentSlot.count(), appointments: await prisma.appointment.count(), encounters: await prisma.encounter.count(), observations: await prisma.observation.count(), outboxEvents: await prisma.outboxEvent.count(), auditEvents: await prisma.auditEvent.count()};
  const afterChecksum = checksum({counts: afterCounts, rows: afterRows.map(({id, capacity, bookedCount, appointments}) => ({id, capacity, bookedCount, appointmentIds: appointments.map(({id}) => id)}))});
  assert.deepEqual(afterCounts, counts);
  assert.equal(beforeChecksum, afterChecksum);
  const processedId = '00000000-0000-4000-8000-000000009999';
  await prisma.processedEvent.create({data: {eventId: processedId, handler: 'synthetic-verifier'}});
  await assert.rejects(() => prisma.processedEvent.create({data: {eventId: processedId, handler: 'synthetic-verifier'}}));
  await prisma.processedEvent.delete({where: {eventId: processedId}});
  const tenant = await prisma.tenant.findFirstOrThrow();
  await assert.rejects(() => prisma.tenant.delete({where: {id: tenant.id}}));
  await assert.rejects(() => prisma.auditEvent.delete({where: {id: uuid(700)}}));
  await assert.rejects(() => prisma.auditEvent.update({where: {id: uuid(700)}, data: {purpose: 'forbidden-update'}}));
  console.log(JSON.stringify({counts, seedChecksum: beforeChecksum, duplicateProcessedEvent: 'rejected', restrictiveTenantDelete: 'rejected'}));
}

main().finally(() => prisma.$disconnect());
