import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {checkInAppointment, createAppointment, getAppointment, type SchedulingDependencies} from '../apps/clinical-api/src/scheduling/service.js';
import type {AuthenticatedPrincipal} from '../apps/clinical-api/src/security/types.js';

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const prisma = new PrismaClient();
const uuid = () => crypto.randomUUID();
let activeMembershipSubject = '';
const principal = (tenantId: string, roles: AuthenticatedPrincipal['roles'] = ['RECEPTIONIST'], subject = activeMembershipSubject): AuthenticatedPrincipal => ({subject, issuer: 'https://keycloak.synthetic', audience: 'medicloud-api', roles, tenantIds: [tenantId], active: true});

describeDatabase('T05 PostgreSQL scheduling integration', () => {
  let tenantId: string;
  let patientIds: string[];
  let slotId: string;
  let scheduleId: string;
  const createdAppointmentIds: string[] = [];

  const context = () => ({principal: principal(tenantId), correlationId: `synthetic-t05-${uuid()}`, idempotencyHeader: `synthetic-key-${uuid()}`});
  const deps: SchedulingDependencies = {prisma, resolvePatientSubject: async (_client, _tenant, patientId) => `synthetic-patient-${patientId}`, resolvePatientId: async () => undefined, resolveMembership: async (client, subject) => { const user = await client.user.findUnique({where: {subject}, include: {memberships: true}}); return user?.memberships.map((membership) => ({tenantId: membership.tenantId, roles: [membership.role], active: user.status === 'ACTIVE' && !membership.revokedAt})) ?? []; }};

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({data: {code: `synthetic-t05-${uuid()}`, name: 'Synthetic T05 Integration'}});
    tenantId = tenant.id;
    patientIds = (await Promise.all(Array.from({length: 8}, () => prisma.patient.create({data: {tenantId, profileRef: `synthetic-t05-profile-${uuid()}`}})))).map((patient) => patient.id);
    const user = await prisma.user.create({data: {subject: `synthetic-t05-user-${uuid()}`}});
    activeMembershipSubject = user.subject;
    await prisma.membership.create({data: {tenantId, userId: user.id, role: 'RECEPTIONIST'}});
    const practitioner = await prisma.practitioner.create({data: {tenantId, userId: user.id, specialty: 'synthetic-t05'}});
    const schedule = await prisma.schedule.create({data: {tenantId, practitionerId: practitioner.id, startsAt: new Date('2026-12-01T08:00:00Z'), endsAt: new Date('2026-12-01T09:00:00Z')}});
    scheduleId = schedule.id;
    const slot = await prisma.appointmentSlot.create({data: {tenantId, scheduleId, startsAt: schedule.startsAt, capacity: 3}});
    slotId = slot.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.appointment.deleteMany({where: {tenantId}});
      await prisma.appointmentSlot.deleteMany({where: {tenantId}});
      await prisma.schedule.deleteMany({where: {tenantId}});
      await prisma.practitioner.deleteMany({where: {tenantId}});
      await prisma.patient.deleteMany({where: {tenantId}});
      await prisma.membership.deleteMany({where: {tenantId}});
      await prisma.outboxEvent.deleteMany({where: {tenantId}});
    }
    await prisma.$disconnect();
  });

  it('creates one appointment, one outbox event, and replays idempotently', async () => {
    const request = context();
    const input = {slotId, patientId: patientIds[0], idempotencyKey: request.idempotencyHeader};
    const first = await createAppointment(deps, request, input);
    createdAppointmentIds.push(first.id);
    const replay = await createAppointment(deps, request, input);
    expect(replay).toEqual(first);
    expect(await prisma.appointment.count({where: {tenantId, idempotencyKey: input.idempotencyKey}})).toBe(1);
    expect(await prisma.outboxEvent.count({where: {tenantId, correlationId: request.correlationId}})).toBe(1);
  });

  it('rejects idempotency reuse for a different patient', async () => {
    const request = context();
    const input = {slotId, patientId: patientIds[1], idempotencyKey: request.idempotencyHeader};
    await createAppointment(deps, request, input);
    await expect(createAppointment(deps, request, {...input, patientId: patientIds[2]})).rejects.toMatchObject({code: 'idempotency_conflict', status: 409});
  });

  it('replays the same idempotency key when patient_id was omitted initially', async () => {
    const patientUser = await prisma.user.create({data: {subject: `synthetic-t05-patient-${uuid()}`}});
    await prisma.membership.create({data: {tenantId, userId: patientUser.id, role: 'PATIENT'}});
    const patientDeps = {...deps, resolvePatientId: async () => patientIds[7], resolvePatientSubject: async () => patientUser.subject};
    const request = {...context(), principal: principal(tenantId, ['PATIENT'], patientUser.subject), serverChannel: 'portal' as const};
    const first = await createAppointment(patientDeps, request, {slotId, idempotencyKey: request.idempotencyHeader});
    const replay = await createAppointment(patientDeps, request, {slotId, idempotencyKey: request.idempotencyHeader});
    expect(replay).toEqual(first);
    await prisma.membership.deleteMany({where: {userId: patientUser.id}});
    await prisma.user.delete({where: {id: patientUser.id}});
  });

  it('does not exceed capacity under concurrent booking', async () => {
    const concurrentSlot = await prisma.appointmentSlot.create({data: {tenantId, scheduleId, startsAt: new Date('2026-12-01T10:00:00Z'), capacity: 3}});
    const attempts = await Promise.allSettled(Array.from({length: 8}, (_, index) => {
      const request = context();
      return createAppointment(deps, {...request, serverChannel: 'portal'}, {slotId: concurrentSlot.id, patientId: patientIds[index], idempotencyKey: request.idempotencyHeader});
    }));
    const successful = attempts.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createAppointment>>> => result.status === 'fulfilled');
    expect(successful).toHaveLength(3);
    expect(await prisma.appointment.count({where: {tenantId, slotId: concurrentSlot.id, status: {in: ['PENDING', 'CONFIRMED']}}})).toBe(3);
    expect((await prisma.appointmentSlot.findUniqueOrThrow({where: {id: concurrentSlot.id}})).bookedCount).toBe(3);
  });

  it('uses disclosure-safe not-found across tenants', async () => {
    const otherTenant = await prisma.tenant.create({data: {code: `synthetic-t05-other-${uuid()}`, name: 'Synthetic Other'}});
    const otherUser = await prisma.user.create({data: {subject: `synthetic-t05-other-user-${uuid()}`}});
    await prisma.membership.create({data: {tenantId: otherTenant.id, userId: otherUser.id, role: 'RECEPTIONIST'}});
    const request = {...context(), principal: principal(otherTenant.id, ['RECEPTIONIST'], otherUser.subject)};
    await expect(getAppointment(deps, request, createdAppointmentIds[0])).rejects.toMatchObject({status: 404, code: 'appointment_not_found'});
    await prisma.membership.deleteMany({where: {tenantId: otherTenant.id}});
    await prisma.user.delete({where: {id: otherUser.id}});
    await prisma.tenant.delete({where: {id: otherTenant.id}});
  });

  it('rolls back appointment and outbox on authorization failure', async () => {
    const request = {...context(), principal: principal(tenantId, ['PATIENT'], `synthetic-unassigned-${uuid()}`), idempotencyHeader: `synthetic-rollback-${uuid()}`};
    await expect(createAppointment(deps, {...request, serverChannel: 'portal'}, {slotId, patientId: patientIds[3], idempotencyKey: request.idempotencyHeader})).rejects.toMatchObject({status: 403});
    expect(await prisma.appointment.count({where: {tenantId, idempotencyKey: request.idempotencyHeader}})).toBe(0);
    expect(await prisma.outboxEvent.count({where: {tenantId, correlationId: request.correlationId}})).toBe(0);
  });

  it('rolls back appointment when outbox validation fails', async () => {
    const request = context();
    const failingSlot = await prisma.appointmentSlot.create({data: {tenantId, scheduleId, startsAt: new Date('2026-12-01T13:00:00Z'), capacity: 1}});
    const failingDeps = {...deps, validateOutboxEvent: () => {throw new Error('synthetic outbox validation failure');}};
    await expect(createAppointment(failingDeps, {...request, serverChannel: 'portal'}, {slotId: failingSlot.id, patientId: patientIds[6], idempotencyKey: request.idempotencyHeader})).rejects.toThrow('synthetic outbox validation failure');
    expect(await prisma.appointment.count({where: {tenantId, idempotencyKey: request.idempotencyHeader}})).toBe(0);
    expect(await prisma.outboxEvent.count({where: {tenantId, correlationId: request.correlationId}})).toBe(0);
  });

  it('persists check-in and makes a repeated check-in idempotent', async () => {
    const request = context();
    const checkInSlot = await prisma.appointmentSlot.create({data: {tenantId, scheduleId, startsAt: new Date('2026-12-01T11:00:00Z'), capacity: 1}});
    const created = await createAppointment(deps, {...request, serverChannel: 'portal'}, {slotId: checkInSlot.id, patientId: patientIds[4], idempotencyKey: request.idempotencyHeader});
    const checkedIn = await checkInAppointment(deps, request, created.id, 'desk');
    const repeated = await checkInAppointment(deps, request, created.id, 'desk');
    expect(checkedIn.check_in_status).toBe('checked_in');
    expect(repeated.check_in_status).toBe('checked_in');
    expect(await prisma.appointment.count({where: {id: created.id, checkInStatus: 'CHECKED_IN'}})).toBe(1);
    expect(await prisma.auditEvent.count({where: {tenantId, action: 'appointment.check_in', resourceRef: `synthetic-appointment-${created.id}`}})).toBe(1);
  });

  it('rejects check-in for a cancelled appointment', async () => {
    const request = context();
    const cancelledSlot = await prisma.appointmentSlot.create({data: {tenantId, scheduleId, startsAt: new Date('2026-12-01T12:00:00Z'), capacity: 1}});
    const created = await createAppointment(deps, {...request, serverChannel: 'portal'}, {slotId: cancelledSlot.id, patientId: patientIds[5], idempotencyKey: request.idempotencyHeader});
    await prisma.appointment.update({where: {id: created.id}, data: {status: 'CANCELLED'}});
    await expect(checkInAppointment(deps, request, created.id, 'desk')).rejects.toMatchObject({status: 403});
  });

  it('denies a disabled membership even when the token claims a role', async () => {
    const user = await prisma.user.create({data: {subject: `synthetic-t05-disabled-${uuid()}`, status: 'DISABLED'}});
    await prisma.membership.create({data: {tenantId, userId: user.id, role: 'RECEPTIONIST'}});
    await expect(getAppointment(deps, {principal: principal(tenantId, ['RECEPTIONIST'], user.subject), correlationId: `synthetic-t05-${uuid()}`}, createdAppointmentIds[0])).rejects.toMatchObject({status: 403});
    await prisma.membership.deleteMany({where: {userId: user.id}});
    await prisma.user.delete({where: {id: user.id}});
  });
});
