import {readFileSync} from 'node:fs';
import {createServer, request as httpRequest, type Server} from 'node:http';
import {fileURLToPath} from 'node:url';
import type {PrismaClient} from '@prisma/client';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {afterEach, describe, expect, it} from 'vitest';
import {createPrivateHapiFhirClient, type FhirR4Resource, validateFhirR4Resource} from '../apps/clinical-api/src/fhir/hapi-fhir-adapter.js';
import {validateEventEnvelope} from '../apps/clinical-api/src/scheduling/event-validation.js';
import {createClinicalApiServer} from '../apps/clinical-api/src/scheduling/http-adapter.js';
import type {AuthenticatedPrincipal} from '../apps/clinical-api/src/security/types.js';

const openapiPath = fileURLToPath(new URL('../packages/contracts/openapi.json', import.meta.url));
const openapi = JSON.parse(readFileSync(openapiPath, 'utf8')) as {
  components: {schemas: Record<string, object>};
};

const ajv = new Ajv({strict: false});
addFormats(ajv);
for (const [name, schema] of Object.entries(openapi.components.schemas)) {
  ajv.addSchema(schema, `#/components/schemas/${name}`);
}

const TENANT_A_ID = '00000000-0000-4000-8000-000000000001';
const TENANT_B_ID = '00000000-0000-4000-8000-000000000002';
const DOC_A1_ID = '00000000-0000-4000-8000-000000000040';
const DOC_A2_ID = '00000000-0000-4000-8000-000000000041';
const DOC_NURSE_A_ID = '00000000-0000-4000-8000-000000000043';
const DOC_B1_ID = '00000000-0000-4000-8000-000000000042';
const PATIENT_A_ID = '00000000-0000-4000-8000-000000000030';
const PATIENT_B_ID = '00000000-0000-4000-8000-000000000031';
const APPT_A_ID = '00000000-0000-4000-8000-000000000301';
const APPT_A_CANCELLED_ID = '00000000-0000-4000-8000-000000000302';
const APPT_B_ID = '00000000-0000-4000-8000-000000000310';
const ENCOUNTER_NURSE_OPEN_ID = '00000000-0000-4000-8000-000000000450';
const ENCOUNTER_B_ID = '00000000-0000-4000-8000-000000000460';

const TOKENS: Record<string, AuthenticatedPrincipal> = {
  physician_a: {subject: 'synthetic-physician-a', issuer: 'https://keycloak.synthetic', audience: 'medicloud-api', roles: ['PHYSICIAN'], tenantIds: [TENANT_A_ID], active: true},
  physician_other_a: {subject: 'synthetic-physician-other-a', issuer: 'https://keycloak.synthetic', audience: 'medicloud-api', roles: ['PHYSICIAN'], tenantIds: [TENANT_A_ID], active: true},
  nurse_a: {subject: 'synthetic-nurse-a', issuer: 'https://keycloak.synthetic', audience: 'medicloud-api', roles: ['NURSE'], tenantIds: [TENANT_A_ID], active: true},
  receptionist_a: {subject: 'synthetic-receptionist-a', issuer: 'https://keycloak.synthetic', audience: 'medicloud-api', roles: ['RECEPTIONIST'], tenantIds: [TENANT_A_ID], active: true},
  patient_a: {subject: 'synthetic-patient-a', issuer: 'https://keycloak.synthetic', audience: 'medicloud-api', roles: ['PATIENT'], tenantIds: [TENANT_A_ID], active: true},
  guardian_a_valid: {
    subject: 'synthetic-guardian-a',
    issuer: 'https://keycloak.synthetic',
    audience: 'medicloud-api',
    roles: ['GUARDIAN'],
    tenantIds: [TENANT_A_ID],
    delegations: [{tenantId: TENANT_A_ID, patientSubject: 'synthetic-patient-a', expiresAt: '2099-01-01T00:00:00Z', revoked: false}],
    active: true,
  },
  guardian_a_revoked: {
    subject: 'synthetic-guardian-revoked',
    issuer: 'https://keycloak.synthetic',
    audience: 'medicloud-api',
    roles: ['GUARDIAN'],
    tenantIds: [TENANT_A_ID],
    delegations: [{tenantId: TENANT_A_ID, patientSubject: 'synthetic-patient-a', expiresAt: '2099-01-01T00:00:00Z', revoked: true}],
    active: true,
  },
  auditor_a: {subject: 'synthetic-auditor-a', issuer: 'https://keycloak.synthetic', audience: 'medicloud-api', roles: ['AUDITOR'], tenantIds: [TENANT_A_ID], active: true},
};

function createTestHarness() {
  const tenants = new Map([
    [TENANT_A_ID, {id: TENANT_A_ID, code: 'synthetic-hospital-a'}],
    [TENANT_B_ID, {id: TENANT_B_ID, code: 'synthetic-hospital-b'}],
  ]);
  const users = new Map<string, {id: string; subject: string; status: 'ACTIVE'; memberships: Array<{tenantId: string; role: string; revokedAt: null}>}>([
    ['synthetic-physician-a', {id: '00000000-0000-4000-8000-000000000010', subject: 'synthetic-physician-a', status: 'ACTIVE', memberships: [{tenantId: TENANT_A_ID, role: 'PHYSICIAN', revokedAt: null}]}],
    ['synthetic-physician-other-a', {id: '00000000-0000-4000-8000-000000000011', subject: 'synthetic-physician-other-a', status: 'ACTIVE', memberships: [{tenantId: TENANT_A_ID, role: 'PHYSICIAN', revokedAt: null}]}],
    ['synthetic-nurse-a', {id: '00000000-0000-4000-8000-000000000012', subject: 'synthetic-nurse-a', status: 'ACTIVE', memberships: [{tenantId: TENANT_A_ID, role: 'NURSE', revokedAt: null}]}],
    ['synthetic-receptionist-a', {id: '00000000-0000-4000-8000-000000000013', subject: 'synthetic-receptionist-a', status: 'ACTIVE', memberships: [{tenantId: TENANT_A_ID, role: 'RECEPTIONIST', revokedAt: null}]}],
    ['synthetic-patient-a', {id: '00000000-0000-4000-8000-000000000014', subject: 'synthetic-patient-a', status: 'ACTIVE', memberships: [{tenantId: TENANT_A_ID, role: 'PATIENT', revokedAt: null}]}],
    ['synthetic-guardian-a', {id: '00000000-0000-4000-8000-000000000015', subject: 'synthetic-guardian-a', status: 'ACTIVE', memberships: [{tenantId: TENANT_A_ID, role: 'GUARDIAN', revokedAt: null}]}],
    ['synthetic-guardian-revoked', {id: '00000000-0000-4000-8000-000000000016', subject: 'synthetic-guardian-revoked', status: 'ACTIVE', memberships: [{tenantId: TENANT_A_ID, role: 'GUARDIAN', revokedAt: null}]}],
    ['synthetic-auditor-a', {id: '00000000-0000-4000-8000-000000000017', subject: 'synthetic-auditor-a', status: 'ACTIVE', memberships: [{tenantId: TENANT_A_ID, role: 'AUDITOR', revokedAt: null}]}],
  ]);
  const patients = [
    {id: PATIENT_A_ID, tenantId: TENANT_A_ID, profileRef: 'synthetic-patient-a'},
    {id: PATIENT_B_ID, tenantId: TENANT_B_ID, profileRef: 'synthetic-patient-b'},
  ];
  const practitioners = [
    {id: DOC_A1_ID, tenantId: TENANT_A_ID, specialty: 'synthetic-cardiology', user: {subject: 'synthetic-physician-a'}},
    {id: DOC_A2_ID, tenantId: TENANT_A_ID, specialty: 'synthetic-pediatrics', user: {subject: 'synthetic-physician-other-a'}},
    {id: DOC_NURSE_A_ID, tenantId: TENANT_A_ID, specialty: 'synthetic-nursing-care', user: {subject: 'synthetic-nurse-a'}},
    {id: DOC_B1_ID, tenantId: TENANT_B_ID, specialty: 'synthetic-neurology', user: {subject: 'synthetic-physician-b'}},
  ];
  const slots = [
    {id: '00000000-0000-4000-8000-000000000201', tenantId: TENANT_A_ID, doctorId: DOC_A1_ID, startsAt: new Date('2026-11-24T08:00:00Z'), capacity: 3, bookedCount: 1},
  ];
  const appointments = new Map([
    [APPT_A_ID, {
      id: APPT_A_ID,
      tenantId: TENANT_A_ID,
      patientId: PATIENT_A_ID,
      status: 'CONFIRMED',
      tenant: {code: 'synthetic-hospital-a'},
      patient: {id: PATIENT_A_ID, profileRef: 'synthetic-patient-a'},
      slot: {schedule: {practitionerId: DOC_A1_ID, practitioner: {user: {subject: 'synthetic-physician-a'}}}},
      createdAt: new Date('2026-11-24T07:00:00Z'),
    }],
    [APPT_A_CANCELLED_ID, {
      id: APPT_A_CANCELLED_ID,
      tenantId: TENANT_A_ID,
      patientId: PATIENT_A_ID,
      status: 'CANCELLED',
      tenant: {code: 'synthetic-hospital-a'},
      patient: {id: PATIENT_A_ID, profileRef: 'synthetic-patient-a'},
      slot: {schedule: {practitionerId: DOC_A1_ID, practitioner: {user: {subject: 'synthetic-physician-a'}}}},
      createdAt: new Date('2026-11-24T07:00:00Z'),
    }],
    [APPT_B_ID, {
      id: APPT_B_ID,
      tenantId: TENANT_B_ID,
      patientId: PATIENT_B_ID,
      status: 'CONFIRMED',
      tenant: {code: 'synthetic-hospital-b'},
      patient: {id: PATIENT_B_ID, profileRef: 'synthetic-patient-b'},
      slot: {schedule: {practitionerId: DOC_B1_ID, practitioner: {user: {subject: 'synthetic-physician-b'}}}},
      createdAt: new Date('2026-11-24T07:00:00Z'),
    }],
  ]);

  const encounters = new Map<string, {
    id: string;
    tenantId: string;
    appointmentId: string;
    patientId: string;
    practitionerId: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'AMENDED' | 'CANCELLED';
    version: number;
    startedAt?: Date | null;
    createdAt: Date;
    completedAt: Date | null;
    completedByUserId?: string | null;
  }>([
    [
      ENCOUNTER_NURSE_OPEN_ID,
      {
        id: ENCOUNTER_NURSE_OPEN_ID,
        tenantId: TENANT_A_ID,
        appointmentId: APPT_A_ID,
        patientId: PATIENT_A_ID,
        practitionerId: DOC_NURSE_A_ID,
        status: 'OPEN',
        version: 1,
        startedAt: null,
        createdAt: new Date('2026-11-24T07:10:00Z'),
        completedAt: null,
      },
    ],
    [
      ENCOUNTER_B_ID,
      {
        id: ENCOUNTER_B_ID,
        tenantId: TENANT_B_ID,
        appointmentId: APPT_B_ID,
        patientId: PATIENT_B_ID,
        practitionerId: DOC_B1_ID,
        status: 'OPEN',
        version: 1,
        startedAt: null,
        createdAt: new Date('2026-11-24T07:10:00Z'),
        completedAt: null,
      },
    ],
  ]);
  const observations: Array<{id: string; tenantId: string; encounterId: string; code: string; value: number; unit: string; status: 'DRAFT' | 'PRELIMINARY' | 'FINAL' | 'AMENDED'; version: number; isLatest: boolean; measuredAt: Date}> = [];
  const auditEvents: Array<{id: string; tenantId: string; actorId: string | null; action: string; resourceRef: string; purpose: string; correlationId: string; metadata: unknown; occurredAt: Date}> = [];
  const outboxEvents: Array<{eventId: string; tenantId: string; eventType: string; schemaVersion: number; correlationId: string; payload: unknown; status: string; createdAt: Date}> = [];
  const fhirResources = new Map<string, FhirR4Resource>();

  const dbTables = {
    tenant: {
      findUnique: async ({where}: {where: {id: string}}) => tenants.get(where.id) ?? null,
    },
    user: {
      findUnique: async ({where}: {where: {subject: string}}) => users.get(where.subject) ?? null,
    },
    patient: {
      findFirst: async ({where}: {where: {tenantId: string; id?: string; profileRef?: string}}) =>
        patients.find(
          (row) =>
            row.tenantId === where.tenantId &&
            (!where.id || row.id === where.id) &&
            (!where.profileRef || row.profileRef === where.profileRef),
        ) ?? null,
    },
    practitioner: {
      findMany: async ({where, distinct}: {where?: {tenantId?: string; specialty?: string}; distinct?: string[]}) => {
        let rows = practitioners.filter((row) => (!where?.tenantId || row.tenantId === where.tenantId) && (!where?.specialty || row.specialty === where.specialty));
        if (distinct?.includes('specialty')) {
          const seen = new Set<string>();
          rows = rows.filter((row) => (seen.has(row.specialty) ? false : (seen.add(row.specialty), true)));
        }
        return rows;
      },
      findFirst: async ({where}: {where: {id: string; tenantId: string}}) =>
        practitioners.find((row) => row.id === where.id && row.tenantId === where.tenantId) ?? null,
    },
    appointmentSlot: {
      findMany: async ({where}: {where: {tenantId: string; schedule: {practitionerId: string}}}) =>
        slots.filter((slot) => slot.tenantId === where.tenantId && slot.doctorId === where.schedule.practitionerId),
    },
    appointment: {
      findUnique: async ({where}: {where: {id: string}}) => appointments.get(where.id) ?? null,
      updateMany: async ({where, data}: {where: {tenantId: string; id: string; status?: {in: string[]}}; data: {status: string}}) => {
        const appt = appointments.get(where.id);
        if (!appt || appt.tenantId !== where.tenantId) return {count: 0};
        if (where.status?.in && !where.status.in.includes(appt.status)) return {count: 0};
        appt.status = data.status;
        return {count: 1};
      },
      count: async ({where}: {where: {tenantId: string}}) =>
        [...appointments.values()].filter((appt) => appt.tenantId === where.tenantId).length,
    },
    encounter: {
      create: async ({data}: {data: {id: string; tenantId: string; appointmentId: string; patientId: string; practitionerId: string; status: 'OPEN'; startedAt?: Date; createdAt: Date}}) => {
        const record = {...data, version: 1, completedAt: null};
        encounters.set(record.id, record);
        return record;
      },
      findUnique: async ({where}: {where: {id: string}}) => {
        const enc = encounters.get(where.id);
        if (!enc) return null;
        const prac = practitioners.find((row) => row.id === enc.practitionerId)!;
        const tenant = tenants.get(enc.tenantId)!;
        return {...enc, tenant: {code: tenant.code}, practitioner: {user: {subject: prac.user.subject}}};
      },
      update: async ({where, data}: {where: {id: string}; data: Partial<{status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'; completedAt: Date}>}) => {
        const enc = encounters.get(where.id)!;
        const updated = {...enc, ...data};
        encounters.set(where.id, updated);
        return updated;
      },
      updateMany: async ({where, data}: {where: {id: string; tenantId: string; status: string | {in: string[]}; version?: number}; data: Record<string, unknown>}) => {
        const enc = encounters.get(where.id);
        if (!enc || enc.tenantId !== where.tenantId) return {count: 0};
        if (typeof where.status === 'string' ? enc.status !== where.status : !where.status.in.includes(enc.status)) {
          return {count: 0};
        }
        if (where.version !== undefined && enc.version !== where.version) return {count: 0};
        const nextVersion =
          data.version && typeof data.version === 'object' && 'increment' in (data.version as Record<string, number>)
            ? enc.version + Number((data.version as Record<string, number>).increment)
            : enc.version;
        encounters.set(where.id, {...enc, ...data, version: nextVersion} as typeof enc);
        return {count: 1};
      },
      findMany: async ({where}: {where: {tenantId: string; patientId: string}}) =>
        [...encounters.values()].filter((enc) => enc.tenantId === where.tenantId && enc.patientId === where.patientId),
      count: async ({where}: {where: {tenantId: string}}) =>
        [...encounters.values()].filter((enc) => enc.tenantId === where.tenantId).length,
    },
    observation: {
      create: async ({data}: {data: {id: string; tenantId: string; encounterId: string; code: string; value: number; unit: string; status?: 'DRAFT' | 'PRELIMINARY' | 'FINAL' | 'AMENDED'; version?: number; isLatest?: boolean; measuredAt: Date}}) => {
        const saved = {
          status: 'PRELIMINARY' as const,
          version: 1,
          isLatest: true,
          ...data,
        };
        observations.push(saved);
        return saved;
      },
      updateMany: async ({where, data}: {where: {tenantId: string; encounterId: string; isLatest?: boolean; status?: string}; data: {status?: 'FINAL'}}) => {
        let count = 0;
        for (const obs of observations) {
          if (
            obs.tenantId === where.tenantId &&
            obs.encounterId === where.encounterId &&
            (where.isLatest === undefined || obs.isLatest === where.isLatest) &&
            (where.status === undefined || obs.status === where.status)
          ) {
            if (data.status) obs.status = data.status;
            count += 1;
          }
        }
        return {count};
      },
      count: async ({where}: {where: {tenantId: string; encounterId?: string; isLatest?: boolean}}) =>
        observations.filter(
          (obs) =>
            obs.tenantId === where.tenantId &&
            (!where.encounterId || obs.encounterId === where.encounterId) &&
            (where.isLatest === undefined || obs.isLatest === where.isLatest),
        ).length,
      findMany: async ({where}: {where: {tenantId: string; encounter: {patientId: string}; isLatest?: boolean}}) =>
        observations.filter(
          (obs) =>
            obs.tenantId === where.tenantId &&
            (where.isLatest === undefined || obs.isLatest === where.isLatest) &&
            encounters.get(obs.encounterId)?.patientId === where.encounter.patientId,
        ),
    },
    auditEvent: {
      create: async ({data}: {data: Omit<(typeof auditEvents)[number], 'id' | 'occurredAt'>}) => {
        const created = {id: crypto.randomUUID(), occurredAt: new Date(), ...data};
        auditEvents.push(created);
        return created;
      },
      count: async ({where}: {where: {tenantId: string}}) => auditEvents.filter((evt) => evt.tenantId === where.tenantId).length,
    },
    outboxEvent: {
      create: async ({data}: {data: Omit<(typeof outboxEvents)[number], 'status' | 'createdAt'>}) => {
        const created = {status: 'PENDING', createdAt: new Date(), ...data};
        outboxEvents.push(created);
        return created;
      },
      count: async ({where}: {where: {tenantId: string; status?: string}}) =>
        outboxEvents.filter((evt) => evt.tenantId === where.tenantId && (!where.status || evt.status === where.status)).length,
    },
  };
  const db = {
    ...dbTables,
    $transaction: async <T>(fn: (tx: typeof dbTables) => Promise<T>): Promise<T> => fn(dbTables),
  };

  return {db, auditEvents, outboxEvents, encounters, observations, fhirResources};
}

const servers: Server[] = [];

async function startFhirServer(store: Map<string, FhirR4Resource>) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const match = /^\/fhir\/(Patient|Encounter|Observation)\/([^/]+)$/.exec(url.pathname);
    if (!match) {
      response.writeHead(404).end(JSON.stringify({resourceType: 'OperationOutcome'}));
      return;
    }
    const key = `${match[1]}/${decodeURIComponent(match[2])}`;
    if (request.method === 'PUT') {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as FhirR4Resource;
      validateFhirR4Resource(payload);
      store.set(key, payload);
      response.writeHead(200, {'content-type': 'application/fhir+json'}).end(JSON.stringify(payload));
      return;
    }
    if (request.method === 'GET') {
      const existing = store.get(key);
      if (!existing) {
        response.writeHead(404, {'content-type': 'application/fhir+json'}).end(JSON.stringify({resourceType: 'OperationOutcome'}));
        return;
      }
      response.writeHead(200, {'content-type': 'application/fhir+json'}).end(JSON.stringify(existing));
      return;
    }
    response.writeHead(405).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  servers.push(server);
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('FHIR server address unavailable');
  return `http://127.0.0.1:${addr.port}`;
}

async function startApiServer(
  harness: ReturnType<typeof createTestHarness>,
  fhirUrl: string,
  options: {useDefaultResolvers?: boolean} = {},
) {
  const verifyAuthorizationHeader = async (header: string | undefined) => {
    const key = header?.replace(/^Bearer\s+/i, '');
    const found = key ? TOKENS[key] : undefined;
    if (!found) {
      const {AuthenticationError} = await import('../apps/clinical-api/src/security/oidc-verifier.js');
      throw new AuthenticationError('invalid token');
    }
    return found;
  };
  const server = createClinicalApiServer(
    options.useDefaultResolvers
      ? {
          prisma: harness.db as unknown as PrismaClient,
          verifyAuthorizationHeader,
          fhirClient: createPrivateHapiFhirClient({baseUrl: fhirUrl}),
        }
      : {
          prisma: harness.db as unknown as PrismaClient,
          verifyAuthorizationHeader,
          resolveMembership: async (_client, subject) => {
            const found = Object.values(TOKENS).find((entry) => entry.subject === subject);
            return found ? [{tenantId: found.tenantIds[0], roles: [...found.roles], active: found.active}] : [];
          },
          resolvePatientId: async (_client, tenantId, subject) =>
            tenantId === TENANT_A_ID && subject === 'synthetic-patient-a' ? PATIENT_A_ID : undefined,
          fhirClient: createPrivateHapiFhirClient({baseUrl: fhirUrl}),
        },
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  servers.push(server);
  return server;
}

function send(
  server: Server,
  method: string,
  path: string,
  options: {tokenKey?: string; body?: unknown; headers?: Record<string, string>} = {},
) {
  return new Promise<{status: number; headers: Record<string, string | string[] | undefined>; body: Record<string, unknown>}>((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') return reject(new Error('API server address unavailable'));
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-correlation-id': 'synthetic-t09-http-trace',
      ...(options.tokenKey ? {authorization: `Bearer ${options.tokenKey}`} : {}),
      ...(options.headers ?? {}),
    };
    const req = httpRequest({hostname: '127.0.0.1', port: addr.port, path, method, headers}, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve({status: res.statusCode ?? 0, headers: res.headers, body: JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
    });
    req.on('error', reject);
    if (options.body !== undefined) req.end(JSON.stringify(options.body));
    else req.end();
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('T09 Clinical, Audit, FHIR & T08-Followup HTTP contracts', () => {
  it('supports T08-BACKEND-FOLLOWUP-001 catalog, auth 401/403, default resolvers, and correlation sanitization', async () => {
    const harness = createTestHarness();
    const fhirUrl = await startFhirServer(harness.fhirResources);
    const server = await startApiServer(harness, fhirUrl, {useDefaultResolvers: true});

    const publicSpecialties = await send(server, 'GET', '/v1/specialties');
    expect(publicSpecialties.status).toBe(200);
    expect(ajv.validate('#/components/schemas/SpecialtyList', publicSpecialties.body)).toBe(true);

    // [BLOCKING-3] Untrusted x-correlation-id is never echoed in body or headers.
    const badPublicCorrelation = await send(server, 'GET', '/v1/specialties', {
      headers: {'x-correlation-id': 'untrusted-raw-header'},
    });
    expect(badPublicCorrelation.status).toBe(400);
    expect(badPublicCorrelation.body.error).toMatchObject({code: 'invalid_correlation_id', correlation_id: 'synthetic-redacted-correlation'});
    expect(badPublicCorrelation.headers['x-correlation-id']).toBe('synthetic-redacted-correlation');

    const badAuthCorrelation = await send(server, 'GET', '/v1/doctors', {
      tokenKey: 'patient_a',
      headers: {'x-correlation-id': 'untrusted-raw-header'},
    });
    expect(badAuthCorrelation.status).toBe(400);
    expect(badAuthCorrelation.body.error).toMatchObject({code: 'invalid_correlation_id', correlation_id: 'synthetic-redacted-correlation'});
    expect(badAuthCorrelation.headers['x-correlation-id']).toBe('synthetic-redacted-correlation');

    // Invalid Bearer tokens return 401 across endpoints.
    expect((await send(server, 'GET', '/v1/specialties', {headers: {authorization: 'Bearer invalid'}})).status).toBe(401);
    expect((await send(server, 'GET', '/v1/doctors', {headers: {authorization: 'Bearer invalid'}})).status).toBe(401);
    expect((await send(server, 'POST', '/v1/encounters', {body: {appointment_id: APPT_A_ID, practitioner_id: DOC_A1_ID}})).status).toBe(401);

    // Authenticated /v1/specialties succeeds for PATIENT and denies AUDITOR with 403.
    expect((await send(server, 'GET', '/v1/specialties', {tokenKey: 'patient_a'})).status).toBe(200);
    expect((await send(server, 'GET', '/v1/specialties', {tokenKey: 'auditor_a'})).status).toBe(403);

    const patientDoctors = await send(server, 'GET', '/v1/doctors', {tokenKey: 'patient_a'});
    expect(patientDoctors.status).toBe(200);
    expect(ajv.validate('#/components/schemas/DoctorList', patientDoctors.body)).toBe(true);
    expect((patientDoctors.body.data as Array<{id: string}>).every((doc) => [DOC_A1_ID, DOC_A2_ID, DOC_NURSE_A_ID].includes(doc.id))).toBe(true);

    const filteredDoctors = await send(server, 'GET', '/v1/doctors?specialty=synthetic-cardiology', {tokenKey: 'patient_a'});
    expect(filteredDoctors.status).toBe(200);
    expect((filteredDoctors.body.data as Array<{id: string}>).map((doc) => doc.id)).toEqual([DOC_A1_ID]);

    const invalidTenantParam = await send(server, 'GET', '/v1/doctors?tenant_id=bad-tenant', {tokenKey: 'patient_a'});
    expect(invalidTenantParam.status).toBe(400);

    // Client-supplied cross-tenant query parameter cannot expand scope beyond server-derived tenant.
    const spoofedTenantDoctors = await send(server, 'GET', '/v1/doctors?tenant_id=synthetic-hospital-b', {tokenKey: 'patient_a'});
    expect(spoofedTenantDoctors.status).toBe(200);
    expect(spoofedTenantDoctors.body.data).toEqual([]);

    const patientSlots = await send(server, 'GET', `/v1/slots?doctor_id=${DOC_A1_ID}`, {tokenKey: 'patient_a'});
    const guardianSlots = await send(server, 'GET', `/v1/slots?doctor_id=${DOC_A1_ID}`, {tokenKey: 'guardian_a_valid'});
    expect(patientSlots.status).toBe(200);
    expect(guardianSlots.status).toBe(200);
  });

  it('enforces AC-05, AC-06, AC-08, AC-11 across encounters, concurrency, observations, outbox, FHIR, records, and metrics', async () => {
    const harness = createTestHarness();
    const fhirUrl = await startFhirServer(harness.fhirResources);
    const server = await startApiServer(harness, fhirUrl);

    // 1. Cross-tenant encounter and observation creation fail with disclosure-safe 404 + audit record (AC-05).
    const crossTenant = await send(server, 'POST', '/v1/encounters', {
      tokenKey: 'physician_a',
      headers: {'x-purpose-of-use': 'treatment'},
      body: {appointment_id: APPT_B_ID, practitioner_id: DOC_A1_ID},
    });
    expect(crossTenant.status).toBe(404);
    expect(harness.auditEvents.at(-1)?.action).toBe('encounter.create.denied');

    const crossTenantObs = await send(server, 'POST', `/v1/encounters/${ENCOUNTER_B_ID}/observations`, {
      tokenKey: 'physician_a',
      headers: {'x-purpose-of-use': 'treatment'},
      body: {code: 'synthetic-temp', value: 36.7, unit: 'Cel', measured_at: '2026-11-24T08:15:00Z'},
    });
    expect(crossTenantObs.status).toBe(404);
    expect(harness.auditEvents.at(-1)?.action).toBe('observation.create.denied');

    // 2. Unassigned physician, wrong purpose, patient/receptionist, and cancelled appointment are denied with 403 + audit.
    const unassigned = await send(server, 'POST', '/v1/encounters', {
      tokenKey: 'physician_other_a',
      headers: {'x-purpose-of-use': 'treatment'},
      body: {appointment_id: APPT_A_ID, practitioner_id: DOC_A1_ID},
    });
    expect(unassigned.status).toBe(403);
    expect(harness.auditEvents.at(-1)?.action).toBe('encounter.create.denied');

    const badPurpose = await send(server, 'POST', '/v1/encounters', {
      tokenKey: 'physician_a',
      headers: {'x-purpose-of-use': 'marketing'},
      body: {appointment_id: APPT_A_ID, practitioner_id: DOC_A1_ID},
    });
    expect(badPurpose.status).toBe(403);

    const cancelledAppt = await send(server, 'POST', '/v1/encounters', {
      tokenKey: 'physician_a',
      headers: {'x-purpose-of-use': 'treatment'},
      body: {appointment_id: APPT_A_CANCELLED_ID, practitioner_id: DOC_A1_ID},
    });
    expect(cancelledAppt.status).toBe(403);

    // 3. Assigned physician with valid purpose creates OPEN encounter + audit + private FHIR R4 Patient & Encounter (AC-06, AC-11).
    const createdEncounter = await send(server, 'POST', '/v1/encounters', {
      tokenKey: 'physician_a',
      headers: {'x-purpose-of-use': 'treatment'},
      body: {appointment_id: APPT_A_ID, practitioner_id: DOC_A1_ID},
    });
    expect(createdEncounter.status).toBe(201);
    expect(ajv.validate('#/components/schemas/Encounter', createdEncounter.body)).toBe(true);
    const encounterId = String(createdEncounter.body.id);
    expect(harness.auditEvents.at(-1)).toMatchObject({action: 'encounter.create', resourceRef: `synthetic-encounter-${encounterId}`});
    expect(harness.fhirResources.has(`Patient/${PATIENT_A_ID}`)).toBe(true);
    expect(harness.fhirResources.has(`Encounter/${encounterId}`)).toBe(true);

    // 4. Prohibited observation payload, unknown field, non-ISO date, and oversized body rejected with 400 and zero outbox emission (AC-08).
    const unknownFieldObs = await send(server, 'POST', `/v1/encounters/${encounterId}/observations`, {
      tokenKey: 'physician_a',
      headers: {'x-purpose-of-use': 'treatment'},
      body: {code: 'synthetic-temp', value: 36.7, unit: 'Cel', measured_at: '2026-11-24T08:15:00Z', diagnosis: 'forbidden'},
    });
    expect(unknownFieldObs.status).toBe(400);
    expect(harness.outboxEvents).toHaveLength(0);

    const phiCodeObs = await send(server, 'POST', `/v1/encounters/${encounterId}/observations`, {
      tokenKey: 'physician_a',
      headers: {'x-purpose-of-use': 'treatment'},
      body: {code: 'synthetic-diagnosis-bad', value: 36.7, unit: 'Cel', measured_at: '2026-11-24T08:15:00Z'},
    });
    expect(phiCodeObs.status).toBe(400);
    expect((phiCodeObs.body.error as {code: string}).code).toBe('prohibited_clinical_content');
    expect(harness.outboxEvents).toHaveLength(0);

    const nonIsoDateObs = await send(server, 'POST', `/v1/encounters/${encounterId}/observations`, {
      tokenKey: 'physician_a',
      headers: {'x-purpose-of-use': 'treatment'},
      body: {code: 'synthetic-temp', value: 36.7, unit: 'Cel', measured_at: '2026-11-24'},
    });
    expect(nonIsoDateObs.status).toBe(400);
    expect((nonIsoDateObs.body.error as {code: string}).code).toBe('invalid_measured_at');

    const oversizedBodyObs = await send(server, 'POST', `/v1/encounters/${encounterId}/observations`, {
      tokenKey: 'physician_a',
      headers: {'x-purpose-of-use': 'treatment'},
      body: {code: `synthetic-${'a'.repeat(70000)}`, value: 36.7, unit: 'Cel', measured_at: '2026-11-24T08:15:00Z'},
    });
    expect(oversizedBodyObs.status).toBe(400);

    // 5. Nurse (not assigned to physician encounter) is denied 403, while assigned NURSE succeeds on nurse-assigned encounter.
    const nurseDenied = await send(server, 'POST', `/v1/encounters/${encounterId}/observations`, {
      tokenKey: 'nurse_a',
      headers: {'x-purpose-of-use': 'treatment'},
      body: {code: 'synthetic-temp', value: 36.7, unit: 'Cel', measured_at: '2026-11-24T08:15:00Z'},
    });
    expect(nurseDenied.status).toBe(403);

    const nurseAllowed = await send(server, 'POST', `/v1/encounters/${ENCOUNTER_NURSE_OPEN_ID}/observations`, {
      tokenKey: 'nurse_a',
      headers: {'x-purpose-of-use': 'treatment'},
      body: {code: 'synthetic-spo2', value: 98, unit: '%', measured_at: '2026-11-24T08:12:00Z'},
    });
    expect(nurseAllowed.status).toBe(201);

    // CL-A: Recording observations transitions OPEN -> IN_PROGRESS without auto-completing encounter.
    const [obsA, obsB] = await Promise.all([
      send(server, 'POST', `/v1/encounters/${encounterId}/observations`, {
        tokenKey: 'physician_a',
        headers: {'x-purpose-of-use': 'treatment'},
        body: {code: 'synthetic-temp', value: 36.7, unit: 'Cel', measured_at: '2026-11-24T08:15:00Z'},
      }),
      send(server, 'POST', `/v1/encounters/${encounterId}/observations`, {
        tokenKey: 'physician_a',
        headers: {'x-purpose-of-use': 'treatment'},
        body: {code: 'synthetic-hr', value: 74, unit: 'bpm', measured_at: '2026-11-24T08:15:05Z'},
      }),
    ]);
    expect(obsA.status).toBe(201);
    expect(obsB.status).toBe(201);
    expect(ajv.validate('#/components/schemas/Observation', obsA.body)).toBe(true);
    const observationId = String(obsA.body.id);
    expect(harness.outboxEvents).toHaveLength(0);

    // Concurrent explicit completion allows only ONE transition & ONE outbox event.
    const [compA, compB] = await Promise.all([
      send(server, 'POST', `/v1/encounters/${encounterId}/complete`, {
        tokenKey: 'physician_a',
        headers: {'x-purpose-of-use': 'treatment'},
        body: {},
      }),
      send(server, 'POST', `/v1/encounters/${encounterId}/complete`, {
        tokenKey: 'physician_a',
        headers: {'x-purpose-of-use': 'treatment'},
        body: {},
      }),
    ]);
    const wonComplete = [compA, compB].find((res) => res.status === 200)!;
    const lostComplete = [compA, compB].find((res) => res.status === 403 || res.status === 409)!;
    expect(wonComplete).toBeDefined();
    expect(lostComplete).toBeDefined();
    expect(['encounter_already_completed_or_stale', 'resource_state_denied']).toContain(
      (lostComplete.body.error as {code: string}).code,
    );

    // Outbox envelope strictly carries approved encounter.completed metadata only (AC-08).
    const physicianOutbox = harness.outboxEvents.filter(
      (evt) => (evt.payload as {encounter_ref: string}).encounter_ref === `synthetic-encounter-${encounterId}`,
    );
    expect(physicianOutbox).toHaveLength(1);
    const outbox = physicianOutbox[0];
    expect(outbox.eventType).toBe('encounter.completed');
    expect(outbox.payload).toEqual({encounter_ref: `synthetic-encounter-${encounterId}`, observation_count: 2});
    expect(() =>
      validateEventEnvelope({
        event_id: outbox.eventId,
        event_type: outbox.eventType,
        schema_version: outbox.schemaVersion,
        tenant_id: 'synthetic-hospital-a',
        occurred_at: outbox.createdAt.toISOString(),
        correlation_id: outbox.correlationId,
        payload: outbox.payload,
      }),
    ).not.toThrow();

    // Private HAPI FHIR server has Observation and finished Encounter (AC-11).
    expect(harness.fhirResources.get(`Encounter/${encounterId}`)?.resourceType).toBe('Encounter');
    expect(harness.fhirResources.get(`Observation/${observationId}`)?.resourceType).toBe('Observation');

    // 6. Patient and valid Guardian can read synthetic records; Guardian missing target, revoked Guardian, & Receptionist are denied 403.
    const patientRecords = await send(server, 'GET', '/v1/me/records', {tokenKey: 'patient_a'});
    expect(patientRecords.status).toBe(200);
    expect(ajv.validate('#/components/schemas/RecordList', patientRecords.body)).toBe(true);
    expect((patientRecords.body.data as Array<{resource_ref: string}>).map((item) => item.resource_ref)).toContain(
      `synthetic-observation-${observationId}`,
    );

    const guardianRecords = await send(server, 'GET', '/v1/me/records', {
      tokenKey: 'guardian_a_valid',
      headers: {'x-delegated-patient-subject': 'synthetic-patient-a'},
    });
    expect(guardianRecords.status).toBe(200);

    const guardianMissingTarget = await send(server, 'GET', '/v1/me/records', {
      tokenKey: 'guardian_a_valid',
    });
    expect(guardianMissingTarget.status).toBe(403);

    const revokedGuardianRecords = await send(server, 'GET', '/v1/me/records', {
      tokenKey: 'guardian_a_revoked',
      headers: {'x-delegated-patient-subject': 'synthetic-patient-a'},
    });
    expect(revokedGuardianRecords.status).toBe(403);

    const receptionistRecords = await send(server, 'GET', '/v1/me/records', {tokenKey: 'receptionist_a'});
    expect(receptionistRecords.status).toBe(403);

    // 7. Auditor can read tenant metrics; Patient is denied 403.
    const auditorMetrics = await send(server, 'GET', '/v1/admin/metrics', {tokenKey: 'auditor_a'});
    expect(auditorMetrics.status).toBe(200);
    expect(ajv.validate('#/components/schemas/Metrics', auditorMetrics.body)).toBe(true);
    expect(auditorMetrics.body.data).toMatchObject({appointments_total: 2, encounters_total: 2, observations_total: 3, outbox_pending_total: 1});

    const patientMetrics = await send(server, 'GET', '/v1/admin/metrics', {tokenKey: 'patient_a'});
    expect(patientMetrics.status).toBe(403);

    // 8. Verify no audit event contains Bearer tokens or PHI markers.
    expect(JSON.stringify(harness.auditEvents)).not.toContain('Bearer');
    expect(JSON.stringify(harness.auditEvents)).not.toContain('forbidden');
  });
});
