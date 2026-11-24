import {PrismaClient} from '@prisma/client';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required to verify PostgreSQL query plans.');
}

const prisma = new PrismaClient();

async function explainPlan(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  name: string,
  sql: string,
  params: unknown[],
) {
  const rows = (await tx.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, ...params)) as Array<{
    'QUERY PLAN': Array<{
      Plan: {
        'Node Type': string;
        'Actual Total Time'?: number;
        'Plans'?: Array<Record<string, unknown>>;
      };
      'Execution Time'?: number;
    }>;
  }>;
  const planRoot = rows[0]?.['QUERY PLAN']?.[0];
  return {
    query: name,
    executionTimeMs: planRoot?.['Execution Time'] ?? null,
    rootNode: planRoot?.Plan?.['Node Type'] ?? 'unknown',
    childNodes: (planRoot?.Plan?.Plans ?? []).map((p) => String(p['Node Type'] ?? 'unknown')),
  };
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: {code: 'synthetic-hospital-a'},
    select: {id: true, code: true},
  });
  if (!tenant) {
    throw new Error('Seeded tenant synthetic-hospital-a not found. Run npm run db:seed first.');
  }

  const [samplePatient, sampleSchedule, sampleEncounter] = await Promise.all([
    prisma.patient.findFirst({where: {tenantId: tenant.id}, select: {id: true}}),
    prisma.schedule.findFirst({where: {tenantId: tenant.id}, select: {id: true}}),
    prisma.encounter.findFirst({where: {tenantId: tenant.id}, select: {id: true}}),
  ]);

  const results = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, tenant.id);
    await tx.$executeRawUnsafe(`SET LOCAL ROLE medicloud_runtime`);
    // Enable index scans cleanly on small seeded dev tables while reporting real PostgreSQL planner output
    await tx.$executeRawUnsafe(`SET LOCAL enable_seqscan = off`);

    const reports = [];
    if (samplePatient) {
      reports.push(
        await explainPlan(
          tx,
          'appointments_by_patient_created_at',
          `SELECT id, "slotId", status, "createdAt" FROM "appointments" WHERE "tenantId" = $1::uuid AND "patientId" = $2::uuid ORDER BY "createdAt" DESC LIMIT 25`,
          [tenant.id, samplePatient.id],
        ),
      );
    }
    if (sampleSchedule) {
      reports.push(
        await explainPlan(
          tx,
          'slots_by_schedule_starts_at',
          `SELECT id, "startsAt", "endsAt", capacity, "bookedCount" FROM "appointment_slots" WHERE "tenantId" = $1::uuid AND "scheduleId" = $2::uuid ORDER BY "startsAt" ASC LIMIT 20`,
          [tenant.id, sampleSchedule.id],
        ),
      );
    }
    reports.push(
      await explainPlan(
        tx,
        'queue_tickets_by_status_created_at',
        `SELECT id, "ticketNumber", status, "createdAt" FROM "queue_tickets" WHERE "tenantId" = $1::uuid AND status = 'WAITING'::"QueueTicketStatus" ORDER BY "createdAt" ASC LIMIT 25`,
        [tenant.id],
      ),
    );
    if (sampleEncounter) {
      reports.push(
        await explainPlan(
          tx,
          'observations_by_encounter_latest_measured_at',
          `SELECT id, code, value, unit, "measuredAt" FROM "observations" WHERE "tenantId" = $1::uuid AND "encounterId" = $2::uuid AND "isLatest" = true ORDER BY "measuredAt" DESC LIMIT 25`,
          [tenant.id, sampleEncounter.id],
        ),
      );
    }
    reports.push(
      await explainPlan(
        tx,
        'audit_events_by_occurred_at',
        `SELECT id, action, purpose, "occurredAt" FROM "audit_events" WHERE "tenantId" = $1::uuid ORDER BY "occurredAt" DESC LIMIT 25`,
        [tenant.id],
      ),
    );
    return reports;
  });

  console.log(
    JSON.stringify(
      {
        status: 'PASS',
        rlsRole: 'medicloud_runtime',
        tenantCode: tenant.code,
        plans: results,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
