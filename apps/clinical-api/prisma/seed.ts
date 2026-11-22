import {PrismaClient, MembershipRole, AppointmentStatus, OutboxStatus} from '@prisma/client';

const prisma = new PrismaClient();
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

async function main() {
  const tenants = await Promise.all([
    prisma.tenant.upsert({where: {code: 'synthetic-hospital-a'}, update: {}, create: {id: uuid(1), code: 'synthetic-hospital-a', name: 'Synthetic Hospital A'}}),
    prisma.tenant.upsert({where: {code: 'synthetic-hospital-b'}, update: {}, create: {id: uuid(2), code: 'synthetic-hospital-b', name: 'Synthetic Hospital B'}}),
  ]);

  const users = [];
  for (let index = 0; index < 8; index += 1) {
    users.push(await prisma.user.upsert({
      where: {subject: `synthetic-subject-${index + 1}`},
      update: {},
      create: {id: uuid(10 + index), subject: `synthetic-subject-${index + 1}`},
    }));
  }

  const roles = [MembershipRole.PATIENT, MembershipRole.GUARDIAN, MembershipRole.RECEPTIONIST, MembershipRole.PHYSICIAN, MembershipRole.NURSE, MembershipRole.AUDITOR];
  for (let index = 0; index < users.length; index += 1) {
    const tenant = tenants[index % tenants.length];
    await prisma.membership.upsert({where: {tenantId_userId_role: {tenantId: tenant.id, userId: users[index].id, role: roles[index % roles.length]}}, update: {}, create: {tenantId: tenant.id, userId: users[index].id, role: roles[index % roles.length]}});
  }

  const patients = [];
  for (let index = 0; index < 4; index += 1) {
    const tenant = tenants[index % tenants.length];
    patients.push(await prisma.patient.upsert({where: {tenantId_profileRef: {tenantId: tenant.id, profileRef: `synthetic-profile-${index + 1}`}}, update: {}, create: {id: uuid(30 + index), tenantId: tenant.id, profileRef: `synthetic-profile-${index + 1}`}}));
  }

  const practitioners = [];
  for (let index = 0; index < 4; index += 1) {
    const tenant = tenants[index % tenants.length];
    practitioners.push(await prisma.practitioner.upsert({where: {tenantId_userId: {tenantId: tenant.id, userId: users[(index + 3) % users.length].id}}, update: {}, create: {id: uuid(40 + index), tenantId: tenant.id, userId: users[(index + 3) % users.length].id, specialty: `synthetic-specialty-${index + 1}`}}));
  }

  const slots = [];
  for (let index = 0; index < 40; index += 1) {
    const tenant = tenants[index % tenants.length];
    const practitioner = practitioners[index % practitioners.length];
    const schedule = await prisma.schedule.upsert({where: {id: uuid(100 + index)}, update: {}, create: {id: uuid(100 + index), tenantId: tenant.id, practitionerId: practitioner.id, startsAt: new Date(Date.UTC(2026, 10, 24 + Math.floor(index / 4), 8 + (index % 4))), endsAt: new Date(Date.UTC(2026, 10, 24 + Math.floor(index / 4), 9 + (index % 4)))}});
    slots.push(await prisma.appointmentSlot.upsert({where: {id: uuid(200 + index)}, update: {}, create: {id: uuid(200 + index), tenantId: tenant.id, scheduleId: schedule.id, startsAt: schedule.startsAt, capacity: index % 3 === 0 ? 2 : 1}}));
  }

  const appointments = [];
  const statuses = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED];
  for (let index = 0; index < 20; index += 1) {
    const tenant = tenants[index % tenants.length];
    const patient = patients[index % patients.length];
    const slot = slots[index];
    appointments.push(await prisma.appointment.upsert({where: {tenantId_idempotencyKey: {tenantId: tenant.id, idempotencyKey: `synthetic-idempotency-${index + 1}`}}, update: {}, create: {id: uuid(300 + index), tenantId: tenant.id, patientId: patient.id, slotId: slot.id, status: statuses[index % statuses.length], idempotencyKey: `synthetic-idempotency-${index + 1}`}}));
  }
  for (const slot of slots) {
    const bookedCount = await prisma.appointment.count({where: {tenantId: slot.tenantId, slotId: slot.id, status: {in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]}}});
    await prisma.appointmentSlot.update({where: {id: slot.id}, data: {bookedCount}});
  }

  for (let index = 0; index < 10; index += 1) {
    const tenant = tenants[index % tenants.length];
    const appointment = appointments[index];
    const practitioner = practitioners[index % practitioners.length];
    const encounter = await prisma.encounter.upsert({where: {id: uuid(400 + index)}, update: {}, create: {id: uuid(400 + index), tenantId: tenant.id, appointmentId: appointment.id, patientId: appointment.patientId, practitionerId: practitioner.id, status: index % 2 ? 'COMPLETED' : 'OPEN'}});
    await prisma.observation.upsert({where: {id: uuid(500 + index)}, update: {}, create: {id: uuid(500 + index), tenantId: tenant.id, encounterId: encounter.id, code: `synthetic-code-${index + 1}`, value: 36.5 + index / 10, unit: 'synthetic-unit', measuredAt: new Date(Date.UTC(2026, 10, 24, 8 + index))}});
  }

  for (let index = 0; index < 50; index += 1) {
    const tenant = tenants[index % tenants.length];
    const rejected = index === 0;
    const duplicate = index === 1;
    const payload = {appointment_ref: `synthetic-appointment-${(index % appointments.length) + 1}`, channel: 'portal', ...(rejected ? {policy_case: 'rejected'} : {}), ...(duplicate ? {policy_case: 'duplicate'} : {})};
    await prisma.outboxEvent.upsert({where: {eventId: uuid(600 + index)}, update: {payload, status: rejected || duplicate ? OutboxStatus.FAILED : OutboxStatus.PENDING, lastError: rejected ? 'policy-rejected-synthetic-fixture' : duplicate ? 'duplicate-synthetic-fixture' : null}, create: {eventId: uuid(600 + index), tenantId: tenant.id, eventType: 'appointment.created', schemaVersion: 1, correlationId: `synthetic-trace-${index + 1}`, payload, status: rejected || duplicate ? OutboxStatus.FAILED : OutboxStatus.PENDING, lastError: rejected ? 'policy-rejected-synthetic-fixture' : duplicate ? 'duplicate-synthetic-fixture' : null}});
  }
  const actor = users[0];
  await prisma.auditEvent.upsert({where: {id: uuid(700)}, update: {}, create: {id: uuid(700), tenantId: tenants[0].id, actorId: actor.id, action: 'synthetic.seed', resourceRef: 'synthetic-seed', purpose: 'testing', correlationId: 'synthetic-audit-001', metadata: {fixture: true}}});

  const counts = await Promise.all([prisma.tenant.count(), prisma.user.count(), prisma.practitioner.count(), prisma.appointmentSlot.count(), prisma.appointment.count(), prisma.encounter.count(), prisma.observation.count(), prisma.outboxEvent.count()]);
  console.log(JSON.stringify({tenants: counts[0], users: counts[1], practitioners: counts[2], slots: counts[3], appointments: counts[4], encounters: counts[5], observations: counts[6], outboxEvents: counts[7]}));
}

main().finally(() => prisma.$disconnect());
