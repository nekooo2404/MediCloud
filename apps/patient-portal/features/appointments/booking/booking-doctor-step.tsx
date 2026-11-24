'use client';

import type {PatientSummary, PractitionerSummary} from '@/lib/api/workspace-client';
import {MC_COLORS} from '@/lib/design-tokens';

interface BookingDoctorStepProps {
  role: 'patient' | 'staff';
  patients: PatientSummary[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  specialties: string[];
  selectedSpecialty: string;
  onSelectSpecialty: (sp: string) => void;
  practitioners: PractitionerSummary[];
  selectedPractitionerId: string;
  onSelectPractitioner: (id: string) => void;
}

export function BookingDoctorStep({
  role,
  patients,
  selectedPatientId,
  onSelectPatient,
  specialties,
  selectedSpecialty,
  onSelectSpecialty,
  practitioners,
  selectedPractitionerId,
  onSelectPractitioner,
}: BookingDoctorStepProps) {
  const filteredDoctors =
    selectedSpecialty === 'ALL'
      ? practitioners
      : practitioners.filter((d) => d.specialty === selectedSpecialty);

  return (
    <section aria-label="Bước 1: Chọn bác sĩ và chuyên khoa" style={{display: 'grid', gap: '16px'}}>
      {role === 'staff' && patients.length > 0 && (
        <label style={{display: 'grid', gap: '6px'}}>
          <span style={{fontSize: '13px', fontWeight: 700, color: MC_COLORS.textInk}}>
            Hồ sơ bệnh nhân
          </span>
          <select
            className="medicloud-select"
            value={selectedPatientId}
            onChange={(e) => onSelectPatient(e.target.value)}
            aria-label="Chọn bệnh nhân đặt lịch"
          >
            {patients.map((pat) => (
              <option key={pat.id} value={pat.id}>
                {pat.displayName} · {pat.code}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset style={{border: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px'}}>
        <legend style={{fontSize: '13px', fontWeight: 700, color: MC_COLORS.textInk, marginBottom: '4px'}}>
          Chuyên khoa
        </legend>
        <nav aria-label="Lọc theo chuyên khoa" style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
          {['ALL', ...specialties].map((sp) => {
            const active = selectedSpecialty === sp;
            return (
              <button
                key={sp}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectSpecialty(sp)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${active ? MC_COLORS.brandPrimary : MC_COLORS.mintBorder}`,
                  backgroundColor: active ? MC_COLORS.mintWash : '#ffffff',
                  color: active ? MC_COLORS.brandInk : MC_COLORS.textMuted,
                }}
              >
                {sp === 'ALL' ? 'Tất cả chuyên khoa' : sp}
              </button>
            );
          })}
        </nav>
      </fieldset>

      <fieldset style={{border: 'none', margin: 0, padding: 0, display: 'grid', gap: '10px'}}>
        <legend style={{fontSize: '13px', fontWeight: 700, color: MC_COLORS.textInk, marginBottom: '4px'}}>
          Chọn bác sĩ phụ trách ({filteredDoctors.length})
        </legend>
        <section style={{display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))'}}>
          {filteredDoctors.map((doc) => {
            const checked = selectedPractitionerId === doc.id;
            return (
              <label
                key={doc.id}
                className="booking-radio-card"
                data-selected={checked ? 'true' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '12px',
                  border: `1.5px solid ${checked ? MC_COLORS.brandPrimary : MC_COLORS.mintBorder}`,
                  backgroundColor: checked ? '#f2faf7' : '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="booking-doctor"
                  className="medicloud-radio"
                  checked={checked}
                  onChange={() => onSelectPractitioner(doc.id)}
                  style={{marginTop: '3px'}}
                />
                <span style={{display: 'grid', gap: '2px'}}>
                  <strong style={{fontSize: '14px', color: MC_COLORS.textInk}}>{doc.displayName}</strong>
                  <span style={{fontSize: '12px', fontWeight: 600, color: MC_COLORS.brandInk}}>
                    {doc.specialty} · {doc.room}
                  </span>
                  <span style={{fontSize: '12px', color: MC_COLORS.textSubtle}}>{doc.title}</span>
                </span>
              </label>
            );
          })}
        </section>
      </fieldset>
    </section>
  );
}
