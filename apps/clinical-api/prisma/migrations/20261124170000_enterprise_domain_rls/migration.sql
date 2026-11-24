-- Enterprise domain, identity, clinical lifecycle & RLS migration
-- Does NOT duplicate existing init CHECK constraints or audit_events_append_only trigger.

-- 1. Extend existing enums
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';
ALTER TYPE "EncounterStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "EncounterStatus" ADD VALUE IF NOT EXISTS 'AMENDED';
ALTER TYPE "EncounterStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- 2. New enums
CREATE TYPE "QueueTicketStatus" AS ENUM ('CHECKED_IN', 'WAITING', 'CALLED', 'IN_SERVICE', 'DONE', 'SKIPPED');
CREATE TYPE "ObservationStatus" AS ENUM ('DRAFT', 'PRELIMINARY', 'FINAL', 'AMENDED');

-- 3. Organizations code + Departments table
ALTER TABLE "organizations" ADD COLUMN "code" VARCHAR(64);
CREATE UNIQUE INDEX "organizations_tenantId_code_key" ON "organizations"("tenantId", "code");

CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_tenantId_id_key" ON "departments"("tenantId", "id");
CREATE UNIQUE INDEX "departments_tenantId_code_key" ON "departments"("tenantId", "code");
CREATE INDEX "departments_tenantId_organizationId_idx" ON "departments"("tenantId", "organizationId");

ALTER TABLE "departments"
    ADD CONSTRAINT "departments_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "departments"
    ADD CONSTRAINT "departments_tenantId_organizationId_fkey"
    FOREIGN KEY ("tenantId", "organizationId") REFERENCES "organizations"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Patient user binding, PatientProfile, GuardianDelegation
ALTER TABLE "patients" ADD COLUMN "userId" UUID;
CREATE UNIQUE INDEX "patients_tenantId_userId_key" ON "patients"("tenantId", "userId");

ALTER TABLE "patients"
    ADD CONSTRAINT "patients_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "patient_profiles" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "medicalRecordCode" VARCHAR(64) NOT NULL,
    "bloodType" VARCHAR(16),
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "careTeamNotes" VARCHAR(500),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patient_profiles_tenantId_id_key" ON "patient_profiles"("tenantId", "id");
CREATE UNIQUE INDEX "patient_profiles_tenantId_patientId_key" ON "patient_profiles"("tenantId", "patientId");
CREATE UNIQUE INDEX "patient_profiles_tenantId_medicalRecordCode_key" ON "patient_profiles"("tenantId", "medicalRecordCode");

ALTER TABLE "patient_profiles"
    ADD CONSTRAINT "patient_profiles_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_profiles"
    ADD CONSTRAINT "patient_profiles_tenantId_patientId_fkey"
    FOREIGN KEY ("tenantId", "patientId") REFERENCES "patients"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "guardian_delegations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "guardianUserId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "scope" VARCHAR(64) NOT NULL DEFAULT 'FULL_PORTAL',
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_delegations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guardian_delegations_tenantId_id_key" ON "guardian_delegations"("tenantId", "id");
CREATE UNIQUE INDEX "guardian_delegations_tenantId_guardianUserId_patientId_key" ON "guardian_delegations"("tenantId", "guardianUserId", "patientId");
CREATE INDEX "guardian_delegations_tenantId_patientId_idx" ON "guardian_delegations"("tenantId", "patientId");

ALTER TABLE "guardian_delegations"
    ADD CONSTRAINT "guardian_delegations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guardian_delegations"
    ADD CONSTRAINT "guardian_delegations_guardianUserId_fkey"
    FOREIGN KEY ("guardianUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guardian_delegations"
    ADD CONSTRAINT "guardian_delegations_tenantId_patientId_fkey"
    FOREIGN KEY ("tenantId", "patientId") REFERENCES "patients"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Practitioners metadata & facility/department assignment
ALTER TABLE "practitioners"
    ADD COLUMN "organizationId" UUID,
    ADD COLUMN "departmentId" UUID,
    ADD COLUMN "displayName" VARCHAR(160),
    ADD COLUMN "roomLabel" VARCHAR(64),
    ADD COLUMN "degreeTitle" VARCHAR(120);

CREATE INDEX "practitioners_tenantId_departmentId_idx" ON "practitioners"("tenantId", "departmentId");

ALTER TABLE "practitioners"
    ADD CONSTRAINT "practitioners_tenantId_organizationId_fkey"
    FOREIGN KEY ("tenantId", "organizationId") REFERENCES "organizations"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "practitioners"
    ADD CONSTRAINT "practitioners_tenantId_departmentId_fkey"
    FOREIGN KEY ("tenantId", "departmentId") REFERENCES "departments"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. AppointmentSlot endsAt + business uniqueness
ALTER TABLE "appointment_slots" ADD COLUMN "endsAt" TIMESTAMPTZ(3);
UPDATE "appointment_slots" SET "endsAt" = "startsAt" + interval '1 hour' WHERE "endsAt" IS NULL;
ALTER TABLE "appointment_slots" ALTER COLUMN "endsAt" SET NOT NULL;
ALTER TABLE "appointment_slots" ADD CONSTRAINT "appointment_slots_time_range_check" CHECK ("endsAt" > "startsAt");

CREATE UNIQUE INDEX "appointment_slots_tenantId_scheduleId_startsAt_key" ON "appointment_slots"("tenantId", "scheduleId", "startsAt");
CREATE INDEX "appointment_slots_tenantId_scheduleId_startsAt_idx" ON "appointment_slots"("tenantId", "scheduleId", "startsAt");

-- 7. Appointments audit/idempotency/intake/cancellation/reschedule fields & partial active uniqueness
ALTER TABLE "appointments"
    ADD COLUMN "actorSubject" VARCHAR(255),
    ADD COLUMN "requestHash" VARCHAR(128),
    ADD COLUMN "visitType" VARCHAR(40),
    ADD COLUMN "visitReason" VARCHAR(120),
    ADD COLUMN "intakeNote" VARCHAR(600),
    ADD COLUMN "cancelReason" VARCHAR(300),
    ADD COLUMN "cancelledAt" TIMESTAMPTZ(3),
    ADD COLUMN "cancelledByUserId" UUID,
    ADD COLUMN "rescheduledFromId" UUID;

CREATE INDEX "appointments_tenantId_status_createdAt_idx" ON "appointments"("tenantId", "status", "createdAt");
CREATE INDEX "appointments_tenantId_patientId_createdAt_idx" ON "appointments"("tenantId", "patientId", "createdAt");

-- Reconcile any pre-existing duplicate active patient+slot rows and bookedCount before adding partial unique index
WITH ranked AS (
    SELECT "id",
           ROW_NUMBER() OVER (PARTITION BY "tenantId", "patientId", "slotId" ORDER BY "createdAt" ASC, "id" ASC) AS rn
    FROM "appointments"
    WHERE "status" IN ('PENDING', 'CONFIRMED')
)
UPDATE "appointments" a
SET "status" = 'CANCELLED',
    "cancelReason" = 'Deduplicated prior active booking during migration',
    "cancelledAt" = CURRENT_TIMESTAMP
FROM ranked r
WHERE a."id" = r."id" AND r.rn > 1;

UPDATE "appointment_slots" s
SET "bookedCount" = counts.cnt
FROM (
    SELECT s2."id", COALESCE(COUNT(a."id"), 0)::int AS cnt
    FROM "appointment_slots" s2
    LEFT JOIN "appointments" a
        ON a."slotId" = s2."id" AND a."status" IN ('PENDING', 'CONFIRMED', 'COMPLETED')
    GROUP BY s2."id"
) counts
WHERE s."id" = counts."id" AND s."bookedCount" <> counts.cnt;

CREATE UNIQUE INDEX "appointments_active_patient_slot_uniq"
    ON "appointments"("tenantId", "patientId", "slotId")
    WHERE "status" IN ('PENDING', 'CONFIRMED');

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_cancelledByUserId_fkey"
    FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_tenantId_rescheduledFromId_fkey"
    FOREIGN KEY ("tenantId", "rescheduledFromId") REFERENCES "appointments"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. QueueTicket table
CREATE TABLE "queue_tickets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "ticketNumber" VARCHAR(32) NOT NULL,
    "status" "QueueTicketStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "calledAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "queue_tickets_tenantId_id_key" ON "queue_tickets"("tenantId", "id");
CREATE UNIQUE INDEX "queue_tickets_tenantId_appointmentId_key" ON "queue_tickets"("tenantId", "appointmentId");
CREATE INDEX "queue_tickets_tenantId_status_createdAt_idx" ON "queue_tickets"("tenantId", "status", "createdAt");

ALTER TABLE "queue_tickets"
    ADD CONSTRAINT "queue_tickets_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "queue_tickets"
    ADD CONSTRAINT "queue_tickets_tenantId_appointmentId_fkey"
    FOREIGN KEY ("tenantId", "appointmentId") REFERENCES "appointments"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "queue_tickets"
    ADD CONSTRAINT "queue_tickets_tenantId_patientId_fkey"
    FOREIGN KEY ("tenantId", "patientId") REFERENCES "patients"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9. Encounters lifecycle & optimistic concurrency
ALTER TABLE "encounters"
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "startedAt" TIMESTAMPTZ(3),
    ADD COLUMN "cancelledAt" TIMESTAMPTZ(3),
    ADD COLUMN "cancelReason" VARCHAR(300),
    ADD COLUMN "completedByUserId" UUID;

CREATE INDEX "encounters_tenantId_status_createdAt_idx" ON "encounters"("tenantId", "status", "createdAt");

ALTER TABLE "encounters"
    ADD CONSTRAINT "encounters_completedByUserId_fkey"
    FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 10. Observations provenance & amendment history
ALTER TABLE "observations"
    ADD COLUMN "status" "ObservationStatus" NOT NULL DEFAULT 'PRELIMINARY',
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "isLatest" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "authorUserId" UUID,
    ADD COLUMN "supersedesId" UUID,
    ADD COLUMN "amendReason" VARCHAR(300),
    ADD COLUMN "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "observations_tenantId_encounterId_isLatest_measuredAt_idx"
    ON "observations"("tenantId", "encounterId", "isLatest", "measuredAt");

ALTER TABLE "observations"
    ADD CONSTRAINT "observations_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "observations"
    ADD CONSTRAINT "observations_tenantId_supersedesId_fkey"
    FOREIGN KEY ("tenantId", "supersedesId") REFERENCES "observations"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 11. Audit tamper-evidence (TRUNCATE protection reusing reject_audit_mutation())
CREATE TRIGGER audit_events_no_truncate
    BEFORE TRUNCATE ON "audit_events"
    FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();

-- 12. Least-privilege runtime role (NOBYPASSRLS) & PostgreSQL Row-Level Security
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medicloud_runtime') THEN
        CREATE ROLE medicloud_runtime NOLOGIN NOBYPASSRLS;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO medicloud_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO medicloud_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "audit_events" FROM medicloud_runtime;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM medicloud_runtime;

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guardian_delegations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "practitioners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "queue_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "encounters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON "organizations"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "departments"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "memberships"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "patients"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "patient_profiles"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "guardian_delegations"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "practitioners"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "schedules"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "appointment_slots"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "appointments"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "queue_tickets"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "encounters"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "observations"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "outbox_events"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_policy ON "audit_events"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
