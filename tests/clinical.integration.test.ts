import {createServer, type Server} from 'node:http';
import {PrismaClient} from '@prisma/client';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {createEncounter, createObservation, getAdminMetrics, listMyRecords, type ClinicalDependencies} from '../apps/clinical-api/src/clinical/service.js';
import {createPrivateHapiFhirClient, type FhirR4Resource, validateFhirR4Resource} from '../apps/clinical-api/src/fhir/hapi-fhir-adapter.js';
import {listDoctors, listSpecialties} from '../apps/clinical-api/src/scheduling/service.js';
import type {AuthenticatedPrincipal} from '../apps/clinical-api/src/security/types.js';

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const prisma = new PrismaClient();
const uuid = () => crypto.randomUUID();

const principalFor = (
  subject: string,
  tenantId: string,
  roles: AuthenticatedPrincipal['roles'],
): AuthenticatedPrincipal => ({
  subject,
  issuer: 'https://keycloak.synthetic',
  audience: 'medicloud-api',
  roles,
  tenantIds: [tenantId],
  active: true,
});

describeDatabase('T09 PostgreSQL clinical, audit, outbox & private FHIR integration', () => {
  let tenantAId: string;
  let tenantBId: string;
  let patientSubject: string;
  let physicianASubject: string;
  let physicianOtherSubject: string;
  let auditorSubject: string;
  let docBSubject: string;
  let physicianAId: string;
  let patientAId: string;
  let appointmentAId: string;
  let appointmentBId: string;
  let fhirServer: Server;
  let fhirBaseUrl: string;
  const fhirStore = new Map<string, FhirR4Resource>();

  const deps = (): ClinicalDependencies => ({
    prisma,
    resolvePatientSubject: async (client, tenantId, patientId) => {
      const patient = await client.patient.findFirst({where: {id: patientId, tenantId}, select: {profileRef: true}});
      if (!patient) throw new Error('patient not found');
      return patient.profileRef;
    },
    resolvePatientId: async (client, tenantId, subject) => {
      const patient = await client.patient.findFirst({where: {tenantId, profileRef: subject}, select: {id: true}});
      return patient?.id;
    },
    resolveMembership: async (client, subject) => {
      const user = await client.user.findUnique({where: {subject}, include: {memberships: true}});
      return user?.memberships.map((m) => ({tenantId: m.tenantId, roles: [m.role], active: user.status === 'ACTIVE' && !m.revokedAt})) ?? [];
    },
    fhirClient: createPrivateHapiFhirClient({baseUrl: fhirBaseUrl}),
  });

  beforeAll(async () => {
    fhirServer = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const match = /^\/fhir\/(Patient|Encounter|Observation)\/([^/]+)$/.exec(url.pathname);
      if (!match) {
        response.writeHead(404).end();
        return;
      }
      const key = `${match[1]}/${decodeURIComponent(match[2])}`;
      if (request.method === 'PUT') {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as FhirR4Resource;
        validateFhirR4Resource(parsed);
        fhirStore.set(key, parsed);
        response.writeHead(200, {'content-type': 'application/fhir+json'}).end(JSON.stringify(parsed));
        return;
      }
      const existing = fhirStore.get(key);
      if (!existing) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {'content-type': 'application/fhir+json'}).end(JSON.stringify(existing));
    });
    await new Promise<void>((resolve) => fhirServer.listen(0, '127.0.0.1', () => resolve()));
    const address = fhirServer.address();
    if (!address || typeof address === 'string') throw new Error('FHIR mock address unavailable');
    fhirBaseUrl = `http://127.0.0.1:${address.port}`;

    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({data: {code: `synthetic-t09-a-${uuid()}`, name: 'Synthetic T09 A'}}),
      prisma.tenant.create({data: {code: `synthetic-t09-b-${uuid()}`, name: 'Synthetic T09 B'}}),
    ]);
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    patientSubject = `synthetic-t09-patient-${uuid()}`;
    physicianASubject = `synthetic-t09-doc-a-${uuid()}`;
    physicianOtherSubject = `synthetic-t09-doc-other-${uuid()}`;
    auditorSubject = `synthetic-t09-auditor-${uuid()}`;
    docBSubject = `synthetic-t09-doc-b-${uuid()}`;

    const [uPatient, uDocA, uDocOther, uAuditor, uDocB] = await Promise.all([
      prisma.user.create({data: {subject: patientSubject}}),
      prisma.user.create({data: {subject: physicianASubject}}),
      prisma.user.create({data: {subject: physicianOtherSubject}}),
      prisma.user.create({data: {subject: auditorSubject}}),
      prisma.user.create({data: {subject: docBSubject}}),
    ]);

    await Promise.all([
      prisma.membership.create({data: {tenantId: tenantAId, userId: uPatient.id, role: 'PATIENT'}}),
      prisma.membership.create({data: {tenantId: tenantAId, userId: uDocA.id, role: 'PHYSICIAN'}}),
      prisma.membership.create({data: {tenantId: tenantAId, userId: uDocOther.id, role: 'PHYSICIAN'}}),
      prisma.membership.create({data: {tenantId: tenantAId, userId: uAuditor.id, role: 'AUDITOR'}}),
      prisma.membership.create({data: {tenantId: tenantBId, userId: uDocB.id, role: 'PHYSICIAN'}}),
    ]);

    const [patientA, patientB] = await Promise.all([
      prisma.patient.create({data: {tenantId: tenantAId, profileRef: patientSubject}}),
      prisma.patient.create({data: {tenantId: tenantBId, profileRef: `synthetic-t09-pat-b-${uuid()}`}}),
    ]);
    patientAId = patientA.id;

    const [docA, , docB] = await Promise.all([
      prisma.practitioner.create({data: {tenantId: tenantAId, userId: uDocA.id, specialty: 'synthetic-cardiology'}}),
      prisma.practitioner.create({data: {tenantId: tenantAId, userId: uDocOther.id, specialty: 'synthetic-pediatrics'}}),
      prisma.practitioner.create({data: {tenantId: tenantBId, userId: uDocB.id, specialty: 'synthetic-neurology'}}),
    ]);
    physicianAId = docA.id;

    const [schedA, schedB] = await Promise.all([
      prisma.schedule.create({data: {tenantId: tenantAId, practitionerId: docA.id, startsAt: new Date('2026-12-02T08:00:00Z'), endsAt: new Date('2026-12-02T09:00:00Z')}}),
      prisma.schedule.create({data: {tenantId: tenantBId, practitionerId: docB.id, startsAt: new Date('2026-12-02T08:00:00Z'), endsAt: new Date('2026-12-02T09:00:00Z')}}),
    ]);
    const [slotA, slotB] = await Promise.all([
      prisma.appointmentSlot.create({data: {tenantId: tenantAId, scheduleId: schedA.id, startsAt: schedA.startsAt, capacity: 2}}),
      prisma.appointmentSlot.create({data: {tenantId: tenantBId, scheduleId: schedB.id, startsAt: schedB.startsAt, capacity: 2}}),
    ]);
    const [apptA, apptB] = await Promise.all([
      prisma.appointment.create({data: {tenantId: tenantAId, patientId: patientA.id, slotId: slotA.id, status: 'CONFIRMED', idempotencyKey: `synthetic-t09-appt-a-${uuid()}`}}),
      prisma.appointment.create({data: {tenantId: tenantBId, patientId: patientB.id, slotId: slotB.id, status: 'CONFIRMED', idempotencyKey: `synthetic-t09-appt-b-${uuid()}`}}),
    ]);
    appointmentAId = apptA.id;
    appointmentBId = apptB.id;
  });

  afterAll(async () => {
    const tenantIds = [tenantAId, tenantBId].filter(Boolean);
    if (tenantIds.length > 0) {
      await prisma.observation.deleteMany({where: {tenantId: {in: tenantIds}}});
      await prisma.encounter.deleteMany({where: {tenantId: {in: tenantIds}}});
      await prisma.outboxEvent.deleteMany({where: {tenantId: {in: tenantIds}}});
      await prisma.appointment.deleteMany({where: {tenantId: {in: tenantIds}}});
      await prisma.appointmentSlot.deleteMany({where: {tenantId: {in: tenantIds}}});
      await prisma.schedule.deleteMany({where: {tenantId: {in: tenantIds}}});
      await prisma.practitioner.deleteMany({where: {tenantId: {in: tenantIds}}});
      await prisma.patient.deleteMany({where: {tenantId: {in: tenantIds}}});
      await prisma.membership.deleteMany({where: {tenantId: {in: tenantIds}}});
    }
    if (fhirServer) {
      await new Promise<void>((resolve) => fhirServer.close(() => resolve()));
    }
    await prisma.$disconnect();
  });

  it('persists encounter, observation, audit events, outbox encounter.completed, and syncs private FHIR R4 resources', async () => {
    const clinicalDeps = deps();
    const docPrincipal = principalFor(physicianASubject, tenantAId, ['PHYSICIAN']);
    const correlationId = `synthetic-t09-int-${uuid()}`;

    await expect(
      createEncounter(clinicalDeps, {principal: docPrincipal, correlationId, purpose: 'treatment'}, {appointmentId: appointmentBId, practitionerId: physicianAId}),
    ).rejects.toMatchObject({status: 404, code: 'appointment_not_found'});

    const encounter = await createEncounter(
      clinicalDeps,
      {principal: docPrincipal, correlationId, purpose: 'treatment'},
      {appointmentId: appointmentAId, practitionerId: physicianAId},
    );
    expect(encounter.status).toBe('open');

    const [r1, r2] = await Promise.allSettled([
      createObservation(
        clinicalDeps,
        {principal: docPrincipal, correlationId, purpose: 'treatment'},
        encounter.id,
        {code: 'synthetic-vital-temp', value: 36.6, unit: 'Cel', measuredAt: '2026-12-02T08:15:00Z'},
      ),
      createObservation(
        clinicalDeps,
        {principal: docPrincipal, correlationId, purpose: 'treatment'},
        encounter.id,
        {code: 'synthetic-vital-hr', value: 72, unit: 'bpm', measuredAt: '2026-12-02T08:16:00Z'},
      ),
    ]);
    const fulfilled = [r1, r2].filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createObservation>>> => result.status === 'fulfilled');
    const rejected = [r1, r2].filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({status: 403, code: 'resource_state_denied'});
    const observation = fulfilled[0].value;
    expect(observation.encounter_id).toBe(encounter.id);

    const outboxCount = await prisma.outboxEvent.count({where: {tenantId: tenantAId, eventType: 'encounter.completed', correlationId}});
    expect(outboxCount).toBe(1);

    const auditCount = await prisma.auditEvent.count({where: {tenantId: tenantAId, correlationId}});
    expect(auditCount).toBeGreaterThanOrEqual(3);

    expect(fhirStore.has(`Patient/${patientAId}`)).toBe(true);
    expect(fhirStore.has(`Encounter/${encounter.id}`)).toBe(true);
    expect(fhirStore.has(`Observation/${observation.id}`)).toBe(true);

    const patientPrincipal = principalFor(patientSubject, tenantAId, ['PATIENT']);
    const records = await listMyRecords(clinicalDeps, {principal: patientPrincipal, correlationId: `synthetic-t09-rec-${uuid()}`});
    expect(records.data.map((item) => item.resource_ref)).toContain(`synthetic-observation-${observation.id}`);

    const specialties = await listSpecialties(clinicalDeps, {principal: patientPrincipal, correlationId: `synthetic-t09-sp-${uuid()}`});
    const doctors = await listDoctors(clinicalDeps, {principal: patientPrincipal, correlationId: `synthetic-t09-doc-${uuid()}`});
    expect(specialties.data.length).toBeGreaterThanOrEqual(1);
    expect(doctors.data.length).toBeGreaterThanOrEqual(1);

    const auditorPrincipal = principalFor(auditorSubject, tenantAId, ['AUDITOR']);
    const metrics = await getAdminMetrics(clinicalDeps, {principal: auditorPrincipal, correlationId: `synthetic-t09-met-${uuid()}`});
    expect(metrics.data.encounters_total).toBeGreaterThanOrEqual(1);
    expect(metrics.data.observations_total).toBeGreaterThanOrEqual(1);
  });
});
