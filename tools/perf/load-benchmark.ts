import {createHmac, randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';

const BASE_URL = process.env.CLINICAL_API_BASE_URL || 'http://127.0.0.1:4000';
const ACTOR_SIGNING_SECRET =
  process.env.BFF_ACTOR_SIGNING_SECRET ?? 'synthetic-dev-actor-signing-secret-do-not-use-in-prod';

const prisma = new PrismaClient();

function actorHeaders(subject: string, portalRole: 'patient' | 'staff', tenantCode = 'synthetic-hospital-a'): Record<string, string> {
  const payload = Buffer.from(
    JSON.stringify({subject, portalRole, tenantCode, issuedAt: Date.now()}),
    'utf8',
  ).toString('base64url');
  const sig = createHmac('sha256', ACTOR_SIGNING_SECRET).update(payload).digest('hex');
  return {
    authorization: `Bearer ${portalRole === 'staff' ? 'synthetic-bff-staff' : 'synthetic-bff-patient'}`,
    'x-medicloud-actor': payload,
    'x-medicloud-actor-sig': sig,
    'x-tenant-id': tenantCode,
  };
}

function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return Number(sorted[idx].toFixed(2));
}

async function timedFetch(url: string, init: RequestInit): Promise<{status: number; ms: number; body: Record<string, unknown>}> {
  const start = performance.now();
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const ms = performance.now() - start;
  return {status: res.status, ms, body};
}

async function main() {
  const doctorId = '00000000-0000-4000-8000-000000000040';
  const tenant = await prisma.tenant.findUniqueOrThrow({where: {code: 'synthetic-hospital-a'}});

  // 1. Warmup reads
  for (let i = 0; i < 6; i += 1) {
    const res = await timedFetch(`${BASE_URL}/v1/workspace/overview`, {
      method: 'GET',
      headers: actorHeaders('synthetic-subject-1', 'patient'),
    });
    assert.equal(res.status, 200, `Warmup overview failed with ${res.status}`);
  }

  // 2. Measure 60 warm read requests
  const readDurations: number[] = [];
  const readPaths = [
    '/v1/workspace/overview',
    '/v1/workspace/appointments',
    `/v1/slots?doctor_id=${doctorId}`,
  ];
  for (let i = 0; i < 60; i += 1) {
    const path = readPaths[i % readPaths.length];
    const res = await timedFetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: actorHeaders('synthetic-subject-1', 'patient'),
    });
    assert.equal(res.status, 200, `Read ${path} failed with ${res.status}`);
    readDurations.push(res.ms);
  }

  // 3. Publish dedicated isolated capacity=2 test schedule in far future (2027) & test 30-way contention
  const benchDayOffset = Math.floor(Math.random() * 200) + 1;
  const startsAt = new Date(Date.UTC(2027, 0, 1 + benchDayOffset, 2, 0, 0));
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const pubRes = await timedFetch(`${BASE_URL}/v1/schedules/publish`, {
    method: 'POST',
    headers: {
      ...actorHeaders('synthetic-subject-4', 'staff'),
      'content-type': 'application/json',
      'x-correlation-id': `synthetic-bench-pub-${randomUUID()}`,
    },
    body: JSON.stringify({
      practitioner_id: doctorId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      slot_duration_minutes: 60,
      capacity: 2,
    }),
  });
  assert.equal(pubRes.status, 201, `Schedule publish failed: ${JSON.stringify(pubRes.body)}`);
  const scheduleId = String(pubRes.body.schedule_id);
  const slotRow = await prisma.appointmentSlot.findFirstOrThrow({where: {scheduleId}});

  // Create 30 disposable active patient records for true 30-way slot capacity contention
  const tempPatients = await Promise.all(
    Array.from({length: 30}, (_, idx) =>
      prisma.patient.create({
        data: {tenantId: tenant.id, profileRef: `synthetic-perf-p-${idx}-${randomUUID()}`},
      }),
    ),
  );

  const createdApptIds: string[] = [];
  const writeDurations: number[] = [];

  try {
    const race = await Promise.all(
      tempPatients.map((pat, idx) => {
        const key = `synthetic-perf-race-${idx}-${randomUUID()}`;
        return timedFetch(`${BASE_URL}/v1/appointments`, {
          method: 'POST',
          headers: {
            ...actorHeaders('synthetic-subject-4', 'staff'),
            'content-type': 'application/json',
            'x-correlation-id': `synthetic-perf-corr-${randomUUID()}`,
            'Idempotency-Key': key,
          },
          body: JSON.stringify({
            slot_id: slotRow.id,
            patient_id: pat.id,
            idempotency_key: key,
            visit_type: 'in_person',
            visit_reason: 'general_checkup',
          }),
        });
      }),
    );

    let won = 0;
    let conflicted = 0;
    let unexpected = 0;
    for (const r of race) {
      writeDurations.push(r.ms);
      if (r.status === 201) {
        won += 1;
        if (typeof r.body.id === 'string') createdApptIds.push(r.body.id);
      } else if (r.status === 409) {
        conflicted += 1;
      } else {
        unexpected += 1;
      }
    }

    assert.equal(won, 2, `Expected exact 2 winners for capacity=2 slot, got ${won}`);
    assert.equal(conflicted, 28, `Expected 28 409 conflicts, got ${conflicted}`);
    assert.equal(unexpected, 0, `Expected 0 unexpected errors, got ${unexpected}`);

    const readP95 = percentile(readDurations, 95);
    const writeP95 = percentile(writeDurations, 95);
    assert.ok(readP95 <= 300, `Read p95 ${readP95}ms exceeded 300ms SLO`);
    assert.ok(writeP95 <= 800, `Write p95 ${writeP95}ms exceeded 800ms SLO`);

    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          baseUrl: BASE_URL,
          readRequests: readDurations.length,
          readLatencyMs: {
            p50: percentile(readDurations, 50),
            p95: readP95,
            p99: percentile(readDurations, 99),
          },
          contentionTest: {
            concurrency: 30,
            slotCapacity: 2,
            bookingsConfirmed: won,
            conflicts409: conflicted,
            overbookings: Math.max(0, won - 2),
          },
          writeLatencyMs: {
            p50: percentile(writeDurations, 50),
            p95: writeP95,
            p99: percentile(writeDurations, 99),
          },
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } finally {
    // Clean up disposable performance test records while keeping audit trail intact cleanly
    if (createdApptIds.length > 0) {
      await prisma.appointment.deleteMany({where: {id: {in: createdApptIds}}});
    }
    await prisma.appointmentSlot.deleteMany({where: {scheduleId}});
    await prisma.schedule.deleteMany({where: {id: scheduleId}});
    await prisma.patient.deleteMany({where: {id: {in: tempPatients.map((p) => p.id)}}});
    await prisma.outboxEvent.deleteMany({
      where: {
        tenantId: tenant.id,
        correlationId: {startsWith: 'synthetic-perf-corr-'},
      },
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
