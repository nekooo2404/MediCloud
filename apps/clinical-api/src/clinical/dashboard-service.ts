import {randomUUID} from 'node:crypto';
import type {PrismaClient} from '@prisma/client';
import {validateContractBody} from '../contracts/ajv-validator.js';
import {
  getUnifiedDashboardView,
  resolveWorkspaceContext,
  WorkspaceAccessError,
} from '../modules/read-models/workspace-queries.js';
import {
  amendObservation,
  cancelEncounter,
  type ClinicalDependencies,
  completeEncounter,
  createEncounter,
  createObservation,
} from './service.js';
import {
  cancelAppointment,
  checkInAppointment,
  createAppointment,
  markNoShowAppointment,
  publishDoctorSlots,
  rescheduleAppointment,
  SchedulingError,
  transitionQueueTicket,
} from '../scheduling/service.js';

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
      tenantCode?: string;
      patientId?: string;
      slotId: string;
      visitType?: VisitType;
      visitReason?: VisitReason;
      intakeNote?: string;
      idempotencyKey?: string;
    }
  | {
      action: 'cancel_appointment';
      tenantCode?: string;
      appointmentId: string;
      reason: string;
    }
  | {
      action: 'reschedule_appointment';
      tenantCode?: string;
      appointmentId: string;
      newSlotId: string;
      idempotencyKey?: string;
      reason?: string;
    }
  | {
      action: 'mark_no_show';
      tenantCode?: string;
      appointmentId: string;
      reason?: string;
    }
  | {
      action: 'check_in';
      tenantCode?: string;
      appointmentId: string;
      channel?: 'portal' | 'desk';
    }
  | {
      action: 'queue_transition';
      tenantCode?: string;
      ticketId: string;
      toStatus: 'WAITING' | 'CALLED' | 'IN_SERVICE' | 'DONE' | 'SKIPPED';
    }
  | {
      action: 'publish_schedule';
      tenantCode?: string;
      practitionerId: string;
      startsAt: string;
      endsAt: string;
      slotDurationMinutes?: number;
      capacity?: number;
    }
  | {
      action: 'create_encounter';
      tenantCode?: string;
      appointmentId: string;
      practitionerId?: string;
    }
  | {
      action: 'record_observation';
      tenantCode?: string;
      encounterId: string;
      code: string;
      value: number;
      unit: string;
      measuredAt?: string;
      expectedVersion?: number;
    }
  | {
      action: 'amend_observation';
      tenantCode?: string;
      encounterId: string;
      observationId: string;
      value: number;
      unit: string;
      measuredAt?: string;
      reason: string;
      expectedVersion: number;
    }
  | {
      action: 'complete_encounter';
      tenantCode?: string;
      encounterId: string;
      expectedVersion?: number;
    }
  | {
      action: 'cancel_encounter';
      tenantCode?: string;
      encounterId: string;
      reason: string;
      expectedVersion?: number;
    };

export class DashboardAccessError extends WorkspaceAccessError {}

function buildDomainDeps(prisma: PrismaClient): ClinicalDependencies {
  return {
    prisma,
    resolveMembership: async (client, subject) => {
      const user = await client.user.findUnique({where: {subject}, include: {memberships: true}});
      if (!user) return [];
      const active = user.status === 'ACTIVE';
      const byTenant = new Map<string, string[]>();
      for (const m of user.memberships) {
        if (m.revokedAt) continue;
        const list = byTenant.get(m.tenantId) ?? [];
        list.push(m.role);
        byTenant.set(m.tenantId, list);
      }
      return Array.from(byTenant.entries()).map(([tenantId, roles]) => ({tenantId, roles, active}));
    },
    resolvePatientId: async (client, tenantId, subject) => {
      const user = await client.user.findUnique({where: {subject}, select: {id: true}});
      const patient = await client.patient.findFirst({
        where: {
          tenantId,
          status: 'ACTIVE',
          OR: [...(user ? [{userId: user.id}] : []), {profileRef: subject}],
        },
        select: {id: true},
      });
      return patient?.id;
    },
    resolvePatientSubject: async (client, tenantId, patientId) => {
      const patient = await client.patient.findFirst({
        where: {id: patientId, tenantId},
        include: {user: {select: {subject: true}}},
      });
      if (!patient) throw new SchedulingError(404, 'patient_not_found', 'Không tìm thấy bệnh nhân.');
      return patient.user?.subject ?? patient.profileRef;
    },
  };
}

function rethrowAsDashboardError(error: unknown): never {
  if (error instanceof DashboardAccessError) throw error;
  if (error instanceof WorkspaceAccessError) {
    throw new DashboardAccessError(error.status, error.code, error.message);
  }
  if (error instanceof SchedulingError) {
    const mappedStatus = error.status === 500 ? 409 : error.status;
    throw new DashboardAccessError(mappedStatus, error.code, error.message);
  }
  throw error;
}

export async function getDashboardData(prisma: PrismaClient, options: DashboardQueryOptions) {
  try {
    return await getUnifiedDashboardView(prisma, options);
  } catch (error) {
    rethrowAsDashboardError(error);
  }
}

export async function executeDashboardMutation(
  prisma: PrismaClient,
  context: {
    role: 'patient' | 'staff';
    actorSubject: string;
    tenantCode?: string;
    correlationId: string;
  },
  rawInput: unknown,
) {
  try {
    const input = validateContractBody<DashboardMutationInput>('DashboardMutation', rawInput);
    const resolved = await resolveWorkspaceContext(prisma, {
      role: context.role,
      actorSubject: context.actorSubject,
      tenantCode: input.tenantCode ?? context.tenantCode,
    });
    const deps = buildDomainDeps(prisma);
    const tenantId = resolved.tenant.id;
    const serverChannel = context.role === 'staff' ? 'staff' : 'portal';

    switch (input.action) {
      case 'book_appointment': {
        const idempotencyKey = input.idempotencyKey?.trim() || `synthetic-bff-${randomUUID()}`;
        if (!input.slotId) {
          throw new DashboardAccessError(400, 'published_slot_required', 'Vui lòng chọn khung giờ khám đã được công bố.');
        }
        const appointment = await createAppointment(
          deps,
          {
            principal: resolved.principal,
            correlationId: context.correlationId,
            idempotencyHeader: idempotencyKey,
            serverChannel,
            requestedTenantId: tenantId,
          },
          {
            slotId: input.slotId,
            patientId: input.patientId ?? resolved.activePatient?.id,
            idempotencyKey,
            visitType: input.visitType,
            visitReason: input.visitReason,
            intakeNote: input.intakeNote,
          },
        );
        return {ok: true, action: 'book_appointment', appointmentId: appointment.id, correlationId: context.correlationId};
      }

      case 'cancel_appointment': {
        const appointment = await cancelAppointment(
          deps,
          {principal: resolved.principal, correlationId: context.correlationId, requestedTenantId: tenantId},
          input.appointmentId,
          input.reason,
        );
        return {ok: true, action: 'cancel_appointment', appointmentId: appointment.id, correlationId: context.correlationId};
      }

      case 'reschedule_appointment': {
        const idempotencyKey = input.idempotencyKey?.trim() || `synthetic-resched-${randomUUID()}`;
        const appointment = await rescheduleAppointment(
          deps,
          {
            principal: resolved.principal,
            correlationId: context.correlationId,
            idempotencyHeader: idempotencyKey,
            serverChannel,
            requestedTenantId: tenantId,
          },
          input.appointmentId,
          {newSlotId: input.newSlotId, idempotencyKey, reason: input.reason},
        );
        return {ok: true, action: 'reschedule_appointment', appointmentId: appointment.id, correlationId: context.correlationId};
      }

      case 'mark_no_show': {
        const appointment = await markNoShowAppointment(
          deps,
          {principal: resolved.principal, correlationId: context.correlationId, requestedTenantId: tenantId},
          input.appointmentId,
          input.reason,
        );
        return {ok: true, action: 'mark_no_show', appointmentId: appointment.id, correlationId: context.correlationId};
      }

      case 'check_in': {
        const appointment = await checkInAppointment(
          deps,
          {principal: resolved.principal, correlationId: context.correlationId, requestedTenantId: tenantId},
          input.appointmentId,
          input.channel ?? (context.role === 'staff' ? 'desk' : 'portal'),
        );
        return {ok: true, action: 'check_in', appointmentId: appointment.id, correlationId: context.correlationId};
      }

      case 'queue_transition': {
        const ticket = await transitionQueueTicket(
          deps,
          {principal: resolved.principal, correlationId: context.correlationId, requestedTenantId: tenantId},
          input.ticketId,
          input.toStatus,
        );
        return {ok: true, action: 'queue_transition', ticket, correlationId: context.correlationId};
      }

      case 'publish_schedule': {
        const result = await publishDoctorSlots(
          deps,
          {principal: resolved.principal, correlationId: context.correlationId, requestedTenantId: tenantId},
          {
            practitionerId: input.practitionerId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            slotDurationMinutes: input.slotDurationMinutes,
            capacity: input.capacity,
          },
        );
        return {ok: true, action: 'publish_schedule', ...result, correlationId: context.correlationId};
      }

      case 'create_encounter': {
        if (context.role !== 'staff') {
          throw new DashboardAccessError(403, 'staff_role_required', 'Chỉ bác sĩ/nhân viên y tế mới có quyền tạo hồ sơ khám.');
        }
        const appointment = await prisma.appointment.findFirst({
          where: {id: input.appointmentId, tenantId},
          include: {slot: {include: {schedule: true}}},
        });
        if (!appointment) {
          throw new DashboardAccessError(404, 'appointment_not_found', 'Không tìm thấy lịch hẹn.');
        }
        const practitionerId = input.practitionerId ?? appointment.slot.schedule.practitionerId;
        const encounter = await createEncounter(
          deps,
          {principal: resolved.principal, correlationId: context.correlationId, purpose: 'treatment', requestedTenantId: tenantId},
          {appointmentId: appointment.id, practitionerId},
        );
        return {ok: true, action: 'create_encounter', encounterId: encounter.id, correlationId: context.correlationId};
      }

      case 'record_observation': {
        if (context.role !== 'staff') {
          throw new DashboardAccessError(403, 'staff_role_required', 'Chỉ nhân viên lâm sàng mới có quyền ghi chỉ số sinh hiệu.');
        }
        const obs = await createObservation(
          deps,
          {principal: resolved.principal, correlationId: context.correlationId, purpose: 'treatment', requestedTenantId: tenantId},
          input.encounterId,
          {
            code: input.code,
            value: Number(input.value),
            unit: input.unit,
            measuredAt: input.measuredAt ?? new Date().toISOString(),
            expectedVersion: input.expectedVersion,
          },
        );
        return {ok: true, action: 'record_observation', observationId: obs.id, correlationId: context.correlationId};
      }

      case 'amend_observation': {
        if (context.role !== 'staff') {
          throw new DashboardAccessError(403, 'staff_role_required', 'Chỉ bác sĩ điều trị mới có quyền đính chính chỉ số sinh hiệu.');
        }
        const obs = await amendObservation(
          deps,
          {principal: resolved.principal, correlationId: context.correlationId, purpose: 'treatment', requestedTenantId: tenantId},
          input.encounterId,
          input.observationId,
          {
            value: Number(input.value),
            unit: input.unit,
            measuredAt: input.measuredAt ?? new Date().toISOString(),
            reason: input.reason,
            expectedVersion: input.expectedVersion,
          },
        );
        return {ok: true, action: 'amend_observation', observationId: obs.id, version: obs.version, correlationId: context.correlationId};
      }

      case 'complete_encounter': {
        if (context.role !== 'staff') {
          throw new DashboardAccessError(403, 'staff_role_required', 'Chỉ bác sĩ phụ trách mới có quyền xác nhận hoàn tất ca khám.');
        }
        const completed = await completeEncounter(
          deps,
          {principal: resolved.principal, correlationId: context.correlationId, purpose: 'treatment', requestedTenantId: tenantId},
          input.encounterId,
          {expectedVersion: input.expectedVersion},
        );
        return {ok: true, action: 'complete_encounter', ...completed, correlationId: context.correlationId};
      }

      case 'cancel_encounter': {
        if (context.role !== 'staff') {
          throw new DashboardAccessError(403, 'staff_role_required', 'Chỉ bác sĩ phụ trách mới có quyền hủy ca khám.');
        }
        const cancelled = await cancelEncounter(
          deps,
          {principal: resolved.principal, correlationId: context.correlationId, purpose: 'treatment', requestedTenantId: tenantId},
          input.encounterId,
          {reason: input.reason, expectedVersion: input.expectedVersion},
        );
        return {ok: true, action: 'cancel_encounter', ...cancelled, correlationId: context.correlationId};
      }
    }
  } catch (error) {
    rethrowAsDashboardError(error);
  }
}
