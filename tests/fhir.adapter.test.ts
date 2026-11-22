import {readFileSync} from 'node:fs';
import {createServer, type Server} from 'node:http';
import {fileURLToPath} from 'node:url';
import {afterEach, describe, expect, it} from 'vitest';
import {
  assertPrivateFhirEndpoint,
  createPrivateHapiFhirClient,
  FhirBoundaryError,
  FhirConformanceError,
  type FhirObservationResource,
  type FhirR4Resource,
  FhirTransportError,
  toFhirEncounter,
  toFhirObservation,
  toFhirPatient,
  validateFhirR4Resource,
} from '../apps/clinical-api/src/fhir/hapi-fhir-adapter.js';

const servers: Server[] = [];

function startMockHapiFhirServer() {
  const store = new Map<string, FhirR4Resource>();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const match = /^\/fhir\/(Patient|Encounter|Observation)\/([^/]+)$/.exec(url.pathname);
    if (!match) {
      response.writeHead(404, {'content-type': 'application/fhir+json'}).end(JSON.stringify({resourceType: 'OperationOutcome'}));
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
  return {
    store,
    listen: () =>
      new Promise<string>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          servers.push(server);
          const address = server.address();
          if (!address || typeof address === 'string') throw new Error('server address unavailable');
          resolve(`http://127.0.0.1:${address.port}`);
        });
      }),
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('T09 Private HAPI FHIR R4 adapter & conformance', () => {
  const patient = toFhirPatient({
    id: '00000000-0000-4000-8000-000000000030',
    tenantCode: 'synthetic-hospital-a',
    profileRef: 'synthetic-profile-1',
  });
  const encounter = toFhirEncounter({
    id: '00000000-0000-4000-8000-000000000401',
    tenantCode: 'synthetic-hospital-a',
    appointmentId: '00000000-0000-4000-8000-000000000301',
    patientId: '00000000-0000-4000-8000-000000000030',
    practitionerId: '00000000-0000-4000-8000-000000000040',
    status: 'COMPLETED',
    createdAt: new Date('2026-11-24T08:00:00Z'),
    completedAt: new Date('2026-11-24T08:30:00Z'),
  });
  const observation = toFhirObservation({
    id: '00000000-0000-4000-8000-000000000501',
    tenantCode: 'synthetic-hospital-a',
    encounterId: '00000000-0000-4000-8000-000000000401',
    patientId: '00000000-0000-4000-8000-000000000030',
    code: 'synthetic-vital-temp',
    value: 36.8,
    unit: 'Cel',
    measuredAt: new Date('2026-11-24T08:20:00Z'),
  });

  it('builds conforming synthetic FHIR R4 Patient, Encounter, and Observation resources', () => {
    expect(() => validateFhirR4Resource(patient)).not.toThrow();
    expect(() => validateFhirR4Resource(encounter)).not.toThrow();
    expect(() => validateFhirR4Resource(observation)).not.toThrow();
    expect(encounter.status).toBe('finished');
    expect(observation.valueQuantity.value).toBe(36.8);

    const fixturePath = fileURLToPath(new URL('../docs/evidence/t09-fhir-conformance-fixtures.json', import.meta.url));
    const fixtureFile = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      fixtures: {patient: unknown; encounter: unknown; observation: unknown};
    };
    expect(() => validateFhirR4Resource(fixtureFile.fixtures.patient)).not.toThrow();
    expect(() => validateFhirR4Resource(fixtureFile.fixtures.encounter)).not.toThrow();
    expect(() => validateFhirR4Resource(fixtureFile.fixtures.observation)).not.toThrow();
  });

  it('rejects PHI/PII fields, dot-segment IDs, free-text notes, and bearer/JWT tokens in FHIR payloads', () => {
    expect(() => validateFhirR4Resource({...patient, name: [{text: 'Real Patient'}]})).toThrow(FhirConformanceError);
    expect(() => validateFhirR4Resource({...patient, telecom: [{value: '0900000000'}]})).toThrow(FhirConformanceError);
    expect(() => validateFhirR4Resource({...observation, note: [{text: 'clinical note'}]})).toThrow(FhirConformanceError);
    expect(() => validateFhirR4Resource({...patient, id: '..'})).toThrow(FhirConformanceError);
    expect(() => validateFhirR4Resource({...encounter, subject: {reference: 'Patient/.'}})).toThrow(FhirConformanceError);
    expect(() =>
      toFhirPatient({
        id: '00000000-0000-4000-8000-000000000031',
        tenantCode: 'synthetic-hospital-a',
        profileRef: 'Bearer secret-token',
      }),
    ).toThrow(FhirConformanceError);
    expect(() =>
      validateFhirR4Resource({
        ...patient,
        identifier: [{system: 'urn:medicloud:synthetic:patient-profile', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.signature123'}],
      }),
    ).toThrow(FhirConformanceError);
  });

  it('restricts HAPI FHIR endpoints strictly to private-boundary hosts', () => {
    expect(() => assertPrivateFhirEndpoint('http://127.0.0.1:8080')).not.toThrow();
    expect(() => assertPrivateFhirEndpoint('http://10.20.0.15:8080')).not.toThrow();
    expect(() => assertPrivateFhirEndpoint('https://hapi-fhir.openstack.local')).not.toThrow();
    expect(() => assertPrivateFhirEndpoint('https://pubsub.googleapis.com')).toThrow(FhirBoundaryError);
    expect(() => assertPrivateFhirEndpoint('https://fhir.example.com')).toThrow(FhirBoundaryError);
    expect(() => assertPrivateFhirEndpoint('http://169.254.169.254/latest')).toThrow(FhirBoundaryError);
    expect(() => assertPrivateFhirEndpoint('http://metadata.google.internal')).toThrow(FhirBoundaryError);
    expect(() => assertPrivateFhirEndpoint('http://instance-data.ec2.internal')).toThrow(FhirBoundaryError);
    expect(() => assertPrivateFhirEndpoint('http://127.0.0.1:8080?query=1')).toThrow(FhirBoundaryError);
    expect(() => assertPrivateFhirEndpoint('http://user:pass@127.0.0.1:8080')).toThrow(FhirBoundaryError);
  });

  it('wraps fetch/timeout and invalid JSON failures in FhirTransportError', async () => {
    const failingClient = createPrivateHapiFhirClient({
      baseUrl: 'http://127.0.0.1:8080',
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    await expect(failingClient.upsertResource(patient, 'synthetic-fhir-net-err')).rejects.toBeInstanceOf(FhirTransportError);
    await expect(failingClient.getResource('Patient', patient.id, 'synthetic-hospital-a', 'synthetic-fhir-net-err')).rejects.toMatchObject({
      status: 503,
      code: 'fhir_network_error',
    });

    const invalidJsonClient = createPrivateHapiFhirClient({
      baseUrl: 'http://127.0.0.1:8080',
      fetchImpl: async () => new Response('not-json', {status: 200, headers: {'content-type': 'text/plain'}}),
    });
    await expect(invalidJsonClient.upsertResource(patient, 'synthetic-fhir-json-err')).rejects.toMatchObject({
      status: 502,
      code: 'fhir_invalid_json',
    });
  });

  it('creates and queries synthetic Patient/Encounter/Observation against a private HTTP HAPI FHIR service and enforces tenant isolation', async () => {
    const mockServer = startMockHapiFhirServer();
    const baseUrl = await mockServer.listen();
    const client = createPrivateHapiFhirClient({baseUrl});

    const savedPatient = await client.upsertResource(patient, 'synthetic-fhir-ac11-1');
    const savedEncounter = await client.upsertResource(encounter, 'synthetic-fhir-ac11-2');
    const savedObservation = await client.upsertResource(observation, 'synthetic-fhir-ac11-3');

    expect(savedPatient.id).toBe(patient.id);
    expect(savedEncounter.status).toBe('finished');
    expect(savedObservation.code.coding[0].code).toBe('synthetic-vital-temp');

    const loaded = await client.getResource<FhirObservationResource>('Observation', observation.id, 'synthetic-hospital-a', 'synthetic-fhir-ac11-4');
    expect(loaded.encounter.reference).toBe(`Encounter/${encounter.id}`);

    // Cross-tenant query returns disclosure-safe 404.
    await expect(
      client.getResource('Observation', observation.id, 'synthetic-hospital-b', 'synthetic-fhir-ac11-5'),
    ).rejects.toMatchObject({status: 404, code: 'fhir_resource_not_found'});
  });
});
