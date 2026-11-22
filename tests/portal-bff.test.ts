import { createServer } from 'node:http';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetSyntheticStoreForTests } from '../apps/patient-portal/app/_lib/bff-store';
import { createRedactedBffLog } from '../apps/patient-portal/app/_lib/redacted-log';
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from '../apps/patient-portal/app/_lib/session';
import {
  GET as getAppointments,
  POST as postAppointment,
} from '../apps/patient-portal/app/api/bff/appointments/route';
import { GET as getAppointmentById } from '../apps/patient-portal/app/api/bff/appointments/[id]/route';
import { POST as postCheckIn } from '../apps/patient-portal/app/api/bff/appointments/[id]/check-in/route';
import { GET as getCatalog } from '../apps/patient-portal/app/api/bff/catalog/route';
import {
  DELETE as deleteSession,
  GET as getSession,
  POST as postSession,
} from '../apps/patient-portal/app/api/bff/session/route';
import { GET as getSlots } from '../apps/patient-portal/app/api/bff/slots/route';

const UUID_SLOT_A1 = '00000000-0000-4000-8000-000000000201';
const UUID_SLOT_A2 = '00000000-0000-4000-8000-000000000202';
const UUID_SLOT_FULL = '00000000-0000-4000-8000-000000000203';
const UUID_DOCTOR_A = '00000000-0000-4000-8000-000000000040';
const UUID_APPT_OWN_CONFIRMED = '00000000-0000-4000-8000-000000000301';
const UUID_APPT_OTHER_SAME_TENANT = '00000000-0000-4000-8000-000000000303';
const UUID_APPT_CANCELLED = '00000000-0000-4000-8000-000000000304';
const UUID_APPT_TENANT_B = '00000000-0000-4000-8000-000000000310';

async function signInAs(personaId: string): Promise<string> {
  const response = await postSession(
    new Request('http://127.0.0.1:3000/api/bff/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ persona_id: personaId }),
    }),
  );
  expect(response.status).toBe(200);
  const setCookie = response.headers.get('set-cookie') ?? '';
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie).toContain('SameSite=Lax');
  const cookiePair = setCookie.split(';')[0] ?? '';
  expect(cookiePair.startsWith(`${SESSION_COOKIE_NAME}=`)).toBe(true);
  return cookiePair;
}

describe('T08 Patient/Staff Portal BFF', () => {
  beforeEach(() => {
    delete process.env.CLINICAL_API_BASE_URL;
    delete process.env.CLINICAL_API_TIMEOUT_MS;
    resetSyntheticStoreForTests();
  });

  it('rejects unauthenticated and tampered session cookies with 401', async () => {
    const anonSession = await getSession(new Request('http://127.0.0.1:3000/api/bff/session'));
    expect(anonSession.status).toBe(200);
    expect(await anonSession.json()).toMatchObject({ authenticated: false, session: null });

    const unauthSlots = await getSlots(
      new Request(`http://127.0.0.1:3000/api/bff/slots?doctor_id=${UUID_DOCTOR_A}`),
    );
    expect(unauthSlots.status).toBe(401);

    const tampered = await getCatalog(
      new Request('http://127.0.0.1:3000/api/bff/catalog', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=tampered.invalid-signature` },
      }),
    );
    expect(tampered.status).toBe(401);
    expect(verifySessionCookieValue('tampered.invalid-signature')).toBeNull();
  });

  it('issues, reads, and clears signed HttpOnly session cookies', async () => {
    const cookie = await signInAs('patient-hospital-a');
    const sessionRes = await getSession(
      new Request('http://127.0.0.1:3000/api/bff/session', {
        headers: { cookie },
      }),
    );
    const sessionBody = await sessionRes.json();
    expect(sessionBody.authenticated).toBe(true);
    expect(sessionBody.session.tenantCode).toBe('synthetic-hospital-a');
    expect(sessionBody.session.role).toBe('PATIENT');

    const cleared = await deleteSession(
      new Request('http://127.0.0.1:3000/api/bff/session', { method: 'DELETE' }),
    );
    expect(cleared.status).toBe(200);
    expect(cleared.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('books slots transactionally, replays identical idempotency keys, and enforces 409 conflicts and capacity', async () => {
    const cookie = await signInAs('patient-hospital-a');
    const idempotencyKey = 'synthetic-portal-idempotency-0001';

    const beforeSlotsRes = await getSlots(
      new Request(`http://127.0.0.1:3000/api/bff/slots?doctor_id=${UUID_DOCTOR_A}`, {
        headers: { cookie },
      }),
    );
    const beforeSlots = await beforeSlotsRes.json();
    const targetBefore = beforeSlots.data.find((s: { id: string }) => s.id === UUID_SLOT_A1);
    expect(targetBefore.remaining).toBe(2);

    const createRes = await postAppointment(
      new Request('http://127.0.0.1:3000/api/bff/appointments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ slot_id: UUID_SLOT_A1, idempotency_key: idempotencyKey }),
      }),
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.status).toBe('confirmed');
    expect(created.check_in_status).toBe('not_checked_in');
    expect(created.correlation_id).toMatch(/^synthetic-/);

    const replayRes = await postAppointment(
      new Request('http://127.0.0.1:3000/api/bff/appointments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ slot_id: UUID_SLOT_A1, idempotency_key: idempotencyKey }),
      }),
    );
    expect(replayRes.status).toBe(201);
    expect(replayRes.headers.get('x-idempotent-replay')).toBe('true');
    const replayed = await replayRes.json();
    expect(replayed.id).toBe(created.id);

    const afterSlotsRes = await getSlots(
      new Request(`http://127.0.0.1:3000/api/bff/slots?doctor_id=${UUID_DOCTOR_A}`, {
        headers: { cookie },
      }),
    );
    const afterSlots = await afterSlotsRes.json();
    const targetAfter = afterSlots.data.find((s: { id: string }) => s.id === UUID_SLOT_A1);
    expect(targetAfter.remaining).toBe(1);

    const conflictRes = await postAppointment(
      new Request('http://127.0.0.1:3000/api/bff/appointments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ slot_id: UUID_SLOT_A2, idempotency_key: idempotencyKey }),
      }),
    );
    expect(conflictRes.status).toBe(409);
    expect((await conflictRes.json()).error.code).toBe('idempotency_conflict');

    const exhaustedRes = await postAppointment(
      new Request('http://127.0.0.1:3000/api/bff/appointments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          'Idempotency-Key': 'synthetic-portal-idempotency-0002',
        },
        body: JSON.stringify({
          slot_id: UUID_SLOT_FULL,
          idempotency_key: 'synthetic-portal-idempotency-0002',
        }),
      }),
    );
    expect(exhaustedRes.status).toBe(409);
    expect((await exhaustedRes.json()).error.code).toBe('slot_capacity_exhausted');

    const unknownFieldRes = await postAppointment(
      new Request('http://127.0.0.1:3000/api/bff/appointments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          'Idempotency-Key': 'synthetic-portal-idempotency-0003',
        },
        body: JSON.stringify({
          slot_id: UUID_SLOT_A1,
          idempotency_key: 'synthetic-portal-idempotency-0003',
          channel: 'portal',
        }),
      }),
    );
    expect(unknownFieldRes.status).toBe(400);
    expect((await unknownFieldRes.json()).error.code).toBe('unknown_field');
  });

  it('enforces disclosure-safe 404 across tenants/owners and RBAC check-in rules', async () => {
    const patientCookie = await signInAs('patient-hospital-a');
    const receptionistCookie = await signInAs('receptionist-hospital-a');

    const crossTenantRes = await getAppointmentById(
      new Request(`http://127.0.0.1:3000/api/bff/appointments/${UUID_APPT_TENANT_B}`, {
        headers: { cookie: patientCookie },
      }),
      { params: Promise.resolve({ id: UUID_APPT_TENANT_B }) },
    );
    expect(crossTenantRes.status).toBe(404);

    const otherPatientRes = await getAppointmentById(
      new Request(`http://127.0.0.1:3000/api/bff/appointments/${UUID_APPT_OTHER_SAME_TENANT}`, {
        headers: { cookie: patientCookie },
      }),
      { params: Promise.resolve({ id: UUID_APPT_OTHER_SAME_TENANT }) },
    );
    expect(otherPatientRes.status).toBe(404);

    const patientCheckInDenied = await postCheckIn(
      new Request(`http://127.0.0.1:3000/api/bff/appointments/${UUID_APPT_OWN_CONFIRMED}/check-in`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: patientCookie },
        body: JSON.stringify({ check_in_channel: 'desk' }),
      }),
      { params: Promise.resolve({ id: UUID_APPT_OWN_CONFIRMED }) },
    );
    expect(patientCheckInDenied.status).toBe(403);
    expect((await patientCheckInDenied.json()).error.code).toBe('role_action_denied');

    const staffCheckInOk = await postCheckIn(
      new Request(`http://127.0.0.1:3000/api/bff/appointments/${UUID_APPT_OWN_CONFIRMED}/check-in`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: receptionistCookie },
        body: JSON.stringify({ check_in_channel: 'desk' }),
      }),
      { params: Promise.resolve({ id: UUID_APPT_OWN_CONFIRMED }) },
    );
    expect(staffCheckInOk.status).toBe(200);
    const checkedIn = await staffCheckInOk.json();
    expect(checkedIn.check_in_status).toBe('checked_in');
    expect(checkedIn.checked_in_at).toBeTruthy();

    const staffCheckInRepeat = await postCheckIn(
      new Request(`http://127.0.0.1:3000/api/bff/appointments/${UUID_APPT_OWN_CONFIRMED}/check-in`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: receptionistCookie },
        body: JSON.stringify({ check_in_channel: 'desk' }),
      }),
      { params: Promise.resolve({ id: UUID_APPT_OWN_CONFIRMED }) },
    );
    expect(staffCheckInRepeat.status).toBe(200);
    expect((await staffCheckInRepeat.json()).checked_in_at).toBe(checkedIn.checked_in_at);

    const cancelledCheckIn = await postCheckIn(
      new Request(`http://127.0.0.1:3000/api/bff/appointments/${UUID_APPT_CANCELLED}/check-in`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: receptionistCookie },
        body: JSON.stringify({ check_in_channel: 'desk' }),
      }),
      { params: Promise.resolve({ id: UUID_APPT_CANCELLED }) },
    );
    expect(cancelledCheckIn.status).toBe(403);
    expect((await cancelledCheckIn.json()).error.code).toBe('resource_state_denied');
  });

  it('surfaces explicit 503 degraded state without false confirmation on synthetic outage or upstream timeout', async () => {
    const cookie = await signInAs('patient-hospital-a');
    const beforeList = await (
      await getAppointments(
        new Request('http://127.0.0.1:3000/api/bff/appointments', { headers: { cookie } }),
      )
    ).json();

    const degradedBooking = await postAppointment(
      new Request('http://127.0.0.1:3000/api/bff/appointments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          'Idempotency-Key': 'synthetic-portal-degraded-0001',
          'x-medicloud-sim': 'degraded',
        },
        body: JSON.stringify({
          slot_id: UUID_SLOT_A1,
          idempotency_key: 'synthetic-portal-degraded-0001',
        }),
      }),
    );
    expect(degradedBooking.status).toBe(503);
    const degradedBody = await degradedBooking.json();
    expect(degradedBody.error.code).toBe('private_boundary_degraded');
    expect(degradedBody.error.correlation_id).toMatch(/^synthetic-/);

    const afterList = await (
      await getAppointments(
        new Request('http://127.0.0.1:3000/api/bff/appointments', { headers: { cookie } }),
      )
    ).json();
    expect(afterList.data.length).toBe(beforeList.data.length);

    const slowServer = createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      }, 250);
    });
    await new Promise<void>((resolve) => slowServer.listen(0, '127.0.0.1', () => resolve()));

    try {
      const addr = slowServer.address();
      if (!addr || typeof addr === 'string') throw new Error('bad server address');
      process.env.CLINICAL_API_BASE_URL = `http://127.0.0.1:${addr.port}`;
      process.env.CLINICAL_API_TIMEOUT_MS = '30';

      const upstreamTimeoutRes = await getSlots(
        new Request(`http://127.0.0.1:3000/api/bff/slots?doctor_id=${UUID_DOCTOR_A}`, {
          headers: { cookie },
        }),
      );
      expect(upstreamTimeoutRes.status).toBe(503);
      expect((await upstreamTimeoutRes.json()).error.code).toBe('private_boundary_degraded');
    } finally {
      delete process.env.CLINICAL_API_BASE_URL;
      delete process.env.CLINICAL_API_TIMEOUT_MS;
      await new Promise<void>((resolve) => slowServer.close(() => resolve()));
    }
  });

  it('produces redacted logs free of cookies, bearer tokens, and clinical payloads', () => {
    const log = createRedactedBffLog({
      action: 'POST /api/bff/appointments',
      status: 201,
      correlationId: 'synthetic-corr-123',
      mode: 'synthetic',
      reason: 'created',
    });
    const keys = Object.keys(log);
    expect(keys).toEqual(['ts', 'service', 'action', 'status', 'correlation_id', 'mode', 'reason']);
    expect(JSON.stringify(log)).not.toContain('Bearer');
    expect(JSON.stringify(log)).not.toContain('cookie');
  });
});
