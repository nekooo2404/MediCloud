export type WorkspaceResource = 'overview' | 'appointments' | 'queue' | 'records' | 'vitals' | 'audit';

export interface TenantInfo {
  id: string;
  code: string;
  name: string;
  status?: string;
  roles?: string[];
}

export interface PatientSummary {
  id: string;
  code: string;
  displayName: string;
  initials: string;
  bloodType?: string;
  allergy?: string;
  allergies?: string[];
  status: string;
}

export interface PractitionerSummary {
  id: string;
  displayName: string;
  title: string;
  initials: string;
  room: string;
  specialty: string;
  departmentName?: string;
  status: string;
}

export interface PublishedSlotItem {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  remaining: number;
  practitionerId: string;
  practitionerName: string;
  room: string;
  specialty: string;
}

export interface ObservationItem {
  id: string;
  encounterId?: string;
  encounterCode?: string;
  patientId?: string;
  patientName?: string;
  practitionerName?: string;
  code: string;
  label: string;
  value: number;
  unit: string;
  status: 'DRAFT' | 'PRELIMINARY' | 'FINAL' | 'AMENDED';
  version: number;
  isLatest: boolean;
  supersedesId?: string | null;
  amendReason?: string | null;
  measuredAt: string;
}

export interface EncounterItem {
  id: string;
  referenceCode: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  practitionerId: string;
  practitionerName: string;
  specialty: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'AMENDED' | 'CANCELLED';
  version: number;
  startsAt: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  observations: ObservationItem[];
}

export interface AppointmentItem {
  id: string;
  referenceCode: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  checkInStatus: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'VOIDED';
  checkedInAt: string | null;
  visitType: string | null;
  visitReason: string | null;
  intakeNote: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  rescheduledFromId: string | null;
  practitionerId: string;
  practitionerName: string;
  room: string;
  specialty: string;
  queueTicket: {
    id: string;
    ticketNumber: string;
    status: 'CHECKED_IN' | 'WAITING' | 'CALLED' | 'IN_SERVICE' | 'DONE' | 'SKIPPED';
  } | null;
  createdAt: string;
  encounters: Array<{
    id: string;
    referenceCode: string;
    status: string;
    version: number;
    createdAt: string;
    completedAt: string | null;
    observationsCount: number;
  }>;
}

export interface QueueTicketItem {
  id: string;
  ticketNumber: string;
  status: 'CHECKED_IN' | 'WAITING' | 'CALLED' | 'IN_SERVICE' | 'DONE' | 'SKIPPED';
  appointmentId: string;
  startsAt: string;
  visitType: string | null;
  visitReason: string | null;
  intakeNote: string | null;
  patientId: string;
  patientName: string;
  patientCode: string;
  bloodType: string;
  allergy: string;
  practitionerId: string;
  practitionerName: string;
  room: string;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  encounter: {
    id: string;
    referenceCode: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'AMENDED' | 'CANCELLED';
    version: number;
    observations: ObservationItem[];
  } | null;
}

export interface AuditEventItem {
  id: string;
  action: string;
  actionLabel: string;
  purpose: string;
  occurredAt: string;
  correlationId?: string;
}

export interface WorkspaceOverviewData {
  resource: 'overview';
  tenant: TenantInfo;
  availableTenants: TenantInfo[];
  activePatient: PatientSummary | null;
  activePractitioner: PractitionerSummary | null;
  patients?: PatientSummary[];
  practitioners: PractitionerSummary[];
  specialties: string[];
  slots?: PublishedSlotItem[];
  recentAppointments?: AppointmentItem[];
  metrics: Record<string, number>;
  correlation_id?: string;
}

export interface WorkspaceListSlice<T> {
  resource: WorkspaceResource;
  tenant: TenantInfo;
  nextCursor: string | null;
  data: T[];
  correlation_id?: string;
}

export interface SliceFilterOptions {
  tenantCode?: string;
  cursor?: string;
  limit?: number;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: 'startsAt' | 'status' | 'occurredAt' | 'measuredAt';
  dir?: 'asc' | 'desc';
  patientId?: string;
}

export class WorkspaceClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'WorkspaceClientError';
  }
}

export async function fetchWorkspaceSlice<T>(
  resource: WorkspaceResource,
  filters: SliceFilterOptions = {},
  signal?: AbortSignal,
): Promise<T> {
  const qs = new URLSearchParams();
  if (filters.tenantCode) qs.set('tenantCode', filters.tenantCode);
  if (filters.cursor) qs.set('cursor', filters.cursor);
  if (filters.limit) qs.set('limit', String(filters.limit));
  if (filters.status) qs.set('status', filters.status);
  if (filters.q) qs.set('q', filters.q);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.sort) qs.set('sort', filters.sort);
  if (filters.dir) qs.set('dir', filters.dir);
  if (filters.patientId) qs.set('patientId', filters.patientId);

  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await fetch(`/api/bff/workspace/${resource}${suffix}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ...(filters.tenantCode ? {'x-tenant-id': filters.tenantCode} : {}),
    },
    cache: 'no-store',
    signal,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: {code?: string; message?: string; correlation_id?: string};
  };

  if (!response.ok) {
    throw new WorkspaceClientError(
      response.status,
      payload.error?.code ?? 'workspace_fetch_failed',
      payload.error?.message ?? 'Không thể tải dữ liệu phân hệ.',
      payload.error?.correlation_id,
    );
  }
  return payload as T;
}

export async function fetchDoctorSlots(
  doctorId: string,
  options: {tenantCode?: string; from?: string; to?: string} = {},
  signal?: AbortSignal,
): Promise<Array<{id: string; starts_at: string; ends_at?: string; capacity: number; remaining: number}>> {
  const qs = new URLSearchParams({doctor_id: doctorId});
  if (options.from) qs.set('from', options.from);
  if (options.to) qs.set('to', options.to);
  const res = await fetch(`/api/bff/slots?${qs.toString()}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ...(options.tenantCode ? {'x-tenant-id': options.tenantCode} : {}),
    },
    cache: 'no-store',
    signal,
  });
  const payload = (await res.json().catch(() => ({}))) as {
    data?: Array<{id: string; starts_at: string; ends_at?: string; capacity: number; remaining: number}>;
    error?: {code?: string; message?: string; correlation_id?: string};
  };
  if (!res.ok) {
    throw new WorkspaceClientError(
      res.status,
      payload.error?.code ?? 'slots_fetch_failed',
      payload.error?.message ?? 'Không thể tải khung giờ khám.',
      payload.error?.correlation_id,
    );
  }
  return payload.data ?? [];
}

export async function postWorkspaceMutation<T = Record<string, unknown>>(
  body: Record<string, unknown>,
  tenantCode?: string,
): Promise<T> {
  const res = await fetch('/api/bff/dashboard', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(tenantCode ? {'x-tenant-id': tenantCode} : {}),
    },
    body: JSON.stringify(tenantCode ? {...body, tenantCode} : body),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    error?: {code?: string; message?: string; correlation_id?: string};
  };
  if (!res.ok) {
    throw new WorkspaceClientError(
      res.status,
      payload.error?.code ?? 'mutation_failed',
      payload.error?.message ?? 'Thao tác không thể hoàn tất.',
      payload.error?.correlation_id,
    );
  }
  return payload as T;
}
