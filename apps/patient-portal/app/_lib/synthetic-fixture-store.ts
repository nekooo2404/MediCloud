import {createHash, randomUUID} from 'node:crypto';
import type {
  ActiveSession,
  Appointment,
  AppointmentStatus,
  CheckInChannel,
  CheckInStatus,
  DoctorSummary,
  ErrorEnvelope,
  PortalAppointmentSummary,
  PortalSimulationMode,
  Slot,
  Specialty,
} from './types';

export interface StoredSlot {
  id: string;
  tenantId: string;
  doctorId: string;
  startsAt: string;
  capacity: number;
  bookedCount: number;
}

export interface StoredAppointment {
  id: string;
  tenantId: string;
  slotId: string;
  patientId: string;
  ownerSubject: string;
  patientRef: string;
  status: AppointmentStatus;
  checkInStatus: CheckInStatus;
  checkedInAt: string | null;
  idempotencyKey: string;
  fingerprint: string;
  correlationId: string;
}

export interface SyntheticPortalStore {
  specialties: Specialty[];
  doctors: Array<DoctorSummary & {tenantId: string}>;
  slots: StoredSlot[];
  appointments: StoredAppointment[];
}

export interface FixtureResult<T> {
  status: number;
  body: T | ErrorEnvelope;
  headers?: Record<string, string>;
  mode: 'synthetic';
  reason?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TENANT_A = '00000000-0000-4000-8000-000000000001';
const TENANT_B = '00000000-0000-4000-8000-000000000002';
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

function assertNonProductionFixtureAllowed(): void {
  if (process.env.MEDICLOUD_ENV === 'production') {
    throw new Error('Fail-closed: synthetic fixture store is forbidden in production');
  }
}

export function bookingFingerprint(slotId: string, patientId: string, serverChannel: 'portal' | 'staff'): string {
  return createHash('sha256').update(JSON.stringify([slotId, patientId, serverChannel])).digest('hex');
}

function createInitialStore(): SyntheticPortalStore {
  const specialties: Specialty[] = [
    {id: 'sp-general', name: 'Nội tổng quát'},
    {id: 'sp-cardio', name: 'Tim mạch'},
    {id: 'sp-pediatrics', name: 'Nhi khoa'},
    {id: 'sp-derma', name: 'Da liễu'},
  ];

  const doctors: Array<DoctorSummary & {tenantId: string}> = [
    {id: uuid(40), tenantId: TENANT_A, display_name: 'BS. Nguyễn Minh An (Mẫu)', specialty: 'Nội tổng quát'},
    {id: uuid(41), tenantId: TENANT_A, display_name: 'BS. Trần Thu Hà (Mẫu)', specialty: 'Tim mạch'},
    {id: uuid(42), tenantId: TENANT_A, display_name: 'BS. Lê Hoàng Nam (Mẫu)', specialty: 'Nhi khoa'},
    {id: uuid(43), tenantId: TENANT_B, display_name: 'BS. Phạm Quốc Huy (Mẫu)', specialty: 'Da liễu'},
  ];

  const slots: StoredSlot[] = [
    {id: uuid(201), tenantId: TENANT_A, doctorId: uuid(40), startsAt: '2026-11-24T01:30:00.000Z', capacity: 3, bookedCount: 1},
    {id: uuid(202), tenantId: TENANT_A, doctorId: uuid(40), startsAt: '2026-11-24T02:30:00.000Z', capacity: 2, bookedCount: 1},
    {id: uuid(203), tenantId: TENANT_A, doctorId: uuid(40), startsAt: '2026-11-24T03:30:00.000Z', capacity: 1, bookedCount: 1},
    {id: uuid(204), tenantId: TENANT_A, doctorId: uuid(41), startsAt: '2026-11-24T07:00:00.000Z', capacity: 2, bookedCount: 0},
    {id: uuid(205), tenantId: TENANT_A, doctorId: uuid(41), startsAt: '2026-11-24T08:00:00.000Z', capacity: 2, bookedCount: 0},
    {id: uuid(206), tenantId: TENANT_A, doctorId: uuid(42), startsAt: '2026-11-25T01:30:00.000Z', capacity: 2, bookedCount: 0},
    {id: uuid(207), tenantId: TENANT_A, doctorId: uuid(42), startsAt: '2026-11-25T02:30:00.000Z', capacity: 1, bookedCount: 0},
    {id: uuid(221), tenantId: TENANT_B, doctorId: uuid(43), startsAt: '2026-11-24T02:00:00.000Z', capacity: 2, bookedCount: 1},
    {id: uuid(222), tenantId: TENANT_B, doctorId: uuid(43), startsAt: '2026-11-24T03:00:00.000Z', capacity: 2, bookedCount: 0},
  ];

  const appointments: StoredAppointment[] = [
    {
      id: uuid(301),
      tenantId: TENANT_A,
      slotId: uuid(201),
      patientId: uuid(30),
      ownerSubject: 'synthetic-subject-1',
      patientRef: 'synthetic-profile-1',
      status: 'confirmed',
      checkInStatus: 'not_checked_in',
      checkedInAt: null,
      idempotencyKey: 'synthetic-seed-key-0001',
      fingerprint: bookingFingerprint(uuid(201), uuid(30), 'portal'),
      correlationId: 'synthetic-seed-appt-301',
    },
    {
      id: uuid(302),
      tenantId: TENANT_A,
      slotId: uuid(202),
      patientId: uuid(30),
      ownerSubject: 'synthetic-subject-1',
      patientRef: 'synthetic-profile-1',
      status: 'confirmed',
      checkInStatus: 'checked_in',
      checkedInAt: '2026-11-24T02:15:00.000Z',
      idempotencyKey: 'synthetic-seed-key-0002',
      fingerprint: bookingFingerprint(uuid(202), uuid(30), 'portal'),
      correlationId: 'synthetic-seed-appt-302',
    },
    {
      id: uuid(303),
      tenantId: TENANT_A,
      slotId: uuid(203),
      patientId: uuid(39),
      ownerSubject: 'synthetic-subject-9',
      patientRef: 'synthetic-profile-9',
      status: 'confirmed',
      checkInStatus: 'not_checked_in',
      checkedInAt: null,
      idempotencyKey: 'synthetic-seed-key-0003',
      fingerprint: bookingFingerprint(uuid(203), uuid(39), 'portal'),
      correlationId: 'synthetic-seed-appt-303',
    },
    {
      id: uuid(304),
      tenantId: TENANT_A,
      slotId: uuid(204),
      patientId: uuid(30),
      ownerSubject: 'synthetic-subject-1',
      patientRef: 'synthetic-profile-1',
      status: 'cancelled',
      checkInStatus: 'not_checked_in',
      checkedInAt: null,
      idempotencyKey: 'synthetic-seed-key-0004',
      fingerprint: bookingFingerprint(uuid(204), uuid(30), 'portal'),
      correlationId: 'synthetic-seed-appt-304',
    },
    {
      id: uuid(310),
      tenantId: TENANT_B,
      slotId: uuid(221),
      patientId: uuid(31),
      ownerSubject: 'synthetic-subject-2',
      patientRef: 'synthetic-profile-2',
      status: 'confirmed',
      checkInStatus: 'not_checked_in',
      checkedInAt: null,
      idempotencyKey: 'synthetic-seed-key-0010',
      fingerprint: bookingFingerprint(uuid(221), uuid(31), 'portal'),
      correlationId: 'synthetic-seed-appt-310',
    },
  ];

  return {specialties, doctors, slots, appointments};
}

const globalForStore = globalThis as typeof globalThis & {
  __medicloudSyntheticPortalStore?: SyntheticPortalStore;
};

function getStore(): SyntheticPortalStore {
  assertNonProductionFixtureAllowed();
  if (!globalForStore.__medicloudSyntheticPortalStore) {
    globalForStore.__medicloudSyntheticPortalStore = createInitialStore();
  }
  return globalForStore.__medicloudSyntheticPortalStore;
}

export function resetSyntheticStoreForTests(): void {
  globalForStore.__medicloudSyntheticPortalStore = createInitialStore();
}

function syntheticError(status: number, code: string, message: string, correlationId: string): FixtureResult<never> {
  return {
    status,
    mode: 'synthetic',
    reason: code,
    body: {error: {code, message, correlation_id: correlationId}},
  };
}

function toAppointmentDto(record: StoredAppointment, correlationId: string): Appointment {
  return {
    id: record.id,
    tenant_id: record.tenantId,
    slot_id: record.slotId,
    status: record.status,
    check_in_status: record.checkInStatus,
    checked_in_at: record.checkedInAt,
    correlation_id: correlationId,
  };
}

function toAppointmentSummary(store: SyntheticPortalStore, record: StoredAppointment): PortalAppointmentSummary {
  const slot = store.slots.find((item) => item.id === record.slotId);
  const doctor = slot ? store.doctors.find((item) => item.id === slot.doctorId) : undefined;
  return {
    ...toAppointmentDto(record, record.correlationId),
    patient_ref: record.patientRef,
    doctor_id: doctor?.id ?? '',
    doctor_name: doctor?.display_name ?? 'Bác sĩ mẫu',
    specialty: doctor?.specialty ?? 'Chưa phân loại',
    starts_at: slot?.startsAt ?? '',
  };
}

async function applySimulation(sim: PortalSimulationMode, correlationId: string): Promise<FixtureResult<never> | null> {
  if (process.env.NODE_ENV !== 'test') return null;
  if (sim === 'degraded') {
    return syntheticError(
      503,
      'private_boundary_degraded',
      'Không thể kết nối ranh giới lâm sàng nội bộ. Chưa có thay đổi nào được xác nhận.',
      correlationId,
    );
  }
  if (sim === 'slow') {
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  return null;
}

export async function getSyntheticCatalog(
  session: ActiveSession,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<FixtureResult<{specialties: Specialty[]; doctors: DoctorSummary[]; correlation_id: string}>> {
  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;
  if (sim === 'empty') {
    return {status: 200, mode: 'synthetic', body: {specialties: [], doctors: [], correlation_id: correlationId}};
  }
  const store = getStore();
  const doctors = store.doctors
    .filter((doc) => doc.tenantId === session.tenantId)
    .map(({id, display_name, specialty}) => ({id, display_name, specialty}));
  const allowedSpecialties = new Set(doctors.map((d) => d.specialty));
  const specialties = store.specialties.filter((sp) => allowedSpecialties.has(sp.name));
  return {status: 200, mode: 'synthetic', body: {specialties, doctors, correlation_id: correlationId}};
}

export async function listSyntheticSlots(
  session: ActiveSession,
  doctorId: string,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<FixtureResult<{data: Slot[]; correlation_id: string}>> {
  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;
  if (sim === 'empty') {
    return {status: 200, mode: 'synthetic', body: {data: [], correlation_id: correlationId}};
  }
  const store = getStore();
  const data = store.slots
    .filter((slot) => slot.tenantId === session.tenantId && slot.doctorId === doctorId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((slot) => ({
      id: slot.id,
      starts_at: slot.startsAt,
      capacity: slot.capacity,
      remaining: Math.max(0, slot.capacity - slot.bookedCount),
    }));
  return {status: 200, mode: 'synthetic', body: {data, correlation_id: correlationId}};
}

export async function listSyntheticAppointments(
  session: ActiveSession,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<FixtureResult<{data: PortalAppointmentSummary[]; correlation_id: string}>> {
  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;
  if (sim === 'empty') {
    return {status: 200, mode: 'synthetic', body: {data: [], correlation_id: correlationId}};
  }
  const store = getStore();
  const visible = store.appointments.filter((appt) => {
    if (appt.tenantId !== session.tenantId) return false;
    if (session.role === 'RECEPTIONIST') return true;
    return appt.ownerSubject === session.subject;
  });
  return {
    status: 200,
    mode: 'synthetic',
    body: {data: visible.map((item) => toAppointmentSummary(store, item)), correlation_id: correlationId},
  };
}

export async function createSyntheticAppointment(
  session: ActiveSession,
  slotId: string,
  patientIdRaw: unknown,
  idempotencyKey: string,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<FixtureResult<Appointment>> {
  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;
  const store = getStore();
  const slot = store.slots.find((item) => item.id === slotId && item.tenantId === session.tenantId);
  if (!slot) {
    return syntheticError(404, 'slot_not_found', 'Không tìm thấy khung giờ thuộc cơ sở hiện tại.', correlationId);
  }
  const effectivePatientId =
    typeof patientIdRaw === 'string'
      ? patientIdRaw
      : session.patientId ?? (session.role === 'RECEPTIONIST' ? uuid(30) : undefined);
  if (!effectivePatientId) {
    return syntheticError(400, 'patient_required', 'Cần xác định mã bệnh nhân cho phiên hiện tại.', correlationId);
  }

  // Authorize ownership BEFORE idempotency replay check (SEC-F)
  if (session.role === 'PATIENT' && session.patientId && effectivePatientId !== session.patientId) {
    return syntheticError(
      403,
      'owner_or_delegation_required',
      'Bệnh nhân chỉ có thể đặt lịch cho hồ sơ thuộc quyền sở hữu hoặc ủy quyền hợp lệ.',
      correlationId,
    );
  }

  const serverChannel: 'portal' | 'staff' = session.role === 'RECEPTIONIST' ? 'staff' : 'portal';
  const fingerprint = bookingFingerprint(slot.id, effectivePatientId, serverChannel);
  const existing = store.appointments.find(
    (item) => item.tenantId === session.tenantId && item.idempotencyKey === idempotencyKey,
  );
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      return syntheticError(
        409,
        'idempotency_conflict',
        'Khóa idempotency_key đã được dùng cho khung giờ hoặc đối tượng khác (409 Conflict).',
        correlationId,
      );
    }
    return {
      status: 201,
      mode: 'synthetic',
      reason: 'idempotent_replay',
      headers: {'x-idempotent-replay': 'true'},
      body: toAppointmentDto(existing, correlationId),
    };
  }

  if (slot.bookedCount >= slot.capacity) {
    return syntheticError(409, 'slot_capacity_exhausted', 'Khung giờ này đã hết chỗ trống. Vui lòng chọn khung giờ khác.', correlationId);
  }

  slot.bookedCount += 1;
  const created: StoredAppointment = {
    id: randomUUID(),
    tenantId: session.tenantId,
    slotId: slot.id,
    patientId: effectivePatientId,
    ownerSubject: session.role === 'RECEPTIONIST' ? 'synthetic-subject-1' : session.subject,
    patientRef: effectivePatientId === uuid(31) ? 'synthetic-profile-2' : 'synthetic-profile-1',
    status: 'confirmed',
    checkInStatus: 'not_checked_in',
    checkedInAt: null,
    idempotencyKey,
    fingerprint,
    correlationId,
  };
  store.appointments.unshift(created);
  return {status: 201, mode: 'synthetic', reason: 'created', body: toAppointmentDto(created, correlationId)};
}

export async function getSyntheticAppointmentById(
  session: ActiveSession,
  appointmentId: string,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<FixtureResult<PortalAppointmentSummary>> {
  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;
  if (!UUID_RE.test(appointmentId)) {
    return syntheticError(400, 'invalid_appointment_id', 'Mã lịch hẹn phải đúng định dạng UUID.', correlationId);
  }
  const store = getStore();
  const record = store.appointments.find((item) => item.id === appointmentId && item.tenantId === session.tenantId);
  if (!record || (session.role === 'PATIENT' && record.ownerSubject !== session.subject)) {
    return syntheticError(
      404,
      'resource_not_found',
      'Không tìm thấy lịch hẹn hoặc không có quyền truy cập trong cơ sở hiện tại.',
      correlationId,
    );
  }
  return {status: 200, mode: 'synthetic', body: toAppointmentSummary(store, record)};
}

export async function checkInSyntheticAppointment(
  session: ActiveSession,
  appointmentId: string,
  checkInChannel: CheckInChannel,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<FixtureResult<Appointment>> {
  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;
  const store = getStore();
  const record = store.appointments.find((item) => item.id === appointmentId && item.tenantId === session.tenantId);
  if (!record) {
    return syntheticError(404, 'appointment_not_found', 'Không tìm thấy lịch hẹn thuộc cơ sở hiện tại.', correlationId);
  }
  if (session.role !== 'RECEPTIONIST') {
    return syntheticError(403, 'role_action_denied', 'Chỉ vai trò lễ tân (RECEPTIONIST) mới có quyền xác nhận tiếp nhận tại quầy.', correlationId);
  }
  if (record.status !== 'confirmed') {
    return syntheticError(403, 'resource_state_denied', 'Chỉ lịch hẹn ở trạng thái đã xác nhận mới được phép tiếp nhận.', correlationId);
  }
  if (record.checkInStatus !== 'checked_in') {
    record.checkInStatus = 'checked_in';
    record.checkedInAt = new Date().toISOString();
    record.correlationId = correlationId;
    void checkInChannel;
  }
  return {status: 200, mode: 'synthetic', reason: 'checked_in', body: toAppointmentDto(record, correlationId)};
}
