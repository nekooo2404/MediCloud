import {request as httpRequest} from 'node:http';
import {afterEach, describe, expect, it} from 'vitest';
import type {PrismaClient} from '@prisma/client';
import {createClinicalApiServer} from '../apps/clinical-api/src/scheduling/http-adapter.js';
import type {AuthenticatedPrincipal} from '../apps/clinical-api/src/security/types.js';

const tenantId = 'synthetic-tenant-http';
const principal: AuthenticatedPrincipal = {subject: 'synthetic-http-user', issuer: 'synthetic', audience: 'api', roles: ['RECEPTIONIST'], tenantIds: [tenantId], active: true};
const baseOptions = () => {
  const fake = {appointmentSlot: {findMany: async () => []}, appointment: {findFirst: async () => null}, user: {findUnique: async () => null}} as unknown as PrismaClient;
  return {prisma: fake, verifyAuthorizationHeader: async () => principal, resolvePatientSubject: async () => 'synthetic-patient', resolvePatientId: async () => undefined, resolveMembership: async () => [{tenantId, roles: ['RECEPTIONIST'], active: true}]};
};
const servers: ReturnType<typeof createClinicalApiServer>[] = [];

function send(server: ReturnType<typeof createClinicalApiServer>, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Promise<{status: number; body: Record<string, unknown>}>((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === 'string') return reject(new Error('server address unavailable'));
    const request = httpRequest({hostname: '127.0.0.1', port: address.port, path, method, headers: {'content-type': 'application/json', authorization: 'Bearer synthetic', ...headers}}, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve({status: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
    });
    request.on('error', reject);
    if (body !== undefined) request.end(typeof body === 'string' ? body : JSON.stringify(body)); else request.end();
  });
}

afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });

describe('T05 scheduling HTTP contract', () => {
  it('lists slots with server-derived membership', async () => {
    const server = createClinicalApiServer(baseOptions()).listen(0); servers.push(server);
    const result = await send(server, 'GET', '/v1/slots?doctor_id=synthetic-doctor');
    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty('data');
  });
  it('rejects channel in appointment request as an unknown field', async () => {
    const server = createClinicalApiServer(baseOptions()).listen(0); servers.push(server);
    const result = await send(server, 'POST', '/v1/appointments', {slot_id: 'synthetic-slot', idempotency_key: 'synthetic-idempotency-001', channel: 'portal'}, {'idempotency-key': 'synthetic-idempotency-001'});
    expect(result.status).toBe(400);
    expect(result.body.error).toMatchObject({code: 'unknown_field'});
  });
  it('rejects invalid JSON and missing required fields with 400', async () => {
    const server = createClinicalApiServer(baseOptions()).listen(0); servers.push(server);
    const invalid = await send(server, 'POST', '/v1/appointments', '{not-json}', {'idempotency-key': 'synthetic-idempotency-001'});
    const missing = await send(server, 'POST', '/v1/appointments', {}, {'idempotency-key': 'synthetic-idempotency-001'});
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatchObject({code: 'invalid_json'});
    expect(missing.status).toBe(400);
    expect(missing.body.error).toMatchObject({code: 'slot_id_required'});
  });
  it('returns disclosure-safe 404 for appointment lookup', async () => {
    const server = createClinicalApiServer(baseOptions()).listen(0); servers.push(server);
    const result = await send(server, 'GET', '/v1/appointments/00000000-0000-4000-8000-000000000001');
    expect(result.status).toBe(404);
  });
  it('returns disclosure-safe 404 for check-in lookup', async () => {
    const server = createClinicalApiServer(baseOptions()).listen(0); servers.push(server);
    const result = await send(server, 'POST', '/v1/appointments/00000000-0000-4000-8000-000000000001/check-in', {check_in_channel: 'desk'});
    expect(result.status).toBe(404);
  });
  it('returns generic 500 for unexpected database failure', async () => {
    const options = baseOptions();
    (options.prisma as unknown as {appointmentSlot: {findMany: () => Promise<never>}}).appointmentSlot.findMany = async () => {throw new Error('synthetic database failure');};
    const server = createClinicalApiServer(options).listen(0); servers.push(server);
    const result = await send(server, 'GET', '/v1/slots?doctor_id=synthetic-doctor');
    expect(result.status).toBe(500);
    expect(result.body.error).toMatchObject({code: 'internal_error'});
    expect(JSON.stringify(result.body)).not.toContain('synthetic database failure');
  });
});
