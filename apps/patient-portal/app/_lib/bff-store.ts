import {
  callClinicalApi,
  resetUpstreamCircuitForTests,
} from './clinical-api-client';
import {
  checkInSyntheticAppointment,
  createSyntheticAppointment,
  getSyntheticAppointmentById,
  getSyntheticCatalog,
  listSyntheticAppointments,
  listSyntheticSlots,
  resetSyntheticStoreForTests as resetFixtures,
} from './synthetic-fixture-store';
import type {
  ActiveSession,
  Appointment,
  CheckInChannel,
  DoctorSummary,
  ErrorEnvelope,
  PortalAppointmentSummary,
  PortalSimulationMode,
  Slot,
  Specialty,
} from './types';

export interface BffResult<T> {
  status: number;
  body: T | ErrorEnvelope;
  headers?: Record<string, string>;
  mode: 'upstream' | 'synthetic';
  reason?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[\w-]{16,128}$/;

export function resetSyntheticStoreForTests(): void {
  resetUpstreamCircuitForTests();
  resetFixtures();
}

export function parseSimulationMode(raw: string | null | undefined): PortalSimulationMode {
  // BE-C: Only unit tests may activate simulation headers; non-test traffic always runs in normal mode.
  if (process.env.NODE_ENV !== 'test') return 'normal';
  if (raw === 'degraded' || raw === 'empty' || raw === 'slow') return raw;
  return 'normal';
}

function shouldUseUpstream(): boolean {
  if (process.env.MEDICLOUD_ENV === 'production') return true;
  return Boolean(process.env.CLINICAL_API_BASE_URL);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
    body: {error: {code, message, correlation_id: correlationId}},
  };
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

export async function getCatalog(
  session: ActiveSession,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<{specialties: Specialty[]; doctors: DoctorSummary[]; correlation_id: string}>> {
  if (shouldUseUpstream()) {
    const [spRes, docRes] = await Promise.all([
      callClinicalApi<{data: Specialty[]}>('/v1/specialties', {method: 'GET', correlationId, session}),
      callClinicalApi<{data: DoctorSummary[]}>('/v1/doctors', {method: 'GET', correlationId, session}),
    ]);
    if (spRes.status >= 500) return {...spRes, mode: 'upstream'} as BffResult<never>;
    if (docRes.status >= 500) return {...docRes, mode: 'upstream'} as BffResult<never>;
    if (spRes.status === 200 && docRes.status === 200) {
      return {
        status: 200,
        mode: 'upstream',
        body: {
          specialties: (spRes.body as {data: Specialty[]}).data ?? [],
          doctors: (docRes.body as {data: DoctorSummary[]}).data ?? [],
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

  return getSyntheticCatalog(session, correlationId, sim);
}

export async function listSlotsForPortal(
  session: ActiveSession,
  doctorId: string | null,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<{data: Slot[]; correlation_id: string}>> {
  const mode: 'upstream' | 'synthetic' = shouldUseUpstream() ? 'upstream' : 'synthetic';
  if (!doctorId) {
    return errorResponse(400, 'doctor_id_required', 'Vui lòng chọn bác sĩ trước khi tải khung giờ.', correlationId, mode);
  }
  if (mode === 'upstream') {
    const res = await callClinicalApi<{data: Slot[]; correlation_id: string}>(
      `/v1/slots?doctor_id=${encodeURIComponent(doctorId)}`,
      {method: 'GET', correlationId, session},
    );
    return {...res, mode: 'upstream'};
  }
  return listSyntheticSlots(session, doctorId, correlationId, sim);
}

export async function listAppointmentsForPortal(
  session: ActiveSession,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<{data: PortalAppointmentSummary[]; correlation_id: string}>> {
  if (shouldUseUpstream()) {
    const res = await callClinicalApi<{data: Array<Record<string, unknown>>}>('/v1/workspace/appointments', {
      method: 'GET',
      correlationId,
      session,
    });
    if (res.status !== 200) return {...res, mode: 'upstream'} as BffResult<never>;
    const rawItems = ((res.body as {data?: Array<Record<string, unknown>>}).data ?? []).map(
      (item): PortalAppointmentSummary => ({
        id: String(item.id ?? ''),
        tenant_id: session.tenantId,
        slot_id: String(item.slotId ?? ''),
        status: String(item.status ?? 'confirmed').toLowerCase() as Appointment['status'],
        check_in_status: String(item.checkInStatus ?? 'not_checked_in').toLowerCase() as Appointment['check_in_status'],
        checked_in_at: (item.checkedInAt as string | null) ?? null,
        correlation_id: correlationId,
        patient_ref: String(item.patientCode ?? ''),
        doctor_id: String(item.practitionerId ?? ''),
        doctor_name: String(item.practitionerName ?? 'Bác sĩ'),
        specialty: String(item.specialty ?? ''),
        starts_at: String(item.startsAt ?? ''),
      }),
    );
    return {status: 200, mode: 'upstream', body: {data: rawItems, correlation_id: correlationId}};
  }
  return listSyntheticAppointments(session, correlationId, sim);
}

export async function createAppointmentForPortal(
  session: ActiveSession,
  rawBody: unknown,
  idempotencyHeader: string | null,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<Appointment>> {
  const mode: 'upstream' | 'synthetic' = shouldUseUpstream() ? 'upstream' : 'synthetic';
  if (!isPlainObject(rawBody)) {
    return errorResponse(400, 'invalid_json', 'Dữ liệu đặt lịch phải là đối tượng JSON hợp lệ.', correlationId, mode);
  }
  const keyError = validateAllowedKeys(
    rawBody,
    ['slot_id', 'patient_id', 'idempotency_key', 'visit_type', 'visit_reason', 'intake_note'],
    correlationId,
    mode,
  );
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

  if (mode === 'upstream') {
    const res = await callClinicalApi<Appointment>('/v1/appointments', {
      method: 'POST',
      body: JSON.stringify(rawBody),
      idempotencyKey,
      correlationId,
      session,
    });
    return {...res, mode: 'upstream'};
  }

  return createSyntheticAppointment(session, slotId, patientIdRaw, idempotencyKey, correlationId, sim);
}

export async function getAppointmentByIdForPortal(
  session: ActiveSession,
  appointmentId: string,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<PortalAppointmentSummary>> {
  const mode: 'upstream' | 'synthetic' = shouldUseUpstream() ? 'upstream' : 'synthetic';
  if (!UUID_RE.test(appointmentId)) {
    return errorResponse(400, 'invalid_appointment_id', 'Mã lịch hẹn phải đúng định dạng UUID.', correlationId, mode);
  }

  if (mode === 'upstream') {
    const res = await callClinicalApi<Appointment>(`/v1/appointments/${encodeURIComponent(appointmentId)}`, {
      method: 'GET',
      correlationId,
      session,
    });
    if (res.status !== 200) return {...res, mode: 'upstream'} as BffResult<never>;
    const appt = res.body as Appointment;
    return {
      ...res,
      mode: 'upstream',
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

  return getSyntheticAppointmentById(session, appointmentId, correlationId, sim);
}

export async function checkInAppointmentForPortal(
  session: ActiveSession,
  appointmentId: string,
  rawBody: unknown,
  correlationId: string,
  sim: PortalSimulationMode,
): Promise<BffResult<Appointment>> {
  const mode: 'upstream' | 'synthetic' = shouldUseUpstream() ? 'upstream' : 'synthetic';
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

  if (mode === 'upstream') {
    const res = await callClinicalApi<Appointment>(`/v1/appointments/${encodeURIComponent(appointmentId)}/check-in`, {
      method: 'POST',
      body: JSON.stringify({check_in_channel: checkInChannel satisfies CheckInChannel}),
      correlationId,
      session,
    });
    return {...res, mode: 'upstream'};
  }

  return checkInSyntheticAppointment(session, appointmentId, checkInChannel, correlationId, sim);
}
