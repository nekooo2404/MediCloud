import { randomUUID } from 'node:crypto';
import { AppointmentStatus, type PrismaClient } from '@prisma/client';

export interface DashboardQueryOptions {
  role: 'patient' | 'staff';
  actorSubject: string;
  tenantCode?: string;
  patientId?: string;
}

export type VisitType = 'in_person' | 'follow_up' | 'teleconsult';
export type VisitReason = 'general_checkup' | 'follow_up' | 'lab_review' | 'symptom_consult';

export type DashboardMutationInput =
  | {
      action: 'book_appointment';
      patientId?: string;
      slotId?: string;
      practitionerId?: string;
      appointmentDate?: string; // YYYY-MM-DD (Asia/Ho_Chi_Minh)
      appointmentTime?: string; // HH:mm (Asia/Ho_Chi_Minh, 07:00..17:30)
      visitType?: VisitType;
      visitReason?: VisitReason;
      idempotencyKey?: string;
    }
  | {
      action: 'check_in';
      appointmentId: string;
      channel?: 'portal' | 'desk';
    }
  | {
      action: 'create_encounter';
      appointmentId: string;
    }
  | {
      action: 'record_observation';
      encounterId: string;
      code: string;
      value: number;
      unit: string;
    };

export class DashboardAccessError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DashboardAccessError';
  }
}

const TENANT_DISPLAY: Record<string, string> = {
  'synthetic-hospital-a': 'Bệnh viện Đa khoa MediCloud',
  'synthetic-hospital-b': 'Bệnh viện Đa khoa MediCloud — Cơ sở Nam Sài Gòn',
};

const PATIENT_DISPLAY: Record<string, { fullName: string; code: string; initials: string; bloodType: string; allergy: string }> = {
  'synthetic-profile-1': { fullName: 'Nguyễn Minh Anh', code: 'BN-240901', initials: 'MA', bloodType: 'O+', allergy: 'Không ghi nhận' },
  'synthetic-profile-2': { fullName: 'Trần Thu Hà', code: 'BN-240902', initials: 'TH', bloodType: 'A+', allergy: 'Không ghi nhận' },
  'synthetic-profile-3': { fullName: 'Lê Hoàng Nam', code: 'BN-240903', initials: 'HN', bloodType: 'B+', allergy: 'Phấn hoa nhẹ' },
  'synthetic-profile-4': { fullName: 'Phạm Quốc Bảo', code: 'BN-240904', initials: 'QB', bloodType: 'AB+', allergy: 'Không ghi nhận' },
};

const PRACTITIONER_DISPLAY: Record<string, { fullName: string; title: string; initials: string; room: string }> = {
  'synthetic-subject-4': { fullName: 'BS.CKI Trần Minh Quân', title: 'Bác sĩ điều trị chính', initials: 'TQ', room: 'Phòng khám 03' },
  'synthetic-subject-5': { fullName: 'BS. Phạm Bảo Ngọc', title: 'Bác sĩ chuyên khoa', initials: 'BN', room: 'Phòng khám 05' },
  'synthetic-subject-6': { fullName: 'ThS.BS Lê Thu Hà', title: 'Bác sĩ nội tổng quát & tim mạch', initials: 'TH', room: 'Phòng khám 02' },
  'synthetic-subject-7': { fullName: 'BS. Đỗ Quốc Hưng', title: 'Bác sĩ khám lâm sàng', initials: 'QH', room: 'Phòng khám 04' },
};

const SPECIALTY_DISPLAY: Record<string, string> = {
  'synthetic-specialty-1': 'Nội tổng quát',
  'synthetic-specialty-2': 'Nhi khoa',
  'synthetic-specialty-3': 'Tim mạch & Nội tiết',
  'synthetic-specialty-4': 'Chẩn đoán lâm sàng',
};

const OBSERVATION_DISPLAY: Record<string, { label: string; defaultUnit: string }> = {
  'synthetic-code-1': { label: 'Thân nhiệt', defaultUnit: '°C' },
  'synthetic-code-2': { label: 'Thân nhiệt', defaultUnit: '°C' },
  'synthetic-code-3': { label: 'Thân nhiệt', defaultUnit: '°C' },
  'synthetic-code-4': { label: 'Thân nhiệt', defaultUnit: '°C' },
  'synthetic-code-5': { label: 'Thân nhiệt', defaultUnit: '°C' },
  'synthetic-code-6': { label: 'Thân nhiệt', defaultUnit: '°C' },
  'synthetic-code-7': { label: 'Thân nhiệt', defaultUnit: '°C' },
  'synthetic-code-8': { label: 'Thân nhiệt', defaultUnit: '°C' },
  'synthetic-code-9': { label: 'Thân nhiệt', defaultUnit: '°C' },
  'synthetic-code-10': { label: 'Thân nhiệt', defaultUnit: '°C' },
  'synthetic-code-vital': { label: 'Thân nhiệt lâm sàng', defaultUnit: '°C' },
  'synthetic-code-hr': { label: 'Nhịp tim', defaultUnit: 'bpm' },
  'synthetic-code-bp': { label: 'Huyết áp tâm thu', defaultUnit: 'mmHg' },
  'synthetic-code-spo2': { label: 'Độ bão hòa Oxy (SpO₂)', defaultUnit: '%' },
};

const AUDIT_ACTION_DISPLAY: Record<string, string> = {
  'synthetic.seed': 'Khởi tạo dữ liệu hệ thống',
  'appointment.create': 'Đặt lịch khám mới',
  'appointment.check_in': 'Tiếp nhận bệnh nhân (Check-in)',
  'encounter.create': 'Mở hồ sơ khám lâm sàng',
  'observation.create': 'Ghi nhận chỉ số sinh hiệu & Hoàn tất khám',
  'record.read': 'Tra cứu hồ sơ bệnh án',
  'metrics.read': 'Tổng hợp chỉ số vận hành',
};

function formatPatient(profileRef: string, id: string) {
  const mapped = PATIENT_DISPLAY[profileRef];
  if (mapped) return mapped;
  return {
    fullName: `Bệnh nhân ${profileRef.replace(/^synthetic-profile-/, '#')}`,
    code: `BN-${id.slice(-6).toUpperCase()}`,
    initials: 'BN',
    bloodType: 'O+',
    allergy: 'Không ghi nhận',
  };
}

function formatPractitioner(subject: string, specialtyRaw: string) {
  const mapped = PRACTITIONER_DISPLAY[subject];
  const specialty = SPECIALTY_DISPLAY[specialtyRaw] ?? specialtyRaw;
  if (mapped) {
    return { ...mapped, specialty };
  }
  return {
    fullName: `BS. ${subject.replace(/^synthetic-subject-/, 'Cơ hữu #')}`,
    title: 'Bác sĩ chuyên khoa',
    initials: 'BS',
    room: 'Phòng khám 01',
    specialty,
  };
}

function formatObservation(code: string, unitRaw: string) {
  const mapped = OBSERVATION_DISPLAY[code];
  const unit = unitRaw === 'synthetic-unit' ? (mapped?.defaultUnit ?? '°C') : unitRaw;
  return {
    label: mapped?.label ?? 'Chỉ số sinh hiệu',
    unit,
  };
}

export async function getDashboardData(prisma: PrismaClient, options: DashboardQueryOptions) {
  // Server-derived tenant resolution: locked to primary hospital tenant
  const tenant = await prisma.tenant.findUnique({
    where: { code: 'synthetic-hospital-a' },
  });
  if (!tenant || tenant.status !== 'ACTIVE') {
    throw new DashboardAccessError(404, 'tenant_not_found', 'Cơ sở y tế hiện không khả dụng.');
  }

  const tenantId = tenant.id;

  const [
    patients,
    practitioners,
    memberships,
    appointments,
    slots,
    encounters,
    observations,
    auditEvents,
    outboxTotal,
    outboxPending,
  ] = await Promise.all([
    prisma.patient.findMany({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { profileRef: 'asc' },
    }),
    prisma.practitioner.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { id: 'asc' },
    }),
    prisma.membership.findMany({
      where: { tenantId, revokedAt: null },
      include: { user: true },
      orderBy: { id: 'asc' },
    }),
    prisma.appointment.findMany({
      where: { tenantId },
      include: {
        patient: true,
        slot: {
          include: {
            schedule: {
              include: {
                practitioner: {
                  include: { user: true },
                },
              },
            },
          },
        },
        encounters: {
          include: {
            observations: {
              orderBy: { measuredAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: {
        slot: { startsAt: 'asc' },
      },
    }),
    prisma.appointmentSlot.findMany({
      where: { tenantId },
      include: {
        schedule: {
          include: {
            practitioner: {
              include: { user: true },
            },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.encounter.findMany({
      where: { tenantId },
      include: {
        patient: true,
        practitioner: { include: { user: true } },
        appointment: { include: { slot: true } },
        observations: { orderBy: { measuredAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.observation.findMany({
      where: { tenantId },
      include: {
        encounter: {
          include: {
            patient: true,
            practitioner: { include: { user: true } },
          },
        },
      },
      orderBy: { measuredAt: 'asc' },
    }),
    prisma.auditEvent.findMany({
      where: { tenantId },
      include: { actor: true },
      orderBy: { occurredAt: 'desc' },
      take: 20,
    }),
    prisma.outboxEvent.count({ where: { tenantId } }),
    prisma.outboxEvent.count({ where: { tenantId, status: 'PENDING' } }),
  ]);

  // Strict Patient Isolation: patient role is bound to their own authenticated profile only
  const activePatient =
    options.role === 'patient'
      ? (patients.find((p) => p.profileRef === 'synthetic-profile-1') ?? patients[0] ?? null)
      : ((options.patientId ? patients.find((p) => p.id === options.patientId) : undefined) ??
        patients[0] ??
        null);

  const activePractitioner = practitioners[0] ?? null;

  const patientAppointments = activePatient
    ? appointments.filter((a) => a.patientId === activePatient.id)
    : [];
  const patientEncounters = activePatient
    ? encounters.filter((e) => e.patientId === activePatient.id)
    : [];
  const patientObservations = activePatient
    ? observations.filter((o) => o.encounter.patientId === activePatient.id)
    : [];

  const activePatientDisplay = activePatient
    ? formatPatient(activePatient.profileRef, activePatient.id)
    : null;
  const activePractitionerDisplay = activePractitioner
    ? formatPractitioner(activePractitioner.user.subject, activePractitioner.specialty)
    : null;

  return {
    fetchedAt: new Date().toISOString(),
    role: options.role,
    tenant: {
      id: tenant.id,
      code: tenant.code,
      name: TENANT_DISPLAY[tenant.code] ?? tenant.name,
      status: tenant.status,
    },
    activePatient:
      activePatient && activePatientDisplay
        ? {
            id: activePatient.id,
            code: activePatientDisplay.code,
            displayName: activePatientDisplay.fullName,
            initials: activePatientDisplay.initials,
            bloodType: activePatientDisplay.bloodType,
            allergy: activePatientDisplay.allergy,
            status: activePatient.status,
          }
        : null,
    activePractitioner:
      activePractitioner && activePractitionerDisplay
        ? {
            id: activePractitioner.id,
            displayName: activePractitionerDisplay.fullName,
            title: activePractitionerDisplay.title,
            initials: activePractitionerDisplay.initials,
            room: activePractitionerDisplay.room,
            specialty: activePractitionerDisplay.specialty,
            status: activePractitioner.user.status,
          }
        : null,
    // Only staff receives the full tenant patient directory; patient only sees their own record
    patients: (options.role === 'staff' ? patients : activePatient ? [activePatient] : []).map((p) => {
      const info = formatPatient(p.profileRef, p.id);
      return {
        id: p.id,
        code: info.code,
        displayName: info.fullName,
        initials: info.initials,
        status: p.status,
      };
    }),
    practitioners: practitioners.map((p) => {
      const info = formatPractitioner(p.user.subject, p.specialty);
      return {
        id: p.id,
        displayName: info.fullName,
        title: info.title,
        initials: info.initials,
        room: info.room,
        specialty: info.specialty,
        status: p.user.status,
      };
    }),
    slots: slots.map((s) => {
      const docInfo = formatPractitioner(
        s.schedule.practitioner.user.subject,
        s.schedule.practitioner.specialty,
      );
      return {
        id: s.id,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.schedule.endsAt.toISOString(),
        capacity: s.capacity,
        bookedCount: s.bookedCount,
        remaining: Math.max(0, s.capacity - s.bookedCount),
        practitionerId: s.schedule.practitionerId,
        practitionerName: docInfo.fullName,
        room: docInfo.room,
        specialty: docInfo.specialty,
      };
    }),
    appointments: (options.role === 'patient' ? patientAppointments : appointments).map((a) => {
      const patInfo = formatPatient(a.patient.profileRef, a.patient.id);
      const docInfo = formatPractitioner(
        a.slot.schedule.practitioner.user.subject,
        a.slot.schedule.practitioner.specialty,
      );
      return {
        id: a.id,
        referenceCode: `LH-${a.id.slice(-6).toUpperCase()}`,
        patientId: a.patientId,
        patientName: patInfo.fullName,
        patientCode: patInfo.code,
        slotId: a.slotId,
        startsAt: a.slot.startsAt.toISOString(),
        endsAt: a.slot.schedule.endsAt.toISOString(),
        status: a.status,
        checkInStatus: a.checkInStatus,
        checkedInAt: a.checkedInAt?.toISOString() ?? null,
        practitionerId: a.slot.schedule.practitionerId,
        practitionerName: docInfo.fullName,
        room: docInfo.room,
        specialty: docInfo.specialty,
        createdAt: a.createdAt.toISOString(),
        encounters: a.encounters.map((e) => ({
          id: e.id,
          referenceCode: `HS-${e.id.slice(-6).toUpperCase()}`,
          status: e.status,
          createdAt: e.createdAt.toISOString(),
          completedAt: e.completedAt?.toISOString() ?? null,
          observationsCount: e.observations.length,
        })),
      };
    }),
    encounters: (options.role === 'patient' ? patientEncounters : encounters).map((e) => {
      const patInfo = formatPatient(e.patient.profileRef, e.patient.id);
      const docInfo = formatPractitioner(e.practitioner.user.subject, e.practitioner.specialty);
      return {
        id: e.id,
        referenceCode: `HS-${e.id.slice(-6).toUpperCase()}`,
        appointmentId: e.appointmentId,
        patientId: e.patientId,
        patientName: patInfo.fullName,
        patientCode: patInfo.code,
        practitionerId: e.practitionerId,
        practitionerName: docInfo.fullName,
        specialty: docInfo.specialty,
        status: e.status,
        startsAt: e.appointment.slot.startsAt.toISOString(),
        createdAt: e.createdAt.toISOString(),
        completedAt: e.completedAt?.toISOString() ?? null,
        observations: e.observations.map((o) => {
          const obsInfo = formatObservation(o.code, o.unit);
          return {
            id: o.id,
            code: o.code,
            label: obsInfo.label,
            value: Number(o.value),
            unit: obsInfo.unit,
            measuredAt: o.measuredAt.toISOString(),
          };
        }),
      };
    }),
    observations: (options.role === 'patient' ? patientObservations : observations).map((o) => {
      const patInfo = formatPatient(o.encounter.patient.profileRef, o.encounter.patient.id);
      const docInfo = formatPractitioner(
        o.encounter.practitioner.user.subject,
        o.encounter.practitioner.specialty,
      );
      const obsInfo = formatObservation(o.code, o.unit);
      return {
        id: o.id,
        encounterId: o.encounterId,
        encounterCode: `HS-${o.encounterId.slice(-6).toUpperCase()}`,
        patientId: o.encounter.patientId,
        patientName: patInfo.fullName,
        practitionerName: docInfo.fullName,
        code: o.code,
        label: obsInfo.label,
        value: Number(o.value),
        unit: obsInfo.unit,
        measuredAt: o.measuredAt.toISOString(),
      };
    }),
    auditEvents: (options.role === 'staff' ? auditEvents : auditEvents.slice(0, 8)).map((ev) => ({
      id: ev.id,
      action: ev.action,
      actionLabel: AUDIT_ACTION_DISPLAY[ev.action] ?? ev.action,
      purpose: ev.purpose === 'treatment' ? 'Điều trị lâm sàng' : ev.purpose === 'operations' ? 'Điều phối tiếp nhận' : 'Hệ thống',
      occurredAt: ev.occurredAt.toISOString(),
    })),
    metrics: {
      totalTenantsAppointments: appointments.length,
      confirmedAppointments: appointments.filter((a) => a.status === 'CONFIRMED').length,
      pendingAppointments: appointments.filter((a) => a.status === 'PENDING').length,
      completedAppointments: appointments.filter((a) => a.status === 'COMPLETED').length,
      cancelledAppointments: appointments.filter((a) => a.status === 'CANCELLED').length,
      checkedInAppointments: appointments.filter((a) => a.checkInStatus === 'CHECKED_IN').length,
      waitingCheckInAppointments: appointments.filter(
        (a) => (a.status === 'CONFIRMED' || a.status === 'PENDING') && a.checkInStatus === 'NOT_CHECKED_IN',
      ).length,
      totalEncounters: encounters.length,
      openEncounters: encounters.filter((e) => e.status === 'OPEN').length,
      completedEncounters: encounters.filter((e) => e.status === 'COMPLETED').length,
      totalObservations: observations.length,
      availableSlotsCount: slots.filter((s) => s.bookedCount < s.capacity).length,
      staffCount: memberships.length,
      outboxTotal,
      outboxPending,
      patientUpcomingAppointments: patientAppointments.filter(
        (a) => a.status === 'CONFIRMED' || a.status === 'PENDING',
      ).length,
      patientTotalAppointments: patientAppointments.length,
      patientEncountersCount: patientEncounters.length,
      patientCompletedEncountersCount: patientEncounters.filter((e) => e.status === 'COMPLETED').length,
      patientObservationsCount: patientObservations.length,
    },
  };
}

const VALID_VISIT_TYPES = new Set<VisitType>(['in_person', 'follow_up', 'teleconsult']);
const VALID_VISIT_REASONS = new Set<VisitReason>([
  'general_checkup',
  'follow_up',
  'lab_review',
  'symptom_consult',
]);

function parseVietnamAppointmentSlot(
  dateStr: string,
  timeStr: string,
): { startsAt: Date; endsAt: Date } {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!dateMatch) {
    throw new DashboardAccessError(
      400,
      'invalid_appointment_date',
      'Ngày khám không hợp lệ. Vui lòng chọn đúng định dạng YYYY-MM-DD.',
    );
  }
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const checkUtc = new Date(Date.UTC(year, month - 1, day));
  if (
    checkUtc.getUTCFullYear() !== year ||
    checkUtc.getUTCMonth() !== month - 1 ||
    checkUtc.getUTCDate() !== day
  ) {
    throw new DashboardAccessError(
      400,
      'invalid_appointment_date',
      'Ngày khám không tồn tại trên lịch. Vui lòng kiểm tra lại.',
    );
  }

  const timeMatch = /^([01]\d|2[0-3]):(00|30)$/.exec(timeStr.trim());
  if (!timeMatch) {
    throw new DashboardAccessError(
      400,
      'invalid_appointment_time',
      'Giờ khám không hợp lệ. Vui lòng chọn khung giờ tròn hoặc nửa giờ.',
    );
  }
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const totalMinutes = hour * 60 + minute;
  if (totalMinutes < 7 * 60 || totalMinutes > 17 * 60 + 30) {
    throw new DashboardAccessError(
      400,
      'outside_clinic_hours',
      'Khung giờ khám nằm ngoài giờ làm việc (07:00 – 17:30).',
    );
  }

  const startsAt = new Date(`${dateStr.trim()}T${timeStr.trim()}:00+07:00`);
  if (Number.isNaN(startsAt.valueOf())) {
    throw new DashboardAccessError(
      400,
      'invalid_appointment_time',
      'Không thể xác định thời gian khám theo múi giờ Việt Nam.',
    );
  }

  const nowMs = Date.now();
  if (startsAt.getTime() < nowMs - 5 * 60 * 1000) {
    throw new DashboardAccessError(
      400,
      'invalid_appointment_time',
      'Thời gian khám đã qua. Vui lòng chọn ngày giờ từ hiện tại trở đi.',
    );
  }
  if (startsAt.getTime() > nowMs + 90 * 24 * 60 * 60 * 1000) {
    throw new DashboardAccessError(
      400,
      'appointment_too_far',
      'Chỉ hỗ trợ đặt lịch trong vòng 90 ngày tới.',
    );
  }

  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  return { startsAt, endsAt };
}

export async function executeDashboardMutation(
  prisma: PrismaClient,
  context: { role: 'patient' | 'staff'; actorSubject: string; correlationId?: string },
  input: DashboardMutationInput,
) {
  const correlationId =
    context.correlationId && /^synthetic-[a-z0-9-]+$/.test(context.correlationId)
      ? context.correlationId
      : `synthetic-dashboard-${randomUUID().slice(0, 12)}`;

  const tenant = await prisma.tenant.findUnique({
    where: { code: 'synthetic-hospital-a' },
  });
  if (!tenant) {
    throw new DashboardAccessError(404, 'tenant_not_found', 'Không tìm thấy cơ sở y tế.');
  }

  const actorUser = await prisma.user.findUnique({
    where: { subject: context.actorSubject },
    select: { id: true, status: true },
  });
  const actorId = actorUser?.status === 'ACTIVE' ? actorUser.id : null;

  if (input.action === 'book_appointment') {
    const visitType: VisitType =
      input.visitType === undefined
        ? 'in_person'
        : VALID_VISIT_TYPES.has(input.visitType)
          ? input.visitType
          : (() => {
              throw new DashboardAccessError(
                400,
                'invalid_visit_type',
                'Hình thức khám không hợp lệ.',
              );
            })();

    const visitReason: VisitReason =
      input.visitReason === undefined
        ? 'general_checkup'
        : VALID_VISIT_REASONS.has(input.visitReason)
          ? input.visitReason
          : (() => {
              throw new DashboardAccessError(
                400,
                'invalid_visit_reason',
                'Mục đích khám không hợp lệ.',
              );
            })();

    // Strict RBAC: A patient can only book for their own profile; staff can specify patientId
    const patient =
      context.role === 'patient'
        ? await prisma.patient.findFirst({
            where: { tenantId: tenant.id, profileRef: 'synthetic-profile-1', status: 'ACTIVE' },
          })
        : await prisma.patient.findFirst({
            where: { id: input.patientId, tenantId: tenant.id, status: 'ACTIVE' },
          });

    if (!patient) {
      throw new DashboardAccessError(404, 'patient_not_found', 'Không tìm thấy hồ sơ bệnh nhân hợp lệ.');
    }

    const practitionerLookup =
      !input.slotId && input.practitionerId
        ? await prisma.practitioner.findFirst({
            where: { id: input.practitionerId, tenantId: tenant.id },
            select: { id: true },
          })
        : null;

    if (!input.slotId && input.practitionerId && !practitionerLookup) {
      throw new DashboardAccessError(
        404,
        'practitioner_not_found',
        'Không tìm thấy bác sĩ phụ trách tại cơ sở y tế.',
      );
    }

    const parsedScheduleSlot =
      !input.slotId && practitionerLookup && input.appointmentDate && input.appointmentTime
        ? parseVietnamAppointmentSlot(input.appointmentDate, input.appointmentTime)
        : null;

    if (!input.slotId && !parsedScheduleSlot) {
      throw new DashboardAccessError(
        400,
        'invalid_booking_request',
        'Vui lòng chọn bác sĩ, ngày khám và khung giờ hợp lệ.',
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const idempotencyKey =
        input.idempotencyKey && /^[\w-]{16,128}$/.test(input.idempotencyKey)
          ? input.idempotencyKey
          : `synthetic-db-book-${randomUUID().slice(0, 18)}`;

      const existing = await tx.appointment.findUnique({
        where: { tenantId_idempotencyKey: { tenantId: tenant.id, idempotencyKey } },
        include: { slot: { select: { startsAt: true } } },
      });
      if (existing) {
        return { appointment: existing, startsAt: existing.slot.startsAt };
      }

      let resolvedSlotId: string;
      let resolvedStartsAt: Date;

      if (input.slotId) {
        const locked = await tx.$queryRaw<
          Array<{ id: string; capacity: number; bookedCount: number; startsAt: Date }>
        >`
          SELECT "id", "capacity", "bookedCount", "startsAt"
          FROM "appointment_slots"
          WHERE "id" = ${input.slotId}::uuid AND "tenantId" = ${tenant.id}::uuid
          FOR UPDATE
        `;
        const targetSlot = locked[0];
        if (!targetSlot) {
          throw new DashboardAccessError(404, 'slot_not_found', 'Không tìm thấy khung giờ khám hợp lệ.');
        }

        const activeCount = await tx.appointment.count({
          where: {
            tenantId: tenant.id,
            slotId: targetSlot.id,
            status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
          },
        });
        if (activeCount >= targetSlot.capacity) {
          throw new DashboardAccessError(
            409,
            'slot_capacity_exhausted',
            'Khung giờ này vừa hết chỗ trống. Vui lòng chọn khung giờ khác.',
          );
        }

        await tx.appointmentSlot.update({
          where: { id: targetSlot.id },
          data: { bookedCount: activeCount + 1 },
        });
        resolvedSlotId = targetSlot.id;
        resolvedStartsAt = targetSlot.startsAt;
      } else {
        const { startsAt, endsAt } = parsedScheduleSlot!;
        const practitionerId = practitionerLookup!.id;

        const existingSlot = await tx.appointmentSlot.findFirst({
          where: {
            tenantId: tenant.id,
            startsAt,
            schedule: { practitionerId },
          },
          orderBy: { id: 'asc' },
          select: { id: true },
        });

        if (existingSlot) {
          const locked = await tx.$queryRaw<
            Array<{ id: string; capacity: number; bookedCount: number; startsAt: Date }>
          >`
            SELECT "id", "capacity", "bookedCount", "startsAt"
            FROM "appointment_slots"
            WHERE "id" = ${existingSlot.id}::uuid AND "tenantId" = ${tenant.id}::uuid
            FOR UPDATE
          `;
          const targetSlot = locked[0];
          if (!targetSlot) {
            throw new DashboardAccessError(404, 'slot_not_found', 'Khung giờ khám không tồn tại.');
          }
          const activeCount = await tx.appointment.count({
            where: {
              tenantId: tenant.id,
              slotId: targetSlot.id,
              status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
            },
          });
          if (activeCount >= targetSlot.capacity) {
            throw new DashboardAccessError(
              409,
              'slot_capacity_exhausted',
              'Khung giờ này vừa hết chỗ trống. Vui lòng chọn khung giờ khác.',
            );
          }
          await tx.appointmentSlot.update({
            where: { id: targetSlot.id },
            data: { bookedCount: activeCount + 1 },
          });
          resolvedSlotId = targetSlot.id;
          resolvedStartsAt = targetSlot.startsAt;
        } else {
          const schedule = await tx.schedule.create({
            data: {
              id: randomUUID(),
              tenantId: tenant.id,
              practitionerId,
              startsAt,
              endsAt,
            },
          });
          const newSlot = await tx.appointmentSlot.create({
            data: {
              id: randomUUID(),
              tenantId: tenant.id,
              scheduleId: schedule.id,
              startsAt,
              capacity: 2,
              bookedCount: 1,
            },
          });
          resolvedSlotId = newSlot.id;
          resolvedStartsAt = newSlot.startsAt;
        }
      }

      const duplicateForPatient = await tx.appointment.findFirst({
        where: {
          tenantId: tenant.id,
          patientId: patient.id,
          slotId: resolvedSlotId,
          status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        },
        select: { id: true },
      });
      if (duplicateForPatient) {
        throw new DashboardAccessError(
          409,
          'duplicate_patient_booking',
          'Người bệnh đã có lịch hẹn vào khung giờ này với bác sĩ đã chọn.',
        );
      }

      const id = randomUUID();
      const appointment = await tx.appointment.create({
        data: {
          id,
          tenantId: tenant.id,
          patientId: patient.id,
          slotId: resolvedSlotId,
          status: AppointmentStatus.CONFIRMED,
          idempotencyKey,
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          tenantId: tenant.id,
          eventType: 'appointment.created',
          schemaVersion: 1,
          correlationId,
          payload: {
            appointment_ref: `synthetic-appointment-${appointment.id}`,
            channel: context.role === 'staff' ? 'staff' : 'portal',
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId: tenant.id,
          actorId,
          action: 'appointment.create',
          resourceRef: `synthetic-appointment-${appointment.id}`,
          purpose: 'operations',
          correlationId,
          metadata: {
            channel: context.role === 'staff' ? 'staff' : 'portal',
            visitType,
            visitReason,
          },
        },
      });

      return { appointment, startsAt: resolvedStartsAt };
    });

    return {
      ok: true,
      action: 'book_appointment',
      appointmentId: created.appointment.id,
      startsAt: created.startsAt.toISOString(),
      correlationId,
    };
  }

  if (input.action === 'check_in') {
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      include: { patient: true },
    });
    if (!appointment || appointment.tenantId !== tenant.id) {
      throw new DashboardAccessError(404, 'appointment_not_found', 'Không tìm thấy lịch hẹn hợp lệ.');
    }

    // Strict RBAC: Patient can only check-in their own appointment
    if (context.role === 'patient' && appointment.patient.profileRef !== 'synthetic-profile-1') {
      throw new DashboardAccessError(403, 'forbidden', 'Bạn không có quyền thao tác trên lịch hẹn của người bệnh khác.');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new DashboardAccessError(409, 'appointment_cancelled', 'Lịch hẹn đã hủy không thể tiếp nhận.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status:
            appointment.status === AppointmentStatus.PENDING
              ? AppointmentStatus.CONFIRMED
              : appointment.status,
          checkInStatus: 'CHECKED_IN',
          checkedInAt: new Date(),
          checkedInByUserId: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: appointment.tenantId,
          actorId,
          action: 'appointment.check_in',
          resourceRef: `synthetic-appointment-${appointment.id}`,
          purpose: 'operations',
          correlationId,
          metadata: { channel: context.role === 'staff' ? 'desk' : 'portal' },
        },
      });
      return result;
    });

    return {
      ok: true,
      action: 'check_in',
      appointmentId: updated.id,
      checkInStatus: updated.checkInStatus,
      checkedInAt: updated.checkedInAt?.toISOString() ?? null,
      correlationId,
    };
  }

  // Staff-only mutations below: strictly reject patient role
  if (context.role !== 'staff') {
    throw new DashboardAccessError(
      403,
      'staff_role_required',
      'Chỉ bác sĩ hoặc nhân viên y tế mới được phép thực hiện nghiệp vụ lâm sàng này.',
    );
  }

  if (input.action === 'create_encounter') {
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      include: {
        slot: {
          include: {
            schedule: true,
          },
        },
      },
    });
    if (!appointment || appointment.tenantId !== tenant.id) {
      throw new DashboardAccessError(404, 'appointment_not_found', 'Không tìm thấy lịch hẹn để mở hồ sơ khám.');
    }

    const encounter = await prisma.$transaction(async (tx) => {
      if (appointment.checkInStatus !== 'CHECKED_IN') {
        await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            status: AppointmentStatus.CONFIRMED,
            checkInStatus: 'CHECKED_IN',
            checkedInAt: new Date(),
            checkedInByUserId: actorId,
          },
        });
      }

      const created = await tx.encounter.create({
        data: {
          id: randomUUID(),
          tenantId: appointment.tenantId,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          practitionerId: appointment.slot.schedule.practitionerId,
          status: 'OPEN',
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId: appointment.tenantId,
          actorId,
          action: 'encounter.create',
          resourceRef: `synthetic-encounter-${created.id}`,
          purpose: 'treatment',
          correlationId,
          metadata: { status: 'open' },
        },
      });

      return created;
    });

    return {
      ok: true,
      action: 'create_encounter',
      encounterId: encounter.id,
      correlationId,
    };
  }

  if (input.action === 'record_observation') {
    const encounter = await prisma.encounter.findUnique({
      where: { id: input.encounterId },
    });
    if (!encounter || encounter.tenantId !== tenant.id) {
      throw new DashboardAccessError(404, 'encounter_not_found', 'Không tìm thấy hồ sơ khám lâm sàng.');
    }

    const numericValue = Number(input.value);
    if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 500) {
      throw new DashboardAccessError(400, 'invalid_observation_value', 'Giá trị chỉ số sinh hiệu không nằm trong ngưỡng hợp lệ.');
    }
    const cleanCode = /^synthetic-[a-z0-9-]+$/.test(input.code)
      ? input.code
      : 'synthetic-code-vital';
    const cleanUnit = input.unit?.trim() || '°C';

    const observation = await prisma.$transaction(async (tx) => {
      const completedAt = new Date();
      const transitioned = await tx.encounter.updateMany({
        where: { id: encounter.id, tenantId: tenant.id, status: 'OPEN' },
        data: {
          status: 'COMPLETED',
          completedAt,
        },
      });
      if (transitioned.count !== 1) {
        throw new DashboardAccessError(409, 'encounter_already_completed', 'Ca khám này đã được hoàn tất trước đó.');
      }

      await tx.appointment.update({
        where: { id: encounter.appointmentId },
        data: {
          status: AppointmentStatus.COMPLETED,
        },
      });

      const created = await tx.observation.create({
        data: {
          id: randomUUID(),
          tenantId: encounter.tenantId,
          encounterId: encounter.id,
          code: cleanCode,
          value: numericValue,
          unit: cleanUnit,
          measuredAt: completedAt,
        },
      });

      const obsCount = await tx.observation.count({
        where: { tenantId: encounter.tenantId, encounterId: encounter.id },
      });

      await tx.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          tenantId: encounter.tenantId,
          eventType: 'encounter.completed',
          schemaVersion: 1,
          correlationId,
          payload: {
            encounter_ref: `synthetic-encounter-${encounter.id}`,
            observation_count: obsCount,
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId: encounter.tenantId,
          actorId,
          action: 'observation.create',
          resourceRef: `synthetic-observation-${created.id}`,
          purpose: 'treatment',
          correlationId,
          metadata: {
            code: cleanCode,
            status: 'completed',
          },
        },
      });

      return created;
    });

    return {
      ok: true,
      action: 'record_observation',
      observationId: observation.id,
      correlationId,
    };
  }

  throw new DashboardAccessError(400, 'unsupported_action', 'Hành động không được hỗ trợ.');
}
