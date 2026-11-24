export type MembershipRole = 'PATIENT' | 'GUARDIAN' | 'RECEPTIONIST' | 'PHYSICIAN' | 'NURSE' | 'AUDITOR';

export type SyntheticPersonaId =
  | 'patient-hospital-a'
  | 'receptionist-hospital-a'
  | 'patient-hospital-b';

export type PortalSimulationMode = 'normal' | 'degraded' | 'empty' | 'slow';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export type CheckInStatus = 'not_checked_in' | 'checked_in' | 'voided';

export type CheckInChannel = 'desk' | 'portal';

export interface Specialty {
  id: string;
  name: string;
}

export interface DoctorSummary {
  id: string;
  display_name: string;
  specialty: string;
}

export type Slot = {
  id: string;
  starts_at: string;
  capacity: number;
  remaining: number;
};

export type Appointment = {
  id: string;
  tenant_id: string;
  slot_id: string;
  status: AppointmentStatus;
  check_in_status: CheckInStatus;
  checked_in_at: string | null;
  correlation_id: string;
};

export type PortalAppointmentSummary = Appointment & {
  patient_ref: string;
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  starts_at: string;
};

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    correlation_id: string;
    details?: Record<string, unknown>;
  };
}

export interface SyntheticPersona {
  id: SyntheticPersonaId;
  subject: string;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  role: MembershipRole;
  patientId?: string;
  patientRef?: string;
  displayName: string;
  summary: string;
}

export interface ActiveSession {
  sessionId?: string;
  personaId?: SyntheticPersonaId;
  subject: string;
  email?: string;
  emailVerified?: boolean;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  role: MembershipRole;
  patientId?: string;
  patientRef?: string;
  displayName: string;
}
