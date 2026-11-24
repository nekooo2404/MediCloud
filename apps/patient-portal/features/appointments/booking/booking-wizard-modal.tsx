'use client';

import {useEffect, useId, useMemo, useState, type FormEvent} from 'react';
import {CheckCircleIcon, XMarkIcon} from '@heroicons/react/24/outline';
import type {AppointmentItem, PatientSummary, PractitionerSummary} from '@/lib/api/workspace-client';
import {MC_COLORS} from '@/lib/design-tokens';
import {BookingDoctorStep} from './booking-doctor-step';
import {BookingReviewStep} from './booking-review-step';
import {BookingSlotPicker, type PublishedDoctorSlot} from './booking-slot-picker';

export interface BookingWizardModalProps {
  isOpen: boolean;
  mode?: 'create' | 'reschedule';
  rescheduleTarget?: AppointmentItem | null;
  role: 'patient' | 'staff';
  tenantName: string;
  tenantCode?: string;
  patients: PatientSummary[];
  defaultPatientId?: string;
  specialties: string[];
  practitioners: PractitionerSummary[];
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmitBooking: (payload: {
    action: 'book_appointment' | 'reschedule_appointment';
    appointmentId?: string;
    patientId?: string;
    slotId?: string;
    newSlotId?: string;
    visitType?: string;
    visitReason?: string;
    intakeNote?: string;
    reason?: string;
    idempotencyKey: string;
  }) => Promise<void>;
}

function generateIdempotencyKey(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

export function BookingWizardModal({
  isOpen,
  mode = 'create',
  rescheduleTarget = null,
  role,
  tenantName,
  tenantCode,
  patients,
  defaultPatientId,
  specialties,
  practitioners,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmitBooking,
}: BookingWizardModalProps) {
  const titleId = useId();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(defaultPatientId || patients[0]?.id || '');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('ALL');
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<string>(practitioners[0]?.id || '');
  const [selectedSlot, setSelectedSlot] = useState<PublishedDoctorSlot | undefined>(undefined);
  const [visitType, setVisitType] = useState<string>('in_person');
  const [visitReason, setVisitReason] = useState<string>('general_checkup');
  const [intakeNote, setIntakeNote] = useState<string>('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey('portal-book'));

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'reschedule' && rescheduleTarget) {
      setStep(2);
      setSelectedPractitionerId(rescheduleTarget.practitionerId);
      setSelectedPatientId(rescheduleTarget.patientId);
      setSelectedSlot(undefined);
      setIntakeNote('');
      setIdempotencyKey(generateIdempotencyKey('portal-resched'));
    } else {
      setStep(1);
      setSelectedPatientId(defaultPatientId || patients[0]?.id || '');
      setSelectedPractitionerId(practitioners[0]?.id || '');
      setSelectedSlot(undefined);
      setIntakeNote('');
      setIdempotencyKey(generateIdempotencyKey('portal-book'));
    }
  }, [isOpen, mode, rescheduleTarget, defaultPatientId, patients, practitioners]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isSubmitting, onClose]);

  const activePractitioner = useMemo(
    () => practitioners.find((p) => p.id === selectedPractitionerId),
    [practitioners, selectedPractitionerId],
  );

  if (!isOpen) return null;

  const canAdvanceStep1 = Boolean(selectedPractitionerId);
  const canAdvanceStep2 = Boolean(selectedSlot && selectedSlot.remaining > 0);

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!selectedSlot || isSubmitting) return;
    if (mode === 'reschedule' && rescheduleTarget) {
      await onSubmitBooking({
        action: 'reschedule_appointment',
        appointmentId: rescheduleTarget.id,
        newSlotId: selectedSlot.id,
        reason: intakeNote.trim() || 'Đổi khung giờ khám',
        idempotencyKey,
      });
    } else {
      await onSubmitBooking({
        action: 'book_appointment',
        patientId: role === 'staff' ? selectedPatientId : undefined,
        slotId: selectedSlot.id,
        visitType,
        visitReason,
        intakeNote: intakeNote.trim() || undefined,
        idempotencyKey,
      });
    }
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        backgroundColor: 'rgba(15, 38, 35, 0.5)',
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <form
        onSubmit={handleConfirm}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          border: `1px solid ${MC_COLORS.mintBorder}`,
          boxShadow: '0 24px 64px rgba(15, 38, 35, 0.25)',
          padding: '22px',
          display: 'grid',
          gap: '18px',
        }}
      >
        <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px'}}>
          <section style={{display: 'grid', gap: '4px'}}>
            <h2 id={titleId} style={{margin: 0, fontSize: '20px', fontWeight: 700, color: MC_COLORS.textInk}}>
              {mode === 'reschedule' ? 'Đổi lịch khám sang khung giờ mới' : 'Đặt lịch khám mới'}
            </h2>
            <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textMuted}}>
              {mode === 'reschedule'
                ? `Lịch hiện tại: ${rescheduleTarget?.referenceCode ?? ''} · ${rescheduleTarget?.practitionerName ?? ''}`
                : 'Chọn bác sĩ, khung giờ đã mở thực tế và xác nhận hồ sơ tiếp nhận.'}
            </p>
          </section>
          <button
            type="button"
            aria-label="Đóng hộp thoại"
            disabled={isSubmitting}
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: `1px solid ${MC_COLORS.mintBorder}`,
              backgroundColor: '#ffffff',
              color: MC_COLORS.textInk,
              cursor: 'pointer',
              display: 'inline-grid',
              placeItems: 'center',
            }}
          >
            <XMarkIcon style={{width: 20, height: 20}} />
          </button>
        </header>

        <nav aria-label="Tiến trình đặt lịch" style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
          {[
            {n: 1 as const, label: '1. Bác sĩ & Chuyên khoa'},
            {n: 2 as const, label: '2. Ngày & Khung giờ'},
            {n: 3 as const, label: '3. Xác nhận lịch hẹn'},
          ].map((item) => {
            if (mode === 'reschedule' && item.n === 1) return null;
            const current = step === item.n;
            const done = step > item.n;
            return (
              <span
                key={item.n}
                className={`mc-badge ${current || done ? 'mc-badge-success' : 'mc-badge-neutral'}`}
                aria-current={current ? 'step' : undefined}
              >
                {done && <CheckCircleIcon style={{width: 14, height: 14}} />}
                {item.label}
              </span>
            );
          })}
        </nav>

        {errorMessage && (
          <section
            role="alert"
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: MC_COLORS.dangerBg,
              color: MC_COLORS.dangerText,
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </section>
        )}

        {step === 1 && mode === 'create' && (
          <BookingDoctorStep
            role={role}
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={setSelectedPatientId}
            specialties={specialties}
            selectedSpecialty={selectedSpecialty}
            onSelectSpecialty={setSelectedSpecialty}
            practitioners={practitioners}
            selectedPractitionerId={selectedPractitionerId}
            onSelectPractitioner={(docId) => {
              setSelectedPractitionerId(docId);
              setSelectedSlot(undefined);
            }}
          />
        )}

        {step === 2 && (
          <BookingSlotPicker
            practitionerId={selectedPractitionerId}
            practitionerName={activePractitioner?.displayName ?? 'Bác sĩ'}
            tenantCode={tenantCode}
            selectedSlotId={selectedSlot?.id ?? ''}
            onSelectSlot={setSelectedSlot}
          />
        )}

        {step === 3 && (
          <BookingReviewStep
            mode={mode}
            tenantName={tenantName}
            practitioner={activePractitioner}
            selectedSlot={selectedSlot}
            visitType={visitType}
            onChangeVisitType={setVisitType}
            visitReason={visitReason}
            onChangeVisitReason={setVisitReason}
            intakeNote={intakeNote}
            onChangeIntakeNote={setIntakeNote}
          />
        )}

        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            borderTop: `1px solid ${MC_COLORS.mintBorder}`,
            paddingTop: '14px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (step === 1 || (mode === 'reschedule' && step === 2)) {
                onClose();
              } else {
                setStep((prev) => (prev === 3 ? 2 : 1));
              }
            }}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: `1px solid ${MC_COLORS.mintBorder}`,
              backgroundColor: '#ffffff',
              color: MC_COLORS.textInk,
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {step === 1 || (mode === 'reschedule' && step === 2) ? 'Hủy bỏ' : 'Quay lại'}
          </button>

          {step < 3 ? (
            <button
              key="wizard-next"
              type="button"
              disabled={(step === 1 && !canAdvanceStep1) || (step === 2 && !canAdvanceStep2)}
              onClick={() => setStep((prev) => (prev === 1 ? 2 : 3))}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: `1px solid ${MC_COLORS.brandPrimary}`,
                backgroundColor:
                  (step === 1 && canAdvanceStep1) || (step === 2 && canAdvanceStep2)
                    ? MC_COLORS.brandPrimary
                    : '#99bdb4',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14px',
                cursor:
                  (step === 1 && canAdvanceStep1) || (step === 2 && canAdvanceStep2) ? 'pointer' : 'not-allowed',
              }}
            >
              Tiếp tục
            </button>
          ) : (
            <button
              key="wizard-submit"
              type="submit"
              disabled={isSubmitting || !selectedSlot}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: `1px solid ${MC_COLORS.brandPrimary}`,
                backgroundColor: isSubmitting ? '#6aa899' : MC_COLORS.brandPrimary,
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: isSubmitting ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isSubmitting && <progress className="loading-spinner" aria-label="Đang gửi yêu cầu" />}
              <span>
                {isSubmitting
                  ? 'Đang xác nhận...'
                  : mode === 'reschedule'
                    ? 'Xác nhận đổi lịch'
                    : 'Xác nhận đặt lịch'}
              </span>
            </button>
          )}
        </footer>
      </form>
    </section>
  );
}
