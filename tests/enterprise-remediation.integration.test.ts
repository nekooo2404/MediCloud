import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {setTransactionTenantContext} from '../apps/clinical-api/src/db/tenant-rls.js';
import {
  assertPrivateFhirEndpoint,
  createPrivateHapiFhirClient,
  FhirBoundaryError,
  toFhirObservation,
} from '../apps/clinical-api/src/fhir/hapi-fhir-adapter.js';
import {
  executeDashboardMutation,
  getDashboardData,
} from '../apps/clinical-api/src/clinical/dashboard-service.js';
import {
  amendObservation,
  type ClinicalDependencies,
  completeEncounter,
  createEncounter,
  createObservation,
} from '../apps/clinical-api/src/clinical/service.js';
import {queryWorkspaceSlice} from '../apps/clinical-api/src/modules/read-models/workspace-queries.js';
import {
  cancelAppointment,
  checkInAppointment,
  createAppointment,
  publishDoctorSlots,
  rescheduleAppointment,
  transitionQueueTicket,
} from '../apps/clinical-api/src/scheduling/service.js';
import type {AuthenticatedPrincipal, Role} from '../apps/clinical-api/src/security/types.js';

const prisma = new PrismaClient();
const uuid = () => randomUUID();

function buildPrincipal(tenantIds: string[], roles: Role[], subject: string, active = true): AuthenticatedPrincipal {
  return {
    subject,
    issuer: 'https://keycloak.synthetic',
    audience: 'medicloud-api',
    roles,
    tenantIds,
    active,
  };
}

const describeDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeDatabase('Enterprise remediation integration suite (SEC-E..H, DB-A..C, CL-A..C)', () => {
  let tenantAId = '';
  let tenantBId = '';
  let tenantACode = '';
  let tenantBCode = '';
  let doctorUserId = '';
  let doctorSubject = '';
  let practitionerId = '';
  let scheduleId = '';
  let patientUser1Id = '';
  let patient1Subject = '';
  let patient1Id = '';
  let unmappedPatientUserSubject = '';
  const extraPatientIds: string[] = [];

  beforeAll(async () => {
    tenantACode = `synthetic-ent-a-${uuid().slice(0, 8)}`;
    tenantBCode = `synthetic-ent-b-${uuid().slice(0, 8)}`;
    const [tA, tB] = await Promise.all([
      prisma.tenant.create({data: {code: tenantACode, name: 'Enterprise Clinic A'}}),
      prisma.tenant.create({data: {code: tenantBCode, name: 'Enterprise Clinic B'}}),
    ]);
    tenantAId = tA.id;
    tenantBId = tB.id;

    doctorSubject = `synthetic-ent-doc-${uuid()}`;
    patient1Subject = `synthetic-ent-pat1-${uuid()}`;
    unmappedPatientUserSubject = `synthetic-ent-unmapped-${uuid()}`;

    const [docUser, patUser1, unmappedUser] = await Promise.all([
      prisma.user.create({data: {subject: doctorSubject}}),
      prisma.user.create({data: {subject: patient1Subject}}),
      prisma.user.create({data: {subject: unmappedPatientUserSubject}}),
    ]);
    doctorUserId = docUser.id;
    patientUser1Id = patUser1.id;

    // Multi-role & multi-tenant memberships for SEC-G testing
    await Promise.all([
      prisma.membership.create({data: {tenantId: tenantAId, userId: doctorUserId, role: 'PHYSICIAN'}}),
      prisma.membership.create({data: {tenantId: tenantAId, userId: doctorUserId, role: 'RECEPTIONIST'}}),
      prisma.membership.create({data: {tenantId: tenantBId, userId: doctorUserId, role: 'AUDITOR'}}),
      prisma.membership.create({data: {tenantId: tenantAId, userId: patientUser1Id, role: 'PATIENT'}}),
      prisma.membership.create({data: {tenantId: tenantAId, userId: unmappedUser.id, role: 'PATIENT'}}),
    ]);

    const prac = await prisma.practitioner.create({
      data: {
        tenantId: tenantAId,
        userId: doctorUserId,
        specialty: 'Nội tổng quát',
        displayName: 'TS. BS. Kiểm thử RLS',
        roomLabel: 'Phòng 101',
      },
    });
    practitionerId = prac.id;

    const p1 = await prisma.patient.create({
      data: {tenantId: tenantAId, userId: patientUser1Id, profileRef: `synthetic-ent-p1-${uuid()}`},
    });
    patient1Id = p1.id;
    await prisma.patientProfile.create({
      data: {
        tenantId: tenantAId,
        patientId: patient1Id,
        displayName: 'Nguyễn Kiểm Thử',
        medicalRecordCode: `ENT-${uuid().slice(0, 6)}`,
        bloodType: 'O+',
        allergies: ['Penicillin'],
      },
    });

    // Pool of 22 synthetic patients for 20-way capacity concurrency test
    const extras = await Promise.all(
      Array.from({length: 22}, (_, i) =>
        prisma.patient.create({
          data: {tenantId: tenantAId, profileRef: `synthetic-ent-pool-${i}-${uuid()}`},
        }),
      ),
    );
    extraPatientIds.push(...extras.map((p) => p.id));

    // Seed tenant B isolated appointment fixture to verify RLS filtering
    const patB = await prisma.patient.create({
      data: {tenantId: tenantBId, profileRef: `synthetic-ent-patb-${uuid()}`},
    });
    const docBUser = await prisma.user.create({data: {subject: `synthetic-ent-docb-${uuid()}`}});
    const pracB = await prisma.practitioner.create({
      data: {tenantId: tenantBId, userId: docBUser.id, specialty: 'Tim mạch'},
    });
    const schedB = await prisma.schedule.create({
      data: {
        tenantId: tenantBId,
        practitionerId: pracB.id,
        startsAt: new Date('2026-12-10T01:00:00Z'),
        endsAt: new Date('2026-12-10T03:00:00Z'),
      },
    });
    const slotB = await prisma.appointmentSlot.create({
      data: {
        tenantId: tenantBId,
        scheduleId: schedB.id,
        startsAt: new Date('2026-12-10T01:00:00Z'),
        endsAt: new Date('2026-12-10T02:00:00Z'),
        capacity: 2,
      },
    });
    await prisma.appointment.create({
      data: {
        tenantId: tenantBId,
        patientId: patB.id,
        slotId: slotB.id,
        status: 'CONFIRMED',
        idempotencyKey: `synthetic-b-iso-${uuid()}`,
      },
    });

    const sched = await prisma.schedule.create({
      data: {
        tenantId: tenantAId,
        practitionerId,
        startsAt: new Date('2026-12-12T01:00:00Z'),
        endsAt: new Date('2026-12-12T05:00:00Z'),
      },
    });
    scheduleId = sched.id;
  });

  afterAll(async () => {
    const ids = [tenantAId, tenantBId].filter(Boolean);
    if (ids.length > 0) {
      await prisma.observation.deleteMany({where: {tenantId: {in: ids}}});
      await prisma.encounter.deleteMany({where: {tenantId: {in: ids}}});
      await prisma.queueTicket.deleteMany({where: {tenantId: {in: ids}}});
      await prisma.appointment.deleteMany({where: {tenantId: {in: ids}}});
      await prisma.appointmentSlot.deleteMany({where: {tenantId: {in: ids}}});
      await prisma.schedule.deleteMany({where: {tenantId: {in: ids}}});
      await prisma.practitioner.deleteMany({where: {tenantId: {in: ids}}});
      await prisma.patientProfile.deleteMany({where: {tenantId: {in: ids}}});
      await prisma.patient.deleteMany({where: {tenantId: {in: ids}}});
      await prisma.membership.deleteMany({where: {tenantId: {in: ids}}});
      await prisma.outboxEvent.deleteMany({where: {tenantId: {in: ids}}});
    }
    await prisma.$disconnect();
  });

  function createDeps(): ClinicalDependencies {
    return {
      prisma,
      resolveMembership: async (client, subject) => {
        const user = await client.user.findUnique({where: {subject}, include: {memberships: true}});
        if (!user) return [];
        const active = user.status === 'ACTIVE';
        const byTenant = new Map<string, string[]>();
        for (const m of user.memberships) {
          if (m.revokedAt) continue;
          const list = byTenant.get(m.tenantId) ?? [];
          list.push(m.role);
          byTenant.set(m.tenantId, list);
        }
        return Array.from(byTenant.entries()).map(([tenantId, roles]) => ({tenantId, roles, active}));
      },
      resolvePatientId: async (client, tenantId, subject) => {
        const user = await client.user.findUnique({where: {subject}, select: {id: true}});
        const pat = await client.patient.findFirst({
          where: {tenantId, OR: [...(user ? [{userId: user.id}] : []), {profileRef: subject}]},
          select: {id: true},
        });
        return pat?.id;
      },
      resolvePatientSubject: async (client, tenantId, patientId) => {
        const pat = await client.patient.findFirst({
          where: {id: patientId, tenantId},
          include: {user: {select: {subject: true}}},
        });
        return pat?.user?.subject ?? pat?.profileRef ?? '';
      },
    };
  }

  it('SEC-F: authorizes BEFORE idempotency replay and denies revoked membership or mismatched actor/slot', async () => {
    const revSubj = `synthetic-secf-rev-${uuid()}`;
    const revUser = await prisma.user.create({data: {subject: revSubj}});
    const membership = await prisma.membership.create({data: {tenantId: tenantAId, userId: revUser.id, role: 'PATIENT'}});
    const revPatient = await prisma.patient.create({
      data: {tenantId: tenantAId, userId: revUser.id, profileRef: `synthetic-secf-p-${uuid()}`},
    });
    const slot = await prisma.appointmentSlot.create({
      data: {
        tenantId: tenantAId,
        scheduleId,
        startsAt: new Date('2026-12-12T01:00:00Z'),
        endsAt: new Date('2026-12-12T02:00:00Z'),
        capacity: 5,
      },
    });

    const deps = createDeps();
    const idempKey = `synthetic-secf-key-${uuid()}`;
    const ctx = {
      principal: buildPrincipal([tenantAId], ['PATIENT'], revSubj),
      correlationId: `synthetic-secf-${uuid()}`,
      idempotencyHeader: idempKey,
      serverChannel: 'portal' as const,
      requestedTenantId: tenantAId,
    };

    const created = await createAppointment(deps, ctx, {slotId: slot.id, idempotencyKey: idempKey});
    expect(created.id).toBeTruthy();

    // Cross-actor replay MUST be rejected (even with identical slot & key)
    await expect(
      createAppointment(
        deps,
        {
          principal: buildPrincipal([tenantAId], ['RECEPTIONIST'], doctorSubject),
          correlationId: `synthetic-secf-cross-${uuid()}`,
          idempotencyHeader: idempKey,
          serverChannel: 'portal',
          requestedTenantId: tenantAId,
        },
        {slotId: slot.id, patientId: revPatient.id, idempotencyKey: idempKey},
      ),
    ).rejects.toMatchObject({status: 409, code: 'idempotency_conflict'});

    // Revoke membership -> replay MUST be denied 403 (authorization precedes idempotency!)
    await prisma.membership.update({where: {id: membership.id}, data: {revokedAt: new Date()}});
    await expect(createAppointment(deps, ctx, {slotId: slot.id, idempotencyKey: idempKey})).rejects.toMatchObject({
      status: 403,
      code: 'tenant_membership_required',
    });
  });

  it('DB-A & CL-B: enforces 20-way capacity under contention, cancel restores capacity, reschedule swaps atomically', async () => {
    const slot1 = await prisma.appointmentSlot.create({
      data: {
        tenantId: tenantAId,
        scheduleId,
        startsAt: new Date('2026-12-12T02:00:00Z'),
        endsAt: new Date('2026-12-12T03:00:00Z'),
        capacity: 2,
      },
    });
    const slot2 = await prisma.appointmentSlot.create({
      data: {
        tenantId: tenantAId,
        scheduleId,
        startsAt: new Date('2026-12-12T03:00:00Z'),
        endsAt: new Date('2026-12-12T04:00:00Z'),
        capacity: 2,
      },
    });

    const deps = createDeps();
    const docPrincipal = buildPrincipal([tenantAId], ['PHYSICIAN', 'RECEPTIONIST'], doctorSubject);

    const results = await Promise.allSettled(
      Array.from({length: 20}, (_, idx) => {
        const key = `synthetic-conc20-${idx}-${uuid()}`;
        return createAppointment(
          deps,
          {
            principal: docPrincipal,
            correlationId: `synthetic-c20-${uuid()}`,
            idempotencyHeader: key,
            serverChannel: 'staff',
            requestedTenantId: tenantAId,
          },
          {slotId: slot1.id, patientId: extraPatientIds[idx], idempotencyKey: key},
        );
      }),
    );

    const won = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createAppointment>>> => r.status === 'fulfilled');
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(won).toHaveLength(2);
    expect(lost).toHaveLength(18);
    expect((await prisma.appointmentSlot.findUniqueOrThrow({where: {id: slot1.id}})).bookedCount).toBe(2);

    // Additional patient MUST fail 409 slot_capacity_exhausted
    const fullKey = `synthetic-full-${uuid()}`;
    await expect(
      createAppointment(
        deps,
        {
          principal: docPrincipal,
          correlationId: `synthetic-full-${uuid()}`,
          idempotencyHeader: fullKey,
          serverChannel: 'staff',
          requestedTenantId: tenantAId,
        },
        {slotId: slot1.id, patientId: patient1Id, idempotencyKey: fullKey},
      ),
    ).rejects.toMatchObject({status: 409, code: 'slot_capacity_exhausted'});

    // Same patient booking slot2 twice MUST fail 409 duplicate_active_booking even when slot2 still has spare capacity
    const slot2Key1 = `synthetic-s2a-${uuid()}`;
    const slot2Key2 = `synthetic-s2b-${uuid()}`;
    await createAppointment(
      deps,
      {
        principal: docPrincipal,
        correlationId: `synthetic-s2a-${uuid()}`,
        idempotencyHeader: slot2Key1,
        serverChannel: 'staff',
        requestedTenantId: tenantAId,
      },
      {slotId: slot2.id, patientId: patient1Id, idempotencyKey: slot2Key1},
    );
    await expect(
      createAppointment(
        deps,
        {
          principal: docPrincipal,
          correlationId: `synthetic-s2b-${uuid()}`,
          idempotencyHeader: slot2Key2,
          serverChannel: 'staff',
          requestedTenantId: tenantAId,
        },
        {slotId: slot2.id, patientId: patient1Id, idempotencyKey: slot2Key2},
      ),
    ).rejects.toMatchObject({status: 409, code: 'duplicate_active_booking'});

    // Cancel first winner -> capacity restores to 1
    await cancelAppointment(
      deps,
      {principal: docPrincipal, correlationId: `synthetic-can-${uuid()}`, requestedTenantId: tenantAId},
      won[0].value.id,
      'Bệnh nhân bận đột xuất',
    );
    expect((await prisma.appointmentSlot.findUniqueOrThrow({where: {id: slot1.id}})).bookedCount).toBe(1);

    // Reschedule second winner to slot2 -> slot1 bookedCount=0, slot2 bookedCount=2
    const reschedKey = `synthetic-resch-${uuid()}`;
    const moved = await rescheduleAppointment(
      deps,
      {
        principal: docPrincipal,
        correlationId: `synthetic-resch-${uuid()}`,
        idempotencyHeader: reschedKey,
        serverChannel: 'staff',
        requestedTenantId: tenantAId,
      },
      won[1].value.id,
      {newSlotId: slot2.id, idempotencyKey: reschedKey, reason: 'Đổi sang khung giờ chiều'},
    );
    expect(moved.slot_id).toBe(slot2.id);
    expect((await prisma.appointmentSlot.findUniqueOrThrow({where: {id: slot1.id}})).bookedCount).toBe(0);
    expect((await prisma.appointmentSlot.findUniqueOrThrow({where: {id: slot2.id}})).bookedCount).toBe(2);
  });

  it('CL-A & CL-B: Queue -> Encounter -> 2x Observation (IN_PROGRESS) -> Amend -> Atomic Complete', async () => {
    const deps = createDeps();
    const docPrincipal = buildPrincipal([tenantAId], ['PHYSICIAN', 'RECEPTIONIST'], doctorSubject);
    const pub = await publishDoctorSlots(
      deps,
      {principal: docPrincipal, correlationId: `synthetic-pub-${uuid()}`, requestedTenantId: tenantAId},
      {
        practitionerId,
        startsAt: '2026-12-15T01:00:00Z',
        endsAt: '2026-12-15T02:00:00Z',
        slotDurationMinutes: 60,
        capacity: 2,
      },
    );
    expect(pub.slots_created).toBe(1);
    // Overlapping publish rejects 409
    await expect(
      publishDoctorSlots(
        deps,
        {principal: docPrincipal, correlationId: `synthetic-pub2-${uuid()}`, requestedTenantId: tenantAId},
        {practitionerId, startsAt: '2026-12-15T01:30:00Z', endsAt: '2026-12-15T02:30:00Z'},
      ),
    ).rejects.toMatchObject({status: 409, code: 'schedule_overlap'});

    const publishedSlot = await prisma.appointmentSlot.findFirstOrThrow({where: {scheduleId: pub.schedule_id}});
    const bookKey = `synthetic-flow-${uuid()}`;
    const patCtx = {
      principal: buildPrincipal([tenantAId], ['PATIENT'], patient1Subject),
      correlationId: `synthetic-flow-b-${uuid()}`,
      idempotencyHeader: bookKey,
      serverChannel: 'portal' as const,
      requestedTenantId: tenantAId,
    };
    const appt = await createAppointment(deps, patCtx, {
      slotId: publishedSlot.id,
      idempotencyKey: bookKey,
      visitType: 'in_person',
      visitReason: 'general_checkup',
    });

    await checkInAppointment(
      deps,
      {principal: docPrincipal, correlationId: `synthetic-flow-ci-${uuid()}`, requestedTenantId: tenantAId},
      appt.id,
      'desk',
    );
    const ticket = await prisma.queueTicket.findUniqueOrThrow({where: {tenantId_appointmentId: {tenantId: tenantAId, appointmentId: appt.id}}});
    expect(ticket.status).toBe('WAITING');

    await transitionQueueTicket(
      deps,
      {principal: docPrincipal, correlationId: `synthetic-q1-${uuid()}`, requestedTenantId: tenantAId},
      ticket.id,
      'CALLED',
    );
    const enc = await createEncounter(
      deps,
      {principal: docPrincipal, correlationId: `synthetic-enc-${uuid()}`, purpose: 'treatment', requestedTenantId: tenantAId},
      {appointmentId: appt.id, practitionerId},
    );

    const obs1 = await createObservation(
      deps,
      {principal: docPrincipal, correlationId: `synthetic-o1-${uuid()}`, purpose: 'treatment', requestedTenantId: tenantAId},
      enc.id,
      {code: 'synthetic-temperature', value: 36.8, unit: '°C', measuredAt: '2026-12-15T01:15:00Z'},
    );
    const obs2 = await createObservation(
      deps,
      {principal: docPrincipal, correlationId: `synthetic-o2-${uuid()}`, purpose: 'treatment', requestedTenantId: tenantAId},
      enc.id,
      {code: 'synthetic-heart-rate', value: 76, unit: 'bpm', measuredAt: '2026-12-15T01:16:00Z'},
    );
    expect(obs1.status).toBe('preliminary');
    expect(obs2.status).toBe('preliminary');

    // Encounter stays IN_PROGRESS and has zero encounter.completed outbox until completeEncounter
    const encMid = await prisma.encounter.findUniqueOrThrow({where: {id: enc.id}});
    expect(encMid.status).toBe('IN_PROGRESS');
    expect(
      await prisma.outboxEvent.count({where: {tenantId: tenantAId, eventType: 'encounter.completed', correlationId: enc.correlation_id}}),
    ).toBe(0);

    // Amend obs1 cleanly
    const amended = await amendObservation(
      deps,
      {principal: docPrincipal, correlationId: `synthetic-amend-${uuid()}`, purpose: 'treatment', requestedTenantId: tenantAId},
      enc.id,
      obs1.id,
      {value: 37.1, unit: '°C', measuredAt: '2026-12-15T01:17:00Z', reason: 'Đo lại nhiệt độ lần 2', expectedVersion: 1},
    );
    expect(amended.version).toBe(2);
    expect((await prisma.observation.findUniqueOrThrow({where: {id: obs1.id}})).isLatest).toBe(false);

    // Concurrent completeEncounter -> 1 succeeds, 1 conflicts cleanly
    const compCorr = `synthetic-comp-${uuid()}`;
    const [c1, c2] = await Promise.allSettled([
      completeEncounter(deps, {principal: docPrincipal, correlationId: compCorr, purpose: 'treatment', requestedTenantId: tenantAId}, enc.id),
      completeEncounter(deps, {principal: docPrincipal, correlationId: compCorr, purpose: 'treatment', requestedTenantId: tenantAId}, enc.id),
    ]);
    const wonComp = [c1, c2].filter((r) => r.status === 'fulfilled');
    const lostComp = [c1, c2].filter((r) => r.status === 'rejected');
    expect(wonComp).toHaveLength(1);
    expect(lostComp).toHaveLength(1);
    expect((await prisma.queueTicket.findUniqueOrThrow({where: {id: ticket.id}})).status).toBe('DONE');
    expect(await prisma.outboxEvent.count({where: {tenantId: tenantAId, eventType: 'encounter.completed', correlationId: compCorr}})).toBe(1);
  });

  it('DB-C & SEC-H: PostgreSQL RLS blocks cross-tenant reads/writes under medicloud_runtime and blocks audit TRUNCATE', async () => {
    const visibleToA = await prisma.$transaction(async (tx) => {
      await setTransactionTenantContext(tx, tenantAId, {enforceRuntimeRole: true});
      return tx.appointment.findMany({where: {tenantId: tenantBId}});
    });
    expect(visibleToA).toHaveLength(0);

    await expect(
      prisma.$transaction(async (tx) => {
        await setTransactionTenantContext(tx, tenantAId, {enforceRuntimeRole: true});
        await tx.$executeRawUnsafe(
          `INSERT INTO "organizations" ("id", "tenantId", "name") VALUES ($1::uuid, $2::uuid, 'Illegal Cross Tenant')`,
          uuid(),
          tenantBId,
        );
      }),
    ).rejects.toThrow();

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE "audit_events"`);
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it('SEC-E, SEC-G & BE-A: isolates patient workspace, requires patient mapping, routes dashboard mutations via domain services', async () => {
    await expect(
      getDashboardData(prisma, {role: 'patient', actorSubject: unmappedPatientUserSubject, tenantCode: tenantACode}),
    ).rejects.toMatchObject({status: 403, code: 'patient_mapping_required'});

    // Multi-tenant selector for doctorSubject holding roles in A and B
    const tenantBOverview = await queryWorkspaceSlice(
      prisma,
      {role: 'staff', actorSubject: doctorSubject, tenantCode: tenantBCode},
      'overview',
    );
    expect(tenantBOverview.tenant.code).toBe(tenantBCode);

    // Patient overview & audit MUST NOT expose staffCount / outboxTotal
    const patOverview = await queryWorkspaceSlice(
      prisma,
      {role: 'patient', actorSubject: patient1Subject, tenantCode: tenantACode},
      'overview',
    );
    expect(patOverview.metrics).not.toHaveProperty('staffCount');
    expect(patOverview.metrics).not.toHaveProperty('outboxTotal');

    // Legacy dashboard POST rejects un-published slot creation
    await expect(
      executeDashboardMutation(
        prisma,
        {role: 'patient', actorSubject: patient1Subject, tenantCode: tenantACode, correlationId: `synthetic-nopub-${uuid()}`},
        {action: 'book_appointment'},
      ),
    ).rejects.toMatchObject({status: 400});
  });

  it('CL-C: enforces TLS & bearer auth in production FHIR config and adds LOINC/UCUM coding', () => {
    expect(() => assertPrivateFhirEndpoint('http://hapi-fhir.internal:8080', {requireTls: true})).toThrow(FhirBoundaryError);
    expect(() =>
      createPrivateHapiFhirClient({
        baseUrl: 'https://hapi-fhir.internal:8443',
        requireTlsAndAuth: true,
      }),
    ).toThrow(FhirBoundaryError);
    expect(() =>
      assertPrivateFhirEndpoint('https://wrong-host.internal:8443', {
        requireTls: true,
        allowedHosts: ['hapi-fhir.internal'],
      }),
    ).toThrow(FhirBoundaryError);

    const obs = toFhirObservation({
      id: uuid(),
      tenantCode: 'synthetic-hospital-a',
      encounterId: uuid(),
      patientId: uuid(),
      code: 'synthetic-systolic-bp',
      value: 120,
      unit: 'mmHg',
      measuredAt: new Date('2026-12-15T01:15:00Z'),
      status: 'FINAL',
    });
    expect(obs.code.coding[0].code).toBe('synthetic-systolic-bp');
    expect(obs.code.coding[1]).toMatchObject({system: 'http://loinc.org', code: '8480-6'});
    expect(obs.valueQuantity).toMatchObject({system: 'http://unitsofmeasure.org', code: 'mm[Hg]'});
  });
});
