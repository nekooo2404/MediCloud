import {randomUUID} from 'node:crypto';
import type {MembershipRole, PrismaClient} from '@prisma/client';
import {setTransactionTenantContext} from '../../db/tenant-rls.js';
import {publishDoctorSlots} from '../../scheduling/service.js';
import type {AuthenticatedPrincipal} from '../../security/types.js';
import {hashPassword} from '../auth/service.js';

export class DomainModuleError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAFF_ROLES: ReadonlySet<MembershipRole> = new Set(['PHYSICIAN', 'RECEPTIONIST', 'NURSE', 'AUDITOR']);

async function resolveActorContext(prisma: PrismaClient, principal: AuthenticatedPrincipal, requestedTenantCode?: string) {
  const user = await prisma.user.findUnique({
    where: {subject: principal.subject},
    include: {
      memberships: {
        where: {revokedAt: null},
        include: {tenant: true},
      },
      patients: {
        where: {status: 'ACTIVE'},
        include: {profile: true},
      },
    },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new DomainModuleError(403, 'user_inactive', 'Tài khoản không hoạt động hoặc chưa tồn tại.');
  }
  const activeMemberships = user.memberships.filter((m) => m.tenant.status === 'ACTIVE');
  const membership = requestedTenantCode
    ? activeMemberships.find((m) => m.tenant.code === requestedTenantCode || m.tenantId === requestedTenantCode)
    : activeMemberships[0];
  if (!membership) {
    throw new DomainModuleError(403, 'tenant_membership_required', 'Tài khoản chưa có quyền truy cập cơ sở y tế này.');
  }
  return {user, membership, tenantId: membership.tenantId, roles: activeMemberships.filter((m) => m.tenantId === membership.tenantId).map((m) => m.role)};
}

export async function getPatientProfileView(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  requestedTenantCode?: string,
) {
  const ctx = await resolveActorContext(prisma, principal, requestedTenantCode);
  return prisma.$transaction(async (tx) => {
    await setTransactionTenantContext(tx, ctx.tenantId);
    const patient = await tx.patient.findFirst({
      where: {tenantId: ctx.tenantId, userId: ctx.user.id, status: 'ACTIVE'},
      include: {
        profile: true,
        guardianDelegations: {
          where: {revokedAt: null},
          include: {guardianUser: {select: {id: true, email: true, displayName: true}}},
          orderBy: {createdAt: 'desc'},
        },
      },
    });
    if (!patient) {
      throw new DomainModuleError(404, 'patient_profile_not_found', 'Không tìm thấy hồ sơ bệnh nhân cho tài khoản hiện tại.');
    }
    return {
      user: {
        email: ctx.user.email,
        emailVerified: Boolean(ctx.user.emailVerifiedAt),
        displayName: ctx.user.displayName ?? patient.profile?.displayName ?? '',
      },
      profile: {
        patientId: patient.id,
        medicalRecordCode: patient.profile?.medicalRecordCode ?? patient.profileRef,
        displayName: patient.profile?.displayName ?? ctx.user.displayName ?? '',
        bloodType: patient.profile?.bloodType ?? '',
        allergies: patient.profile?.allergies ?? [],
        careTeamNotes: patient.profile?.careTeamNotes ?? '',
      },
      guardians: patient.guardianDelegations.map((g) => ({
        id: g.id,
        guardianEmail: g.guardianUser.email ?? '',
        guardianName: g.guardianUser.displayName ?? g.guardianUser.email ?? 'Người thân',
        scope: g.scope,
        createdAt: g.createdAt.toISOString(),
      })),
    };
  });
}

export async function updatePatientProfileView(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  input: {
    displayName?: string;
    bloodType?: string;
    allergies?: string[];
    careTeamNotes?: string;
  },
  requestedTenantCode?: string,
) {
  const ctx = await resolveActorContext(prisma, principal, requestedTenantCode);
  const displayName = input.displayName?.trim();
  if (displayName !== undefined && (displayName.length < 2 || displayName.length > 160)) {
    throw new DomainModuleError(400, 'invalid_display_name', 'Họ và tên phải có từ 2 đến 160 ký tự.');
  }
  const bloodType = input.bloodType?.trim();
  if (bloodType !== undefined && bloodType.length > 16) {
    throw new DomainModuleError(400, 'invalid_blood_type', 'Nhóm máu không hợp lệ.');
  }
  const allergies = Array.isArray(input.allergies)
    ? input.allergies.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
    : undefined;
  const careTeamNotes = input.careTeamNotes?.trim().slice(0, 500);

  return prisma.$transaction(async (tx) => {
    await setTransactionTenantContext(tx, ctx.tenantId);
    const patient = await tx.patient.findFirst({
      where: {tenantId: ctx.tenantId, userId: ctx.user.id, status: 'ACTIVE'},
      include: {profile: true},
    });
    if (!patient) {
      throw new DomainModuleError(404, 'patient_profile_not_found', 'Không tìm thấy hồ sơ bệnh nhân.');
    }
    if (displayName) {
      await tx.user.update({
        where: {id: ctx.user.id},
        data: {displayName},
      });
    }
    const updated = await tx.patientProfile.upsert({
      where: {tenantId_patientId: {tenantId: ctx.tenantId, patientId: patient.id}},
      update: {
        ...(displayName !== undefined ? {displayName} : {}),
        ...(bloodType !== undefined ? {bloodType: bloodType || null} : {}),
        ...(allergies !== undefined ? {allergies} : {}),
        ...(careTeamNotes !== undefined ? {careTeamNotes: careTeamNotes || null} : {}),
      },
      create: {
        tenantId: ctx.tenantId,
        patientId: patient.id,
        displayName: displayName ?? ctx.user.displayName ?? 'Bệnh nhân',
        medicalRecordCode: `MC-${Date.now().toString(36).toUpperCase()}`,
        bloodType: bloodType || null,
        allergies: allergies ?? [],
        careTeamNotes: careTeamNotes || null,
      },
    });
    return {
      patientId: patient.id,
      medicalRecordCode: updated.medicalRecordCode,
      displayName: updated.displayName,
      bloodType: updated.bloodType ?? '',
      allergies: updated.allergies,
      careTeamNotes: updated.careTeamNotes ?? '',
    };
  });
}

export async function addGuardianDelegation(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  input: {guardianEmail: string; relationship?: string; scope?: string},
  requestedTenantCode?: string,
) {
  const ctx = await resolveActorContext(prisma, principal, requestedTenantCode);
  const email = input.guardianEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new DomainModuleError(400, 'invalid_guardian_email', 'Email người thân không hợp lệ.');
  }
  if (email === ctx.user.email) {
    throw new DomainModuleError(400, 'self_delegation_invalid', 'Không thể tự ủy quyền cho chính tài khoản của bạn.');
  }
  const guardianUser = await prisma.user.findUnique({
    where: {email},
    select: {id: true, email: true, displayName: true, status: true},
  });
  if (!guardianUser || guardianUser.status !== 'ACTIVE') {
    throw new DomainModuleError(404, 'guardian_account_not_found', 'Không tìm thấy tài khoản MediCloud ứng với email này.');
  }
  return prisma.$transaction(async (tx) => {
    await setTransactionTenantContext(tx, ctx.tenantId);
    const patient = await tx.patient.findFirst({
      where: {tenantId: ctx.tenantId, userId: ctx.user.id, status: 'ACTIVE'},
      select: {id: true},
    });
    if (!patient) {
      throw new DomainModuleError(404, 'patient_profile_not_found', 'Không tìm thấy hồ sơ bệnh nhân.');
    }
    const created = await tx.guardianDelegation.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: patient.id,
        guardianUserId: guardianUser.id,
        scope: (input.scope?.trim() || 'FULL_PORTAL').slice(0, 64),
      },
    });
    return {
      id: created.id,
      guardianEmail: guardianUser.email ?? email,
      guardianName: guardianUser.displayName ?? email,
      scope: created.scope,
      createdAt: created.createdAt.toISOString(),
    };
  });
}

export async function revokeGuardianDelegation(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  delegationId: string,
  requestedTenantCode?: string,
) {
  const ctx = await resolveActorContext(prisma, principal, requestedTenantCode);
  return prisma.$transaction(async (tx) => {
    await setTransactionTenantContext(tx, ctx.tenantId);
    const patient = await tx.patient.findFirst({
      where: {tenantId: ctx.tenantId, userId: ctx.user.id, status: 'ACTIVE'},
      select: {id: true},
    });
    if (!patient) {
      throw new DomainModuleError(404, 'patient_profile_not_found', 'Không tìm thấy hồ sơ bệnh nhân.');
    }
    const result = await tx.guardianDelegation.updateMany({
      where: {id: delegationId, tenantId: ctx.tenantId, patientId: patient.id, revokedAt: null},
      data: {revokedAt: new Date()},
    });
    if (result.count === 0) {
      throw new DomainModuleError(404, 'delegation_not_found', 'Không tìm thấy ủy quyền cần thu hồi.');
    }
    return {revoked: true, id: delegationId};
  });
}

function assertStaffAccess(roles: readonly MembershipRole[]) {
  if (!roles.some((r) => STAFF_ROLES.has(r))) {
    throw new DomainModuleError(403, 'staff_role_required', 'Chỉ nhân viên y tế được cấp quyền mới thực hiện được thao tác quản trị.');
  }
}

export async function getAdminOverview(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  requestedTenantCode?: string,
) {
  const ctx = await resolveActorContext(prisma, principal, requestedTenantCode);
  assertStaffAccess(ctx.roles);
  return prisma.$transaction(async (tx) => {
    await setTransactionTenantContext(tx, ctx.tenantId);
    const [organizations, departments, practitioners, memberships] = await Promise.all([
      tx.organization.findMany({where: {tenantId: ctx.tenantId}, orderBy: {name: 'asc'}}),
      tx.department.findMany({where: {tenantId: ctx.tenantId}, orderBy: {name: 'asc'}}),
      tx.practitioner.findMany({
        where: {tenantId: ctx.tenantId},
        include: {department: true, schedules: {take: 1}},
        orderBy: {displayName: 'asc'},
      }),
      tx.membership.findMany({
        where: {tenantId: ctx.tenantId, revokedAt: null, role: {in: ['PHYSICIAN', 'RECEPTIONIST', 'NURSE', 'AUDITOR']}},
        include: {user: {select: {id: true, email: true, displayName: true, status: true}}},
        orderBy: {role: 'asc'},
      }),
    ]);

    return {
      tenantId: ctx.tenantId,
      organizations,
      departments,
      practitioners: practitioners.map((p) => ({
        id: p.id,
        displayName: p.displayName ?? p.specialty,
        specialty: p.specialty,
        roomLabel: p.roomLabel ?? '',
        degreeTitle: p.degreeTitle ?? '',
        departmentName: p.department?.name ?? '',
        scheduleId: p.schedules[0]?.id ?? null,
      })),
      staffMembers: memberships.map((m) => ({
        membershipId: m.id,
        userId: m.userId,
        email: m.user.email ?? '',
        displayName: m.user.displayName ?? m.user.email ?? 'Nhân viên',
        role: m.role,
        status: m.user.status,
      })),
    };
  });
}

export async function createDepartmentForTenant(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  input: {organizationName?: string; departmentName: string; departmentCode?: string},
  requestedTenantCode?: string,
) {
  const ctx = await resolveActorContext(prisma, principal, requestedTenantCode);
  assertStaffAccess(ctx.roles);
  const departmentName = input.departmentName.trim();
  if (departmentName.length < 2) {
    throw new DomainModuleError(400, 'invalid_department_name', 'Tên khoa/phòng phải có ít nhất 2 ký tự.');
  }
  const departmentCode = (input.departmentCode?.trim() || `dept-${randomUUID().slice(0, 6)}`).toLowerCase();

  return prisma.$transaction(async (tx) => {
    await setTransactionTenantContext(tx, ctx.tenantId);
    let org = await tx.organization.findFirst({where: {tenantId: ctx.tenantId}});
    if (!org) {
      org = await tx.organization.create({
        data: {
          tenantId: ctx.tenantId,
          code: `org-${randomUUID().slice(0, 6)}`,
          name: input.organizationName?.trim() || ctx.membership.tenant.name,
        },
      });
    }
    const department = await tx.department.create({
      data: {
        tenantId: ctx.tenantId,
        organizationId: org.id,
        code: departmentCode,
        name: departmentName,
      },
    });
    return {organization: org, department};
  });
}

export async function provisionStaffAccount(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  input: {
    fullName: string;
    email: string;
    password: string;
    role: 'PHYSICIAN' | 'RECEPTIONIST' | 'NURSE' | 'AUDITOR';
    departmentId?: string;
    specialty?: string;
    roomLabel?: string;
    degreeTitle?: string;
  },
  requestedTenantCode?: string,
) {
  const ctx = await resolveActorContext(prisma, principal, requestedTenantCode);
  assertStaffAccess(ctx.roles);
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 2 || !EMAIL_RE.test(email) || input.password.length < 12) {
    throw new DomainModuleError(400, 'invalid_staff_payload', 'Vui lòng nhập đầy đủ họ tên, email hợp lệ và mật khẩu tối thiểu 12 ký tự.');
  }
  if (!STAFF_ROLES.has(input.role)) {
    throw new DomainModuleError(400, 'invalid_staff_role', 'Vai trò nhân viên không hợp lệ.');
  }
  const existing = await prisma.user.findUnique({where: {email}, select: {id: true}});
  if (existing) {
    throw new DomainModuleError(409, 'email_already_exists', 'Email này đã được sử dụng trong hệ thống.');
  }

  return prisma.$transaction(async (tx) => {
    await setTransactionTenantContext(tx, ctx.tenantId);
    const user = await tx.user.create({
      data: {
        subject: `staff-${randomUUID()}`,
        email,
        passwordHash: hashPassword(input.password),
        displayName: fullName,
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
      },
    });
    await tx.membership.create({
      data: {
        tenantId: ctx.tenantId,
        userId: user.id,
        role: input.role,
      },
    });
    let practitionerId: string | undefined;
    if (input.role === 'PHYSICIAN') {
      const org = await tx.organization.findFirst({where: {tenantId: ctx.tenantId}});
      const practitioner = await tx.practitioner.create({
        data: {
          tenantId: ctx.tenantId,
          userId: user.id,
          organizationId: org?.id ?? null,
          departmentId: input.departmentId || null,
          specialty: input.specialty?.trim() || 'Nội tổng quát',
          displayName: fullName,
          roomLabel: input.roomLabel?.trim() || 'Phòng khám 101',
          degreeTitle: input.degreeTitle?.trim() || 'BS.',
        },
      });
      practitionerId = practitioner.id;
      const now = new Date();
      await tx.schedule.create({
        data: {
          tenantId: ctx.tenantId,
          practitionerId: practitioner.id,
          startsAt: now,
          endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
    return {
      userId: user.id,
      email,
      displayName: fullName,
      role: input.role,
      practitionerId,
    };
  });
}

export async function publishSlotsForPractitioner(
  prisma: PrismaClient,
  principal: AuthenticatedPrincipal,
  input: {
    practitionerId: string;
    date: string;
    startHour: number;
    endHour: number;
    capacity: number;
  },
  requestedTenantCode?: string,
) {
  const ctx = await resolveActorContext(prisma, principal, requestedTenantCode);
  assertStaffAccess(ctx.roles);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new DomainModuleError(400, 'invalid_date', 'Ngày mở lịch phải có định dạng YYYY-MM-DD.');
  }
  const startHour = Math.max(6, Math.min(20, Math.floor(input.startHour)));
  const endHour = Math.max(startHour + 1, Math.min(22, Math.floor(input.endHour)));
  const capacity = Math.max(1, Math.min(20, Math.floor(input.capacity)));

  const startPad = String(startHour).padStart(2, '0');
  const endPad = String(endHour).padStart(2, '0');
  const schedulingDeps = {
    prisma,
    resolvePatientSubject: async () => '',
    resolveMembership: async (_client: unknown, subject: string) => {
      const u = await prisma.user.findUnique({
        where: {subject},
        include: {memberships: {where: {revokedAt: null}}},
      });
      if (!u) return [];
      const byTenant = new Map<string, string[]>();
      for (const m of u.memberships) {
        const list = byTenant.get(m.tenantId) ?? [];
        list.push(m.role);
        byTenant.set(m.tenantId, list);
      }
      return Array.from(byTenant.entries()).map(([tenantId, roles]) => ({
        tenantId,
        roles,
        active: u.status === 'ACTIVE',
      }));
    },
    resolvePatientId: async () => undefined,
  };

  return publishDoctorSlots(
    schedulingDeps,
    {
      principal,
      correlationId: `admin-slots-${randomUUID().slice(0, 8)}`,
      requestedTenantId: ctx.tenantId,
    },
    {
      practitionerId: input.practitionerId,
      startsAt: `${input.date}T${startPad}:00:00+07:00`,
      endsAt: `${input.date}T${endPad}:00:00+07:00`,
      slotDurationMinutes: 60,
      capacity,
    },
  );
}
