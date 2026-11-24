'use client';

import type {PractitionerSummary} from '@/lib/api/workspace-client';
import {formatVnDateTime, MC_COLORS, VISIT_REASONS, VISIT_TYPES} from '@/lib/design-tokens';
import type {PublishedDoctorSlot} from './booking-slot-picker';

interface BookingReviewStepProps {
  mode: 'create' | 'reschedule';
  tenantName: string;
  practitioner: PractitionerSummary | undefined;
  selectedSlot: PublishedDoctorSlot | undefined;
  visitType: string;
  onChangeVisitType: (v: string) => void;
  visitReason: string;
  onChangeVisitReason: (v: string) => void;
  intakeNote: string;
  onChangeIntakeNote: (v: string) => void;
}

export function BookingReviewStep({
  mode,
  tenantName,
  practitioner,
  selectedSlot,
  visitType,
  onChangeVisitType,
  visitReason,
  onChangeVisitReason,
  intakeNote,
  onChangeIntakeNote,
}: BookingReviewStepProps) {
  return (
    <section aria-label="Bước 3: Chi tiết tiếp nhận và xác nhận" style={{display: 'grid', gap: '16px'}}>
      <article
        style={{
          padding: '14px 16px',
          borderRadius: '12px',
          border: `1px solid ${MC_COLORS.mintBorder}`,
          backgroundColor: MC_COLORS.mintWash,
          display: 'grid',
          gap: '6px',
        }}
      >
        <strong style={{fontSize: '14px', color: MC_COLORS.brandInk}}>
          {mode === 'reschedule' ? 'Xác nhận đổi sang khung giờ mới' : 'Tóm tắt lịch khám đã chọn'}
        </strong>
        <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textInk}}>
          Cơ sở: <strong>{tenantName}</strong>
        </p>
        <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textInk}}>
          Bác sĩ: <strong>{practitioner?.displayName ?? '—'}</strong> ({practitioner?.specialty ?? '—'} ·{' '}
          {practitioner?.room ?? '—'})
        </p>
        <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textInk}}>
          Thời gian: <strong>{formatVnDateTime(selectedSlot?.starts_at)}</strong> (Còn{' '}
          {selectedSlot?.remaining ?? 0} chỗ)
        </p>
      </article>

      {mode === 'create' ? (
        <>
          <fieldset style={{border: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px'}}>
            <legend style={{fontSize: '13px', fontWeight: 700, color: MC_COLORS.textInk, marginBottom: '4px'}}>
              Hình thức khám
            </legend>
            <section style={{display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))'}}>
              {VISIT_TYPES.map((vt) => {
                const checked = visitType === vt.id;
                return (
                  <label
                    key={vt.id}
                    className="medicloud-radio-option"
                    data-checked={checked ? 'true' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: `1.5px solid ${checked ? MC_COLORS.brandPrimary : MC_COLORS.mintBorder}`,
                      backgroundColor: checked ? '#f2faf7' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="visit-type"
                      className="medicloud-radio"
                      checked={checked}
                      onChange={() => onChangeVisitType(vt.id)}
                    />
                    <span style={{display: 'grid', gap: '2px'}}>
                      <strong style={{fontSize: '13px', color: MC_COLORS.textInk}}>{vt.label}</strong>
                      <span style={{fontSize: '12px', color: MC_COLORS.textSubtle}}>{vt.note}</span>
                    </span>
                  </label>
                );
              })}
            </section>
          </fieldset>

          <label style={{display: 'grid', gap: '6px'}}>
            <span style={{fontSize: '13px', fontWeight: 700, color: MC_COLORS.textInk}}>Mục đích khám</span>
            <select
              className="medicloud-select"
              value={visitReason}
              onChange={(e) => onChangeVisitReason(e.target.value)}
            >
              {VISIT_REASONS.map((vr) => (
                <option key={vr.id} value={vr.id}>
                  {vr.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <label style={{display: 'grid', gap: '6px'}}>
        <span style={{fontSize: '13px', fontWeight: 700, color: MC_COLORS.textInk}}>
          {mode === 'reschedule' ? 'Lý do đổi lịch (tùy chọn)' : 'Ghi chú triệu chứng / tiền sử gửi điều dưỡng (tùy chọn)'}
        </span>
        <textarea
          rows={3}
          maxLength={mode === 'reschedule' ? 250 : 500}
          placeholder={
            mode === 'reschedule'
              ? 'Ví dụ: Thay đổi lịch công tác buổi sáng...'
              : 'Ghi nhận triệu chứng ban đầu để điều dưỡng chuẩn bị...'
          }
          value={intakeNote}
          onChange={(e) => onChangeIntakeNote(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '10px',
            border: `1px solid ${MC_COLORS.mintBorder}`,
            fontFamily: 'inherit',
            fontSize: '14px',
            color: MC_COLORS.textInk,
            resize: 'vertical',
          }}
        />
      </label>
    </section>
  );
}
