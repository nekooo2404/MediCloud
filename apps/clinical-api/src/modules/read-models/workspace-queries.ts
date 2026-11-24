import {
  AppointmentStatus,
  EncounterStatus,
  Prisma,
  type PrismaClient,
  QueueTicketStatus,
} from '@prisma/client';
import {setTransactionTenantContext} from '../../db/tenant-rls.js';
import type {AuthenticatedPrincipal, Role} from '../../security/types.js';

export type WorkspaceSliceName = 'overview' | 'appointments' | 'queue' | 'records' | 'vitals' | 'audit';

export interface WorkspaceQueryContext {
  role: 'patient' | 'staff';
  actorSubject: string;
  tenantCode?: string;
  requestedPatientId?: string;
}

export interface SliceQueryParams {
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

export class WorkspaceAccessError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WorkspaceAccessError';
  }
}

export interface ResolvedWorkspaceContext {
  tenant: {id: string; code: string; name: string; status: string};
  availableTenants: Array<{id: string; code: string; name: string; roles: Role[]}>;
  actorUser: {id: string; subject: string};
  principal: AuthenticatedPrincipal;
  activePatient: {
    id: string;
    code: string;
    displayName: string;
    initials: string;
    bloodType: string;
    allergy: string;
    allergies: string[];
    status: string;
  } | null;
}

const TENANT_DISPLAY: Record<string, string> = {
  'synthetic-hospital-a': 'Bệnh viện Đa khoa MediCloud — Hà Nội',
  'synthetic-hospital-b': 'Bệnh viện Đa khoa MediCloud — Cơ sở Nam Sài Gòn',
};

const OBSERVATION_DISPLAY: Record<string, {label: string; defaultUnit: string}> = {
  'synthetic-systolic-bp': {label: 'Huyết áp tâm thu', defaultUnit: 'mmHg'},
  'synthetic-diastolic-bp': {label: 'Huyết áp tâm trương', defaultUnit: 'mmHg'},
  'synthetic-heart-rate': {label: 'Nhịp tim', defaultUnit: 'bpm'},
  'synthetic-temperature': {label: 'Thân nhiệt', defaultUnit: '°C'},
  'synthetic-spo2': {label: 'Độ bão hòa Oxy (SpO₂)', defaultUnit: '%'},
  'synthetic-blood-glucose': {label: 'Đường huyết mao mạch', defaultUnit: 'mmol/L'},
  'synthetic-code-1': {label: 'Thân nhiệt', defaultUnit: '°C'},
  'synthetic-code-vital': {label: 'Thân nhiệt lâm sàng', defaultUnit: '°C'},
  'synthetic-code-hr': {label: 'Nhịp tim', defaultUnit: 'bpm'},
  'synthetic-code-bp': {label: 'Huyết áp tâm thu', defaultUnit: 'mmHg'},
  'synthetic-code-spo2': {label: 'Độ bão hòa Oxy (SpO₂)', defaultUnit: '%'},
};

const AUDIT_ACTION_DISPLAY: Record<string, string> = {
  'synthetic.seed': 'Khởi tạo dữ liệu hệ thống',
  'appointment.create': 'Đặt lịch khám mới',
  'appointment.cancel': 'Hủy lịch hẹn',
  'appointment.reschedule': 'Đổi lịch hẹn',
  'appointment.no_show': 'Đánh dấu không đến khám',
  'appointment.check_in': 'Tiếp nhận bệnh nhân (Check-in)',
  'queue.transition': 'Cập nhật hàng đợi phòng khám',
  'schedule.publish': 'Công bố lịch khám bác sĩ',
  'encounter.create': 'Mở hồ sơ khám lâm sàng',
  'encounter.complete': 'Hoàn tất ca khám',
  'encounter.cancel': 'Hủy ca khám',
  'observation.create': 'Ghi nhận chỉ số sinh hiệu',
  'observation.amend': 'Đính chính chỉ số sinh hiệu',
  'record.read': 'Tra cứu hồ sơ sức khỏe',
  'metrics.read': 'Xem thống kê vận hành',
};

const STAFF_ROLES = new Set<Role>(['RECEPTIONIST', 'PHYSICIAN', 'NURSE', 'AUDITOR']);

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]?.[0] ?? 'M'}${parts[parts.length - 1]?.[0] ?? 'C'}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'MC';
}

function formatPatientMeta(patient: {
  id: string;
  profileRef: string;
  status: string;
  profile?: {
    displayName: string;
    medicalRecordCode: string;
    bloodType: string | null;
    allergies: string[];
  } | null;
}) {
  const displayName = patient.profile?.displayName ?? `Bệnh nhân (${patient.profileRef})`;
  const code = patient.profile?.medicalRecordCode ?? `BN-${patient.id.slice(-6).toUpperCase()}`;
  const allergies = patient.profile?.allergies ?? [];
  return {
    id: patient.id,
    code,
    displayName,
    initials: initialsFromName(displayName.replace(/\s*\(Mẫu\)$/, '')),
    bloodType: patient.profile?.bloodType ?? 'Chưa cập nhật',
    allergy: allergies.length > 0 ? allergies.join(', ') : 'Không ghi nhận',
    allergies,
    status: patient.status,
  };
}

function formatPractitionerMeta(practitioner: {
  id: string;
  specialty: string;
  displayName?: string | null;
  degreeTitle?: string | null;
  roomLabel?: string | null;
  department?: {name: string} | null;
  user?: {subject: string; status: string} | null;
}) {
  const displayName = practitioner.displayName ?? `BS. (${practitioner.user?.subject ?? practitioner.id.slice(0, 8)})`;
  return {
    id: practitioner.id,
    displayName,
    title: practitioner.degreeTitle ?? 'Bác sĩ chuyên khoa',
    initials: initialsFromName(displayName),
    room: practitioner.roomLabel ?? 'Phòng khám chung',
    specialty: practitioner.specialty,
    departmentName: practitioner.department?.name ?? practitioner.specialty,
    status: practitioner.user?.status ?? 'ACTIVE',
  };
}

function formatObsLabel(code: string, unit: string) {
  const entry = OBSERVATION_DISPLAY[code];
  return {label: entry?.label ?? code, unit: unit || entry?.defaultUnit || ''};
}

function clampLimit(raw?: number, fallback = 25): number {
  if (!raw || !Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.trunc(raw), 1), 50);
}

function parseBoundedDates(fromRaw?: string, toRaw?: string): {from?: Date; to?: Date} {
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;
  if (from && Number.isNaN(from.valueOf())) {
    throw new WorkspaceAccessError(400, 'invalid_from_date', 'Tham số ngày bắt đầu không hợp lệ.');
  }
  if (to && Number.isNaN(to.valueOf())) {
    throw new WorkspaceAccessError(400, 'invalid_to_date', 'Tham số ngày kết thúc không hợp lệ.');
  }
  if (from && to) {
    if (to < from) {
      throw new WorkspaceAccessError(400, 'invalid_date_range', 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.');
    }
    const maxSpanMs = 90 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxSpanMs) {
      throw new WorkspaceAccessError(400, 'date_range_exceeded', 'Khoảng thời gian truy vấn tối đa là 90 ngày.');
    }
  }
  return {from, to};
}

export async function resolveWorkspaceContext(
  prisma: PrismaClient,
  options: WorkspaceQueryContext,
): Promise<ResolvedWorkspaceContext> {
  const user = await prisma.user.findUnique({
    where: {subject: options.actorSubject},
    include: {
      memberships: {
        where: {revokedAt: null},
        include: {tenant: {select: {id: true, code: true, name: true, status: true}}},
      },
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new WorkspaceAccessError(401, 'inactive_principal', 'Tài khoản người dùng chưa được kích hoạt.');
  }

  const activeMemberships = user.memberships.filter((m) => m.tenant.status === 'ACTIVE');
  if (activeMemberships.length === 0) {
    throw new WorkspaceAccessError(403, 'tenant_membership_required', 'Tài khoản chưa thuộc cơ sở y tế nào.');
  }

  const tenantMap = new Map<string, {id: string; code: string; name: string; status: string; roles: Role[]}>();
  for (const m of activeMemberships) {
    const existing = tenantMap.get(m.tenant.id);
    const role = m.role as Role;
    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role);
    } else {
      tenantMap.set(m.tenant.id, {
        id: m.tenant.id,
        code: m.tenant.code,
        name: TENANT_DISPLAY[m.tenant.code] ?? m.tenant.name,
        status: m.tenant.status,
        roles: [role],
      });
    }
  }

  const availableTenants = Array.from(tenantMap.values()).map((entry) => ({
    id: entry.id,
    code: entry.code,
    name: entry.name,
    roles: entry.roles,
  }));

  let selected = tenantMap.values().next().value!;
  if (options.tenantCode) {
    const matched = Array.from(tenantMap.values()).find(
      (entry) => entry.code === options.tenantCode || entry.id === options.tenantCode,
    );
    if (!matched) {
      throw new WorkspaceAccessError(404, 'tenant_not_found', 'Không tìm thấy cơ sở y tế thuộc quyền truy cập.');
    }
    selected = matched;
  }

  if (options.role === 'staff') {
    const hasStaffRole = selected.roles.some((r) => STAFF_ROLES.has(r));
    if (!hasStaffRole) {
      throw new WorkspaceAccessError(403, 'staff_role_required', 'Tài khoản không có quyền truy cập cổng nhân viên y tế.');
    }
  }

  let activePatient: ResolvedWorkspaceContext['activePatient'] = null;
  const delegations: Array<{
    tenantId: string;
    patientSubject: string;
    scope?: string;
    expiresAt: string;
    revoked: boolean;
  }> = [];

  if (options.role === 'patient') {
    const ownPatient = await prisma.patient.findFirst({
      where: {
        tenantId: selected.id,
        status: 'ACTIVE',
        OR: [{userId: user.id}, {profileRef: user.subject}],
      },
      include: {profile: true},
    });

    if (ownPatient) {
      activePatient = formatPatientMeta(ownPatient);
    } else if (selected.roles.includes('GUARDIAN')) {
      const delegation = await prisma.guardianDelegation.findFirst({
        where: {
          tenantId: selected.id,
          guardianUserId: user.id,
          revokedAt: null,
          OR: [{expiresAt: null}, {expiresAt: {gt: new Date()}}],
        },
        include: {patient: {include: {profile: true, user: {select: {subject: true}}}}},
      });
      if (delegation?.patient) {
        activePatient = formatPatientMeta(delegation.patient);
        if (delegation.patient.user?.subject) {
          delegations.push({
            tenantId: selected.id,
            patientSubject: delegation.patient.user.subject,
            scope: delegation.scope,
            expiresAt: (delegation.expiresAt ?? new Date(Date.now() + 86_400_000)).toISOString(),
            revoked: false,
          });
        }
      }
    }

    if (!activePatient) {
      throw new WorkspaceAccessError(403, 'patient_mapping_required', 'Chưa có hồ sơ bệnh nhân gắn với tài khoản này.');
    }
  } else if (options.requestedPatientId) {
    const targetPatient = await prisma.patient.findFirst({
      where: {id: options.requestedPatientId, tenantId: selected.id, status: 'ACTIVE'},
      include: {profile: true},
    });
    if (targetPatient) {
      activePatient = formatPatientMeta(targetPatient);
    }
  }

  const principal: AuthenticatedPrincipal = {
    subject: user.subject,
    issuer: 'https://keycloak.synthetic',
    audience: 'medicloud-api',
    roles: selected.roles,
    tenantIds: [selected.id],
    ...(delegations.length > 0 ? {delegations} : {}),
    active: true,
  };

  return {
    tenant: {id: selected.id, code: selected.code, name: selected.name, status: selected.status},
    availableTenants,
    actorUser: {id: user.id, subject: user.subject},
    principal,
    activePatient,
  };
}

export async function queryWorkspaceSlice(
  prisma: PrismaClient,
  context: WorkspaceQueryContext,
  resource: WorkspaceSliceName,
  params: SliceQueryParams = {},
) {
  const resolved = await resolveWorkspaceContext(prisma, {
    ...context,
    requestedPatientId: params.patientId ?? context.requestedPatientId,
  });
  const tenantId = resolved.tenant.id;
  const limit = clampLimit(params.limit, 25);
  const {from, to} = parseBoundedDates(params.from, params.to);

  return prisma.$transaction(async (tx) => {
    await setTransactionTenantContext(tx, tenantId);

    switch (resource) {
      case 'overview': {
        const practitioners = await tx.practitioner.findMany({
          where: {tenantId},
          include: {user: {select: {subject: true, status: true}}, department: {select: {name: true}}},
          orderBy: {id: 'asc'},
        });
        const formattedDocs = practitioners.map(formatPractitionerMeta);
        const specialties = Array.from(new Set(formattedDocs.map((d) => d.specialty)));

        if (context.role === 'patient') {
          const patientId = resolved.activePatient!.id;
          const [upcomingCount, completedCount, latestObsCount, recentAppointments, nextSlots] = await Promise.all([
            tx.appointment.count({
              where: {tenantId, patientId, status: {in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]}},
            }),
            tx.encounter.count({where: {tenantId, patientId, status: EncounterStatus.COMPLETED}}),
            tx.observation.count({where: {tenantId, isLatest: true, encounter: {patientId}}}),
            tx.appointment.findMany({
              where: {tenantId, patientId},
              include: {
                slot: {include: {schedule: {include: {practitioner: {include: {user: true, department: true}}}}}},
                queueTicket: true,
              },
              orderBy: {slot: {startsAt: 'desc'}},
              take: 5,
            }),
            tx.appointmentSlot.findMany({
              where: {tenantId, startsAt: {gte: new Date()}, bookedCount: {lt: 10}},
              include: {schedule: {include: {practitioner: {include: {user: true, department: true}}}}},
              orderBy: {startsAt: 'asc'},
              take: 16,
            }),
          ]);

          return {
            resource: 'overview',
            tenant: resolved.tenant,
            availableTenants: resolved.availableTenants,
            activePatient: resolved.activePatient,
            practitioners: formattedDocs,
            specialties,
            slots: nextSlots
              .filter((s) => s.bookedCount < s.capacity)
              .map((s) => {
                const doc = formatPractitionerMeta(s.schedule.practitioner);
                return {
                  id: s.id,
                  startsAt: s.startsAt.toISOString(),
                  endsAt: s.endsAt.toISOString(),
                  capacity: s.capacity,
                  bookedCount: s.bookedCount,
                  remaining: Math.max(0, s.capacity - s.bookedCount),
                  practitionerId: doc.id,
                  practitionerName: doc.displayName,
                  room: doc.room,
                  specialty: doc.specialty,
                };
              }),
            recentAppointments: recentAppointments.map((a) => {
              const doc = formatPractitionerMeta(a.slot.schedule.practitioner);
              return {
                id: a.id,
                referenceCode: `LH-${a.id.slice(-6).toUpperCase()}`,
                startsAt: a.slot.startsAt.toISOString(),
                endsAt: a.slot.endsAt.toISOString(),
                status: a.status,
                checkInStatus: a.checkInStatus,
                visitType: a.visitType,
                visitReason: a.visitReason,
                practitionerId: doc.id,
                practitionerName: doc.displayName,
                room: doc.room,
                specialty: doc.specialty,
                queueTicketNumber: a.queueTicket?.ticketNumber ?? null,
                queueTicketStatus: a.queueTicket?.status ?? null,
              };
            }),
            metrics: {
              patientUpcomingAppointments: upcomingCount,
              patientCompletedEncountersCount: completedCount,
              patientObservationsCount: latestObsCount,
              availableSlotsCount: nextSlots.filter((s) => s.bookedCount < s.capacity).length,
            },
          };
        }

        // Staff overview — scoped counts only
        const [
          confirmedAppointments,
          checkedInAppointments,
          waitingQueueCount,
          inServiceQueueCount,
          openEncounters,
          completedEncounters,
          activePatients,
        ] = await Promise.all([
          tx.appointment.count({where: {tenantId, status: {in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]}}}),
          tx.appointment.count({where: {tenantId, checkInStatus: 'CHECKED_IN'}}),
          tx.queueTicket.count({where: {tenantId, status: {in: [QueueTicketStatus.CHECKED_IN, QueueTicketStatus.WAITING, QueueTicketStatus.CALLED]}}}),
          tx.queueTicket.count({where: {tenantId, status: QueueTicketStatus.IN_SERVICE}}),
          tx.encounter.count({where: {tenantId, status: {in: [EncounterStatus.OPEN, EncounterStatus.IN_PROGRESS]}}}),
          tx.encounter.count({where: {tenantId, status: {in: [EncounterStatus.COMPLETED, EncounterStatus.AMENDED]}}}),
          tx.patient.findMany({
            where: {tenantId, status: 'ACTIVE'},
            include: {profile: true},
            orderBy: {profileRef: 'asc'},
            take: 25,
          }),
        ]);

        const ownPractitioner =
          formattedDocs.find((d) =>
            practitioners.some((raw) => raw.id === d.id && raw.user?.subject === resolved.actorUser.subject),
          ) ?? formattedDocs[0] ?? null;

        return {
          resource: 'overview',
          tenant: resolved.tenant,
          availableTenants: resolved.availableTenants,
          activePractitioner: ownPractitioner,
          practitioners: formattedDocs,
          specialties,
          patients: activePatients.map(formatPatientMeta),
          metrics: {
            confirmedAppointments,
            checkedInAppointments,
            waitingQueueCount,
            inServiceQueueCount,
            openEncounters,
            completedEncounters,
          },
        };
      }

      case 'appointments': {
        const where: Prisma.AppointmentWhereInput = {tenantId};
        if (context.role === 'patient') {
          where.patientId = resolved.activePatient!.id;
        } else if (params.patientId) {
          where.patientId = params.patientId;
        }
        if (params.status && params.status !== 'ALL') {
          where.status = params.status as AppointmentStatus;
        }
        if (from || to) {
          where.slot = {startsAt: {...(from ? {gte: from} : {}), ...(to ? {lte: to} : {})}};
        }
        if (params.q?.trim()) {
          const term = params.q.trim();
          where.OR = [
            {visitReason: {contains: term, mode: 'insensitive'}},
            {patient: {profile: {displayName: {contains: term, mode: 'insensitive'}}}},
            {slot: {schedule: {practitioner: {displayName: {contains: term, mode: 'insensitive'}}}}},
          ];
        }

        const dir = params.dir === 'asc' ? 'asc' : 'desc';
        const orderBy: Prisma.AppointmentOrderByWithRelationInput =
          params.sort === 'status' ? {status: dir} : {slot: {startsAt: dir}};

        const rows = await tx.appointment.findMany({
          where,
          include: {
            patient: {include: {profile: true}},
            slot: {include: {schedule: {include: {practitioner: {include: {user: true, department: true}}}}}},
            queueTicket: true,
            encounters: {
              include: {observations: {where: {isLatest: true}, orderBy: {measuredAt: 'desc'}}},
              orderBy: {createdAt: 'desc'},
            },
          },
          orderBy: [orderBy, {id: 'asc'}],
          ...(params.cursor ? {cursor: {id: params.cursor}, skip: 1} : {}),
          take: limit + 1,
        });

        const hasMore = rows.length > limit;
        const pageRows = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;

        return {
          resource: 'appointments',
          tenant: resolved.tenant,
          nextCursor,
          data: pageRows.map((a) => {
            const pat = formatPatientMeta(a.patient);
            const doc = formatPractitionerMeta(a.slot.schedule.practitioner);
            return {
              id: a.id,
              referenceCode: `LH-${a.id.slice(-6).toUpperCase()}`,
              patientId: pat.id,
              patientName: pat.displayName,
              patientCode: pat.code,
              slotId: a.slotId,
              startsAt: a.slot.startsAt.toISOString(),
              endsAt: a.slot.endsAt.toISOString(),
              status: a.status,
              checkInStatus: a.checkInStatus,
              checkedInAt: a.checkedInAt?.toISOString() ?? null,
              visitType: a.visitType ?? null,
              visitReason: a.visitReason ?? null,
              intakeNote: a.intakeNote ?? null,
              cancelReason: a.cancelReason ?? null,
              cancelledAt: a.cancelledAt?.toISOString() ?? null,
              rescheduledFromId: a.rescheduledFromId ?? null,
              practitionerId: doc.id,
              practitionerName: doc.displayName,
              room: doc.room,
              specialty: doc.specialty,
              queueTicket: a.queueTicket
                ? {
                    id: a.queueTicket.id,
                    ticketNumber: a.queueTicket.ticketNumber,
                    status: a.queueTicket.status,
                  }
                : null,
              createdAt: a.createdAt.toISOString(),
              encounters: a.encounters.map((e) => ({
                id: e.id,
                referenceCode: `HS-${e.id.slice(-6).toUpperCase()}`,
                status: e.status,
                version: e.version,
                createdAt: e.createdAt.toISOString(),
                completedAt: e.completedAt?.toISOString() ?? null,
                observationsCount: e.observations.length,
              })),
            };
          }),
        };
      }

      case 'queue': {
        if (context.role !== 'staff') {
          throw new WorkspaceAccessError(403, 'queue_staff_only', 'Hàng đợi khám chỉ dành cho nhân viên y tế.');
        }
        const where: Prisma.QueueTicketWhereInput = {tenantId};
        if (params.status && params.status !== 'ALL') {
          where.status = params.status as QueueTicketStatus;
        }
        const tickets = await tx.queueTicket.findMany({
          where,
          include: {
            patient: {include: {profile: true}},
            appointment: {
              include: {
                slot: {include: {schedule: {include: {practitioner: {include: {user: true, department: true}}}}}},
                encounters: {
                  include: {observations: {orderBy: [{measuredAt: 'desc'}, {version: 'desc'}]}},
                  orderBy: {createdAt: 'desc'},
                },
              },
            },
          },
          orderBy: [{createdAt: 'asc'}, {id: 'asc'}],
          ...(params.cursor ? {cursor: {id: params.cursor}, skip: 1} : {}),
          take: limit + 1,
        });
        const hasMore = tickets.length > limit;
        const page = hasMore ? tickets.slice(0, limit) : tickets;
        return {
          resource: 'queue',
          tenant: resolved.tenant,
          nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
          data: page.map((t) => {
            const pat = formatPatientMeta(t.patient);
            const doc = formatPractitionerMeta(t.appointment.slot.schedule.practitioner);
            const activeEnc = t.appointment.encounters[0] ?? null;
            return {
              id: t.id,
              ticketNumber: t.ticketNumber,
              status: t.status,
              appointmentId: t.appointmentId,
              startsAt: t.appointment.slot.startsAt.toISOString(),
              visitType: t.appointment.visitType ?? null,
              visitReason: t.appointment.visitReason ?? null,
              intakeNote: t.appointment.intakeNote ?? null,
              patientId: pat.id,
              patientName: pat.displayName,
              patientCode: pat.code,
              bloodType: pat.bloodType,
              allergy: pat.allergy,
              practitionerId: doc.id,
              practitionerName: doc.displayName,
              room: doc.room,
              calledAt: t.calledAt?.toISOString() ?? null,
              startedAt: t.startedAt?.toISOString() ?? null,
              completedAt: t.completedAt?.toISOString() ?? null,
              encounter: activeEnc
                ? {
                    id: activeEnc.id,
                    referenceCode: `HS-${activeEnc.id.slice(-6).toUpperCase()}`,
                    status: activeEnc.status,
                    version: activeEnc.version,
                    observations: activeEnc.observations.map((o) => {
                      const lbl = formatObsLabel(o.code, o.unit);
                      return {
                        id: o.id,
                        code: o.code,
                        label: lbl.label,
                        value: Number(o.value),
                        unit: lbl.unit,
                        status: o.status,
                        version: o.version,
                        isLatest: o.isLatest,
                        supersedesId: o.supersedesId,
                        amendReason: o.amendReason,
                        measuredAt: o.measuredAt.toISOString(),
                      };
                    }),
                  }
                : null,
            };
          }),
        };
      }

      case 'records': {
        const where: Prisma.EncounterWhereInput = {tenantId};
        if (context.role === 'patient') {
          where.patientId = resolved.activePatient!.id;
        } else if (params.patientId) {
          where.patientId = params.patientId;
        }
        if (params.status && params.status !== 'ALL') {
          where.status = params.status as EncounterStatus;
        }
        if (from || to) {
          where.createdAt = {...(from ? {gte: from} : {}), ...(to ? {lte: to} : {})};
        }

        const encounters = await tx.encounter.findMany({
          where,
          include: {
            patient: {include: {profile: true}},
            practitioner: {include: {user: true, department: true}},
            appointment: {include: {slot: true}},
            observations: {orderBy: [{measuredAt: 'desc'}, {version: 'desc'}]},
          },
          orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
          ...(params.cursor ? {cursor: {id: params.cursor}, skip: 1} : {}),
          take: limit + 1,
        });

        const hasMore = encounters.length > limit;
        const page = hasMore ? encounters.slice(0, limit) : encounters;
        return {
          resource: 'records',
          tenant: resolved.tenant,
          nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
          data: page.map((e) => {
            const pat = formatPatientMeta(e.patient);
            const doc = formatPractitionerMeta(e.practitioner);
            return {
              id: e.id,
              referenceCode: `HS-${e.id.slice(-6).toUpperCase()}`,
              appointmentId: e.appointmentId,
              patientId: pat.id,
              patientName: pat.displayName,
              patientCode: pat.code,
              practitionerId: doc.id,
              practitionerName: doc.displayName,
              specialty: doc.specialty,
              status: e.status,
              version: e.version,
              startsAt: e.appointment.slot.startsAt.toISOString(),
              createdAt: e.createdAt.toISOString(),
              completedAt: e.completedAt?.toISOString() ?? null,
              cancelledAt: e.cancelledAt?.toISOString() ?? null,
              cancelReason: e.cancelReason ?? null,
              observations: e.observations.map((o) => {
                const lbl = formatObsLabel(o.code, o.unit);
                return {
                  id: o.id,
                  code: o.code,
                  label: lbl.label,
                  value: Number(o.value),
                  unit: lbl.unit,
                  status: o.status,
                  version: o.version,
                  isLatest: o.isLatest,
                  supersedesId: o.supersedesId,
                  amendReason: o.amendReason,
                  measuredAt: o.measuredAt.toISOString(),
                };
              }),
            };
          }),
        };
      }

      case 'vitals': {
        const where: Prisma.ObservationWhereInput = {tenantId, isLatest: true};
        if (context.role === 'patient') {
          where.encounter = {patientId: resolved.activePatient!.id};
        } else if (params.patientId) {
          where.encounter = {patientId: params.patientId};
        }
        if (from || to) {
          where.measuredAt = {...(from ? {gte: from} : {}), ...(to ? {lte: to} : {})};
        }
        const rows = await tx.observation.findMany({
          where,
          include: {
            encounter: {
              include: {
                patient: {include: {profile: true}},
                practitioner: {include: {user: true, department: true}},
              },
            },
          },
          orderBy: [{measuredAt: 'desc'}, {id: 'asc'}],
          ...(params.cursor ? {cursor: {id: params.cursor}, skip: 1} : {}),
          take: limit + 1,
        });
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        return {
          resource: 'vitals',
          tenant: resolved.tenant,
          nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
          data: page
            .slice()
            .reverse()
            .map((o) => {
              const pat = formatPatientMeta(o.encounter.patient);
              const doc = formatPractitionerMeta(o.encounter.practitioner);
              const lbl = formatObsLabel(o.code, o.unit);
              return {
                id: o.id,
                encounterId: o.encounterId,
                encounterCode: `HS-${o.encounterId.slice(-6).toUpperCase()}`,
                patientId: pat.id,
                patientName: pat.displayName,
                practitionerName: doc.displayName,
                code: o.code,
                label: lbl.label,
                value: Number(o.value),
                unit: lbl.unit,
                status: o.status,
                version: o.version,
                measuredAt: o.measuredAt.toISOString(),
              };
            }),
        };
      }

      case 'audit': {
        let where: Prisma.AuditEventWhereInput = {tenantId};
        if (context.role === 'patient') {
          const patientId = resolved.activePatient!.id;
          const [ownAppts, ownEncs] = await Promise.all([
            tx.appointment.findMany({where: {tenantId, patientId}, select: {id: true}, take: 50}),
            tx.encounter.findMany({where: {tenantId, patientId}, select: {id: true}, take: 50}),
          ]);
          const ownRefs = [
            ...ownAppts.map((a) => `synthetic-appointment-${a.id}`),
            ...ownEncs.map((e) => `synthetic-encounter-${e.id}`),
          ];
          where = {
            tenantId,
            OR: [
              {actorId: resolved.actorUser.id},
              ...(ownRefs.length > 0 ? [{resourceRef: {in: ownRefs}}] : []),
            ],
          };
        }

        if (from || to) {
          where.occurredAt = {...(from ? {gte: from} : {}), ...(to ? {lte: to} : {})};
        }

        const events = await tx.auditEvent.findMany({
          where,
          orderBy: [{occurredAt: 'desc'}, {id: 'asc'}],
          ...(params.cursor ? {cursor: {id: params.cursor}, skip: 1} : {}),
          take: Math.min(limit, 30) + 1,
          select: {id: true, action: true, purpose: true, occurredAt: true, correlationId: true, resourceRef: true},
        });
        const pageLimit = Math.min(limit, 30);
        const hasMore = events.length > pageLimit;
        const page = hasMore ? events.slice(0, pageLimit) : events;

        return {
          resource: 'audit',
          tenant: resolved.tenant,
          nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
          data: page.map((ev) => ({
            id: ev.id,
            action: ev.action,
            actionLabel: AUDIT_ACTION_DISPLAY[ev.action] ?? ev.action,
            purpose:
              ev.purpose === 'treatment'
                ? 'Điều trị lâm sàng'
                : ev.purpose === 'operations' || ev.purpose === 'care_coordination'
                  ? 'Điều phối tiếp nhận'
                  : 'Hệ thống & Kiểm toán',
            occurredAt: ev.occurredAt.toISOString(),
            correlationId: ev.correlationId,
          })),
        };
      }
    }
  });
}

export async function getUnifiedDashboardView(prisma: PrismaClient, options: WorkspaceQueryContext) {
  const [overview, appts, recs, vitals, audit] = await Promise.all([
    queryWorkspaceSlice(prisma, options, 'overview', {limit: 20}),
    queryWorkspaceSlice(prisma, options, 'appointments', {limit: 30}),
    queryWorkspaceSlice(prisma, options, 'records', {limit: 20}),
    queryWorkspaceSlice(prisma, options, 'vitals', {limit: 30}),
    queryWorkspaceSlice(prisma, options, 'audit', {limit: 15}),
  ]);
  const queue =
    options.role === 'staff' ? await queryWorkspaceSlice(prisma, options, 'queue', {limit: 30}) : null;

  const ov = overview as Record<string, unknown>;
  const practitioners = (ov.practitioners as Array<Record<string, unknown>>) ?? [];
  const availableSlots =
    (ov.slots as Array<Record<string, unknown>>) ??
    (await prisma.appointmentSlot.findMany({
      where: {tenantId: overview.tenant.id, startsAt: {gte: new Date()}},
      include: {schedule: {include: {practitioner: {include: {user: true, department: true}}}}},
      orderBy: {startsAt: 'asc'},
      take: 32,
    })).map((s) => {
      const doc = formatPractitionerMeta(s.schedule.practitioner);
      return {
        id: s.id,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        capacity: s.capacity,
        bookedCount: s.bookedCount,
        remaining: Math.max(0, s.capacity - s.bookedCount),
        practitionerId: doc.id,
        practitionerName: doc.displayName,
        room: doc.room,
        specialty: doc.specialty,
      };
    });

  return {
    fetchedAt: new Date().toISOString(),
    role: options.role,
    tenant: overview.tenant,
    availableTenants: ov.availableTenants ?? [],
    activePatient: ov.activePatient ?? null,
    activePractitioner: ov.activePractitioner ?? null,
    patients: ov.patients ?? (ov.activePatient ? [ov.activePatient] : []),
    practitioners,
    specialties: ov.specialties ?? [],
    slots: availableSlots,
    appointments: appts.data,
    queueTickets: queue?.data ?? [],
    encounters: recs.data,
    observations: vitals.data,
    auditEvents: audit.data,
    metrics: ov.metrics ?? {},
  };
}
