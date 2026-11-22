import { createHash, randomUUID } from 'node:crypto';
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

interface StoredSlot {
  id: string;
  tenantId: string;
  doctorId: string;
  startsAt: string;
  capacity: number;
  bookedCount: number;
}

interface StoredAppointment {
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

interface SyntheticPortalStore {
  specialties: Specialty[];
  doctors: Array<DoctorSummary & { tenantId: string }>;
  slots: StoredSlot[];
  appointments: StoredAppointment[];
}

export interface BffResult<T> {
  status: number;
  body: T | ErrorEnvelope;
  headers?: Record<string, string>;
  mode: 'upstream' | 'synthetic';
  reason?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[\w-]{16,128}$/;

const TENANT_A = '00000000-0000-4000-8000-000000000001';
const TENANT_B = '00000000-0000-4000-8000-000000000002';

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

function createInitialStore(): SyntheticPortalStore {
  const specialties: Specialty[] = [
    { id: 'sp-general', name: 'Nội tổng quát' },
    { id: 'sp-cardio', name: 'Tim mạch' },
    { id: 'sp-pediatrics', name: 'Nhi khoa' },
    { id: 'sp-derma', name: 'Da liễu' },
  ];

  const doctors: Array<DoctorSummary & { tenantId: string }> = [
    { id: uuid(40), tenantId: TENANT_A, display_name: 'BS. Nguyễn Minh An (Mẫu)', specialty: 'Nội tổng quát' },
    { id: uuid(41), tenantId: TENANT_A, display_name: 'BS. Trần Thu Hà (Mẫu)', specialty: 'Tim mạch' },
    { id: uuid(42), tenantId: TENANT_A, display_name: 'BS. Lê Hoàng Nam (Mẫu)', specialty: 'Nhi khoa' },
    { id: uuid(43), tenantId: TENANT_B, display_name: 'BS. Phạm Quốc Huy (Mẫu)', specialty: 'Da liễu' },
  ];

  const slots: StoredSlot[] = [
    { id: uuid(201), tenantId: TENANT_A, doctorId: uuid(40), startsAt: '2026-11-24T01:30:00.000Z', capacity: 3, bookedCount: 1 },
    { id: uuid(202), tenantId: TENANT_A, doctorId: uuid(40), startsAt: '2026-11-24T02:30:00.000Z', capacity: 2, bookedCount: 1 },
    { id: uuid(203), tenantId: TENANT_A, doctorId: uuid(40), startsAt: '2026-11-24T03:30:00.000Z', capacity: 1, bookedCount: 1 },
    { id: uuid(204), tenantId: TENANT_A, doctorId: uuid(41), startsAt: '2026-11-24T07:00:00.000Z', capacity: 2, bookedCount: 0 },
    { id: uuid(205), tenantId: TENANT_A, doctorId: uuid(41), startsAt: '2026-11-24T08:00:00.000Z', capacity: 2, bookedCount: 0 },
    { id: uuid(206), tenantId: TENANT_A, doctorId: uuid(42), startsAt: '2026-11-25T01:30:00.000Z', capacity: 2, bookedCount: 0 },
    { id: uuid(207), tenantId: TENANT_A, doctorId: uuid(42), startsAt: '2026-11-25T02:30:00.000Z', capacity: 1, bookedCount: 0 },
    { id: uuid(221), tenantId: TENANT_B, doctorId: uuid(43), startsAt: '2026-11-24T02:00:00.000Z', capacity: 2, bookedCount: 1 },
    { id: uuid(222), tenantId: TENANT_B, doctorId: uuid(43), startsAt: '2026-11-24T03:00:00.000Z', capacity: 2, bookedCount: 0 },
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

  return { specialties, doctors, slots, appointments };
}

const globalForStore = globalThis as typeof globalThis & {
  __medicloudSyntheticPortalStore?: SyntheticPortalStore;
};

function getStore(): SyntheticPortalStore {
  if (!globalForStore.__medicloudSyntheticPortalStore) {
    globalForStore.__medicloudSyntheticPortalStore = createInitialStore();
  }
  return globalForStore.__medicloudSyntheticPortalStore;
}

export function resetSyntheticStoreForTests(): void {
  globalForStore.__medicloudSyntheticPortalStore = createInitialStore();
}

function bookingFingerprint(slotId: string, patientId: string, serverChannel: 'portal' | 'staff'): string {
  return createHash('sha256').update(JSON.stringify([slotId, patientId, serverChannel])).digest('hex');
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  correlationId: string,
  mode: 'upstream' | 'synthetic',
): BffResult<never> {
  return {
    status,
    mode,
    reason: code,
    body: {
      error: {
        code,
        message,
        correlation_id: correlationId,
      },
    },
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

export function parseSimulationMode(raw: string | null | undefined): PortalSimulationMode {
  if (raw === 'degraded' || raw === 'empty' || raw === 'slow') return raw;
  return 'normal';
}

async function applySimulation(
  sim: PortalSimulationMode,
  correlationId: string,
): Promise<BffResult<never> | null> {
  if (sim === 'degraded') {
    return errorResponse(
      503,
      'private_boundary_degraded',
      'Không thể kết nối ranh giới lâm sàng nội bộ. Chưa có thay đổi nào được xác nhận.',
      correlationId,
      'synthetic',
    );
  }
  if (sim === 'slow') {
    const delayMs = process.env.NODE_ENV === 'test' ? 15 : 420;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateAllowedKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  correlationId: string,
  mode: 'upstream' | 'synthetic',
): BffResult<never> | null {
  const allowedSet = new Set(allowed);
  if (Object.keys(record).some((key) => !allowedSet.has(key))) {
    return errorResponse(400, 'unknown_field', 'Yêu cầu chứa trường không được phép.', correlationId, mode);
  }
  return null;
}

async function callUpstream<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: string; idempotencyKey?: string; correlationId: string },
): Promise<BffResult<T>> {
  const baseUrl = process.env.CLINICAL_API_BASE_URL!;
  const timeoutMs = Number(process.env.CLINICAL_API_TIMEOUT_MS ?? 4000);
  const headers: Record<string, string> = {
    'x-correlation-id': init.correlationId,
    accept: 'application/json',
  };
  if (init.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (init.idempotencyKey) {
    headers['Idempotency-Key'] = init.idempotencyKey;
  }
  const bearer = process.env.CLINICAL_API_BEARER_TOKEN;
  if (bearer) {
    headers.authorization = `Bearer ${bearer}`;
  }

  try {
    const response = await fetch(new URL(path, baseUrl), {
      method: init.method,
      headers,
      body: init.body,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }

    if (response.status >= 500) {
      return errorResponse(
        503,
        'private_boundary_degraded',
        'Ranh giới lâm sàng nội bộ tạm thời gián đoạn. Chưa có thay đổi nào được xác nhận.',
        init.correlationId,
        'upstream',
      );
    }

    const replayHeader = response.headers.get('x-idempotent-replay');
    return {
      status: response.status,
      body: parsed as T | ErrorEnvelope,
      headers: replayHeader ? { 'x-idempotent-replay': replayHeader } : undefined,
      mode: 'upstream',
      reason: response.ok ? 'ok' : 'upstream_error',
    };
  } catch {
    return errorResponse(
      503,
      'private_boundary_degraded',
      'Quá thời gian chờ hoặc mất kết nối tới ranh giới lâm sàng nội bộ. Chưa có thay đổi nào được xác nhận.',
      init.correlationId,
      'upstream',
    );
  }
}

export async function getCatalog(
  session: ActiveSession,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<{ specialties: Specialty[]; doctors: DoctorSummary[]; correlation_id: string }>> {
  if (process.env.CLINICAL_API_BASE_URL) {
    const [spRes, docRes] = await Promise.all([
      callUpstream<{ data: Specialty[] }>('/v1/specialties', { method: 'GET', correlationId }),
      callUpstream<{ data: DoctorSummary[] }>('/v1/doctors', { method: 'GET', correlationId }),
    ]);
    if (spRes.status >= 500) return spRes as BffResult<never>;
    if (docRes.status >= 500) return docRes as BffResult<never>;
    if (spRes.status === 200 && docRes.status === 200) {
      return {
        status: 200,
        mode: 'upstream',
        body: {
          specialties: (spRes.body as { data: Specialty[] }).data ?? [],
          doctors: (docRes.body as { data: DoctorSummary[] }).data ?? [],
          correlation_id: correlationId,
        },
      };
    }
    return errorResponse(
      spRes.status !== 200 ? spRes.status : docRes.status,
      'upstream_catalog_unavailable',
      'Danh mục chuyên khoa hoặc bác sĩ chưa khả dụng ở dịch vụ nguồn.',
      correlationId,
      'upstream',
    );
  }

  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;

  const store = getStore();
  if (sim === 'empty') {
    return { status: 200, mode: 'synthetic', body: { specialties: [], doctors: [], correlation_id: correlationId } };
  }
  const doctors = store.doctors
    .filter((doc) => doc.tenantId === session.tenantId)
    .map(({ id, display_name, specialty }) => ({ id, display_name, specialty }));
  const allowedSpecialties = new Set(doctors.map((d) => d.specialty));
  const specialties = store.specialties.filter((sp) => allowedSpecialties.has(sp.name));
  return {
    status: 200,
    mode: 'synthetic',
    body: { specialties, doctors, correlation_id: correlationId },
  };
}

export async function listSlotsForPortal(
  session: ActiveSession,
  doctorId: string | null,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<{ data: Slot[]; correlation_id: string }>> {
  if (!doctorId) {
    return errorResponse(400, 'doctor_id_required', 'Vui lòng chọn bác sĩ trước khi tải khung giờ.', correlationId, process.env.CLINICAL_API_BASE_URL ? 'upstream' : 'synthetic');
  }

  if (process.env.CLINICAL_API_BASE_URL) {
    return callUpstream<{ data: Slot[]; correlation_id: string }>(
      `/v1/slots?doctor_id=${encodeURIComponent(doctorId)}`,
      { method: 'GET', correlationId },
    );
  }

  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;

  if (sim === 'empty') {
    return { status: 200, mode: 'synthetic', body: { data: [], correlation_id: correlationId } };
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

  return {
    status: 200,
    mode: 'synthetic',
    body: { data, correlation_id: correlationId },
  };
}

export async function listAppointmentsForPortal(
  session: ActiveSession,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<{ data: PortalAppointmentSummary[]; correlation_id: string }>> {
  if (process.env.CLINICAL_API_BASE_URL) {
    return {
      status: 200,
      mode: 'upstream',
      body: { data: [], correlation_id: correlationId },
    };
  }

  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;

  if (sim === 'empty') {
    return { status: 200, mode: 'synthetic', body: { data: [], correlation_id: correlationId } };
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
    body: {
      data: visible.map((item) => toAppointmentSummary(store, item)),
      correlation_id: correlationId,
    },
  };
}

export async function createAppointmentForPortal(
  session: ActiveSession,
  rawBody: unknown,
  idempotencyHeader: string | null,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<Appointment>> {
  const mode: 'upstream' | 'synthetic' = process.env.CLINICAL_API_BASE_URL ? 'upstream' : 'synthetic';
  if (!isPlainObject(rawBody)) {
    return errorResponse(400, 'invalid_json', 'Dữ liệu đặt lịch phải là đối tượng JSON hợp lệ.', correlationId, mode);
  }
  const keyError = validateAllowedKeys(rawBody, ['slot_id', 'patient_id', 'idempotency_key'], correlationId, mode);
  if (keyError) return keyError;

  const slotId = typeof rawBody.slot_id === 'string' ? rawBody.slot_id : '';
  const idempotencyKey = typeof rawBody.idempotency_key === 'string' ? rawBody.idempotency_key : '';
  const patientIdRaw = rawBody.patient_id;
  if (!slotId) {
    return errorResponse(400, 'slot_id_required', 'Cần chọn mã khung giờ khám.', correlationId, mode);
  }
  if (!idempotencyKey || !idempotencyHeader) {
    return errorResponse(409, 'idempotency_key_required', 'Thiếu khóa chống trùng lặp Idempotency-Key.', correlationId, mode);
  }
  if (!IDEMPOTENCY_RE.test(idempotencyKey) || idempotencyKey !== idempotencyHeader) {
    return errorResponse(409, 'idempotency_key_mismatch', 'Idempotency-Key ở header phải khớp với nội dung yêu cầu.', correlationId, mode);
  }
  if (patientIdRaw !== undefined && (typeof patientIdRaw !== 'string' || patientIdRaw.length === 0)) {
    return errorResponse(400, 'patient_id_invalid', 'Mã hồ sơ bệnh nhân không hợp lệ.', correlationId, mode);
  }

  if (process.env.CLINICAL_API_BASE_URL) {
    return callUpstream<Appointment>('/v1/appointments', {
      method: 'POST',
      body: JSON.stringify(rawBody),
      idempotencyKey,
      correlationId,
    });
  }

  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;

  const store = getStore();
  const slot = store.slots.find((item) => item.id === slotId && item.tenantId === session.tenantId);
  if (!slot) {
    return errorResponse(404, 'slot_not_found', 'Không tìm thấy khung giờ thuộc cơ sở hiện tại.', correlationId, 'synthetic');
  }

  const effectivePatientId =
    typeof patientIdRaw === 'string'
      ? patientIdRaw
      : session.patientId ?? (session.role === 'RECEPTIONIST' ? uuid(30) : undefined);

  if (!effectivePatientId) {
    return errorResponse(400, 'patient_required', 'Cần xác định mã bệnh nhân cho phiên hiện tại.', correlationId, 'synthetic');
  }

  const serverChannel: 'portal' | 'staff' = session.role === 'RECEPTIONIST' ? 'staff' : 'portal';
  const fingerprint = bookingFingerprint(slot.id, effectivePatientId, serverChannel);

  const existing = store.appointments.find(
    (item) => item.tenantId === session.tenantId && item.idempotencyKey === idempotencyKey,
  );
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      return errorResponse(
        409,
        'idempotency_conflict',
        'Khóa idempotency_key đã được dùng cho khung giờ hoặc đối tượng khác (409 Conflict).',
        correlationId,
        'synthetic',
      );
    }
    return {
      status: 201,
      mode: 'synthetic',
      reason: 'idempotent_replay',
      headers: { 'x-idempotent-replay': 'true' },
      body: toAppointmentDto(existing, correlationId),
    };
  }

  if (session.role === 'PATIENT' && session.patientId && effectivePatientId !== session.patientId) {
    return errorResponse(
      403,
      'owner_or_delegation_required',
      'Bệnh nhân chỉ có thể đặt lịch cho hồ sơ thuộc quyền sở hữu hoặc ủy quyền hợp lệ.',
      correlationId,
      'synthetic',
    );
  }

  if (slot.bookedCount >= slot.capacity) {
    return errorResponse(
      409,
      'slot_capacity_exhausted',
      'Khung giờ này đã hết chỗ trống. Vui lòng chọn khung giờ khác.',
      correlationId,
      'synthetic',
    );
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

  return {
    status: 201,
    mode: 'synthetic',
    reason: 'created',
    body: toAppointmentDto(created, correlationId),
  };
}

export async function getAppointmentByIdForPortal(
  session: ActiveSession,
  appointmentId: string,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<PortalAppointmentSummary>> {
  const mode: 'upstream' | 'synthetic' = process.env.CLINICAL_API_BASE_URL ? 'upstream' : 'synthetic';
  if (!UUID_RE.test(appointmentId)) {
    return errorResponse(400, 'invalid_appointment_id', 'Mã lịch hẹn phải đúng định dạng UUID.', correlationId, mode);
  }

  if (process.env.CLINICAL_API_BASE_URL) {
    const res = await callUpstream<Appointment>(`/v1/appointments/${encodeURIComponent(appointmentId)}`, {
      method: 'GET',
      correlationId,
    });
    if (res.status !== 200) return res as BffResult<never>;
    const appt = res.body as Appointment;
    return {
      ...res,
      body: {
        ...appt,
        patient_ref: 'upstream-redacted',
        doctor_id: '',
        doctor_name: 'Thông tin từ API lâm sàng',
        specialty: 'Từ máy chủ nguồn',
        starts_at: '',
      },
    };
  }

  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;

  const store = getStore();
  const record = store.appointments.find(
    (item) => item.id === appointmentId && item.tenantId === session.tenantId,
  );
  if (!record) {
    return errorResponse(
      404,
      'resource_not_found',
      'Không tìm thấy lịch hẹn hoặc không có quyền truy cập trong cơ sở hiện tại.',
      correlationId,
      'synthetic',
    );
  }

  if (session.role === 'PATIENT' && record.ownerSubject !== session.subject) {
    return errorResponse(
      404,
      'resource_not_found',
      'Không tìm thấy lịch hẹn hoặc không có quyền truy cập trong cơ sở hiện tại.',
      correlationId,
      'synthetic',
    );
  }

  return {
    status: 200,
    mode: 'synthetic',
    body: toAppointmentSummary(store, record),
  };
}

export async function checkInAppointmentForPortal(
  session: ActiveSession,
  appointmentId: string,
  rawBody: unknown,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<Appointment>> {
  const mode: 'upstream' | 'synthetic' = process.env.CLINICAL_API_BASE_URL ? 'upstream' : 'synthetic';
  if (!UUID_RE.test(appointmentId)) {
    return errorResponse(400, 'invalid_appointment_id', 'Mã lịch hẹn phải đúng định dạng UUID.', correlationId, mode);
  }
  if (!isPlainObject(rawBody)) {
    return errorResponse(400, 'invalid_json', 'Dữ liệu tiếp nhận phải là đối tượng JSON hợp lệ.', correlationId, mode);
  }
  const keyError = validateAllowedKeys(rawBody, ['check_in_channel'], correlationId, mode);
  if (keyError) return keyError;

  const checkInChannel = rawBody.check_in_channel;
  if (checkInChannel !== 'desk' && checkInChannel !== 'portal') {
    return errorResponse(400, 'invalid_channel', 'Kênh tiếp nhận phải là desk hoặc portal.', correlationId, mode);
  }

  if (process.env.CLINICAL_API_BASE_URL) {
    return callUpstream<Appointment>(`/v1/appointments/${encodeURIComponent(appointmentId)}/check-in`, {
      method: 'POST',
      body: JSON.stringify({ check_in_channel: checkInChannel satisfies CheckInChannel }),
      correlationId,
    });
  }

  const simulated = await applySimulation(sim, correlationId);
  if (simulated) return simulated;

  const store = getStore();
  const record = store.appointments.find(
    (item) => item.id === appointmentId && item.tenantId === session.tenantId,
  );
  if (!record) {
    return errorResponse(404, 'appointment_not_found', 'Không tìm thấy lịch hẹn thuộc cơ sở hiện tại.', correlationId, 'synthetic');
  }

  if (session.role !== 'RECEPTIONIST') {
    return errorResponse(
      403,
      'role_action_denied',
      'Chỉ vai trò lễ tân (RECEPTIONIST) mới có quyền xác nhận tiếp nhận tại quầy.',
      correlationId,
      'synthetic',
    );
  }

  if (record.status !== 'confirmed') {
    return errorResponse(
      403,
      'resource_state_denied',
      'Chỉ lịch hẹn ở trạng thái đã xác nhận mới được phép tiếp nhận.',
      correlationId,
      'synthetic',
    );
  }

  if (record.checkInStatus !== 'checked_in') {
    record.checkInStatus = 'checked_in';
    record.checkedInAt = new Date().toISOString();
    record.correlationId = correlationId;
  }

  return {
    status: 200,
    mode: 'synthetic',
    reason: 'checked_in',
    body: toAppointmentDto(record, correlationId),
  };
}
