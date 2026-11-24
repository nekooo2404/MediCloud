'use client';

import Image from 'next/image';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  HeartIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import type {WorkspaceOverviewData} from '@/lib/api/workspace-client';
import {
  APPOINTMENT_STATUS_LABELS,
  formatVnDateTime,
  MC_COLORS,
} from '@/lib/design-tokens';

interface OverviewPanelProps {
  role: 'patient' | 'staff';
  overview: WorkspaceOverviewData;
  onOpenBooking: () => void;
  onNavigate: (tab: 'appointments' | 'queue' | 'records' | 'vitals' | 'audit') => void;
}

export function OverviewPanel({role, overview, onOpenBooking, onNavigate}: OverviewPanelProps) {
  const m = overview.metrics;

  return (
    <section aria-label="Tổng quan hoạt động" style={{display: 'grid', gap: '20px'}}>
      <article
        style={{
          backgroundColor: '#ffffff',
          border: `1px solid ${MC_COLORS.mintBorder}`,
          borderRadius: '14px',
          padding: '18px 22px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <section style={{display: 'grid', gap: '6px', maxWidth: '520px'}}>
          <span style={{fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: MC_COLORS.brandPrimary}}>
            {role === 'staff' ? 'Không gian điều hành lâm sàng' : 'Hệ sinh thái chăm sóc sức khỏe số'}
          </span>
          <h2 style={{margin: 0, fontSize: '20px', fontWeight: 700, color: MC_COLORS.textInk}}>
            {overview.tenant.name}
          </h2>
          <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textMuted}}>
            {role === 'staff'
              ? 'Quản lý hàng đợi khám bệnh, ghi nhận chỉ số sinh hiệu và đồng bộ hồ sơ chuẩn y tế.'
              : 'Theo dõi lịch hẹn, hồ sơ khám bệnh và chỉ số sức khỏe cá nhân mọi lúc, mọi nơi.'}
          </p>
        </section>
        <figure
          style={{
            margin: 0,
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: `1px solid ${MC_COLORS.mintBorder}`,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            src="/images/medicloud-banner.jpg"
            alt="MediCloud"
            width={240}
            height={80}
            priority
            style={{width: '240px', height: '80px', objectFit: 'contain', display: 'block'}}
          />
        </figure>
      </article>

      <section className="mc-kpi-grid" aria-label="Chỉ số tổng quan">
        {role === 'patient' ? (
          <>
            <article style={kpiCardStyle}>
              <span style={kpiLabelStyle}>Lịch hẹn sắp tới</span>
              <strong style={kpiValueStyle}>{m.patientUpcomingAppointments ?? 0}</strong>
              <span style={kpiHintStyle}>Khung giờ đã xác nhận</span>
            </article>
            <article style={kpiCardStyle}>
              <span style={kpiLabelStyle}>Ca khám hoàn tất</span>
              <strong style={kpiValueStyle}>{m.patientCompletedEncountersCount ?? 0}</strong>
              <span style={kpiHintStyle}>Hồ sơ có chữ ký bác sĩ</span>
            </article>
            <article style={kpiCardStyle}>
              <span style={kpiLabelStyle}>Chỉ số sinh hiệu</span>
              <strong style={kpiValueStyle}>{m.patientObservationsCount ?? 0}</strong>
              <span style={kpiHintStyle}>Bản ghi mới nhất</span>
            </article>
            <article style={kpiCardStyle}>
              <span style={kpiLabelStyle}>Khung giờ đang mở</span>
              <strong style={kpiValueStyle}>{m.availableSlotsCount ?? 0}</strong>
              <span style={kpiHintStyle}>Sẵn sàng đặt lịch ngay</span>
            </article>
          </>
        ) : (
          <>
            <article style={kpiCardStyle}>
              <span style={kpiLabelStyle}>Lịch hẹn đang hoạt động</span>
              <strong style={kpiValueStyle}>{m.confirmedAppointments ?? 0}</strong>
              <span style={kpiHintStyle}>Đã check-in: {m.checkedInAppointments ?? 0}</span>
            </article>
            <article style={kpiCardStyle}>
              <span style={kpiLabelStyle}>Hàng đợi chờ gọi</span>
              <strong style={kpiValueStyle}>{m.waitingQueueCount ?? 0}</strong>
              <span style={kpiHintStyle}>Đang khám: {m.inServiceQueueCount ?? 0}</span>
            </article>
            <article style={kpiCardStyle}>
              <span style={kpiLabelStyle}>Ca khám đang mở</span>
              <strong style={kpiValueStyle}>{m.openEncounters ?? 0}</strong>
              <span style={kpiHintStyle}>Chờ đo sinh hiệu / xác nhận</span>
            </article>
            <article style={kpiCardStyle}>
              <span style={kpiLabelStyle}>Ca khám hoàn tất</span>
              <strong style={kpiValueStyle}>{m.completedEncounters ?? 0}</strong>
              <span style={kpiHintStyle}>Đã đồng bộ hồ sơ chuẩn</span>
            </article>
          </>
        )}
      </section>

      {role === 'patient' && overview.activePatient && (
        <article
          style={{
            backgroundColor: '#ffffff',
            border: `1px solid ${MC_COLORS.mintBorder}`,
            borderRadius: '14px',
            padding: '18px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <section style={{display: 'grid', gap: '4px'}}>
            <strong style={{fontSize: '16px', color: MC_COLORS.textInk}}>
              Hồ sơ cá nhân: {overview.activePatient.displayName} ({overview.activePatient.code})
            </strong>
            <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textMuted}}>
              Nhóm máu: <strong>{overview.activePatient.bloodType ?? 'Chưa cập nhật'}</strong> · Tiền sử dị ứng:{' '}
              <strong>{overview.activePatient.allergy ?? 'Không ghi nhận'}</strong>
            </p>
          </section>
          <button type="button" onClick={onOpenBooking} style={primaryActionStyle}>
            <PlusIcon style={{width: 18, height: 18}} />
            <span>Đặt lịch khám mới</span>
          </button>
        </article>
      )}

      <section
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
        }}
      >
        <article style={panelCardStyle}>
          <header style={panelHeaderStyle}>
            <span style={{display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px'}}>
              <CalendarDaysIcon style={{width: 18, height: 18, color: MC_COLORS.brandInk}} />
              <span>{role === 'patient' ? 'Lịch hẹn gần nhất' : 'Điều phối nhanh trong ca trực'}</span>
            </span>
            <button
              type="button"
              onClick={() => onNavigate(role === 'patient' ? 'appointments' : 'queue')}
              style={linkBtnStyle}
            >
              Xem chi tiết
            </button>
          </header>

          {role === 'patient' ? (
            <ul style={{listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '2px'}}>
              {(overview.recentAppointments ?? []).length === 0 ? (
                <li style={{fontSize: '13px', color: MC_COLORS.textMuted, padding: '8px 0'}}>
                  Bạn chưa có lịch hẹn nào tại cơ sở này.
                </li>
              ) : (
                (overview.recentAppointments ?? []).map((appt, idx, arr) => {
                  const st = APPOINTMENT_STATUS_LABELS[appt.status] ?? {label: appt.status, tone: 'neutral' as const};
                  return (
                    <li
                      key={appt.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 2px',
                        borderBottom: idx < arr.length - 1 ? '1px solid #edf4f2' : 'none',
                      }}
                    >
                      <span style={{display: 'grid', gap: '2px'}}>
                        <strong style={{fontSize: '14px', color: MC_COLORS.textInk}}>
                          {appt.practitionerName} · {appt.specialty}
                        </strong>
                        <span style={{fontSize: '12px', color: MC_COLORS.textMuted, fontVariantNumeric: 'tabular-nums'}}>
                          {formatVnDateTime(appt.startsAt)} · {appt.room}
                        </span>
                      </span>
                      <span className={`mc-badge mc-badge-${st.tone}`}>{st.label}</span>
                    </li>
                  );
                })
              )}
            </ul>
          ) : (
            <section style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
              <button type="button" onClick={() => onNavigate('queue')} style={primaryActionStyle}>
                <ClipboardDocumentCheckIcon style={{width: 18, height: 18}} />
                <span>Mở hàng đợi khám bệnh</span>
              </button>
              <button type="button" onClick={() => onNavigate('records')} style={secondaryActionStyle}>
                <HeartIcon style={{width: 18, height: 18}} />
                <span>Ca khám & Sinh hiệu</span>
              </button>
              <button type="button" onClick={onOpenBooking} style={secondaryActionStyle}>
                <PlusIcon style={{width: 18, height: 18}} />
                <span>Đặt lịch hộ bệnh nhân</span>
              </button>
            </section>
          )}
        </article>

        <article style={panelCardStyle}>
          <header style={panelHeaderStyle}>
            <span style={{display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px'}}>
              <CheckCircleIcon style={{width: 18, height: 18, color: MC_COLORS.brandInk}} />
              <span>Đội ngũ bác sĩ tại {overview.tenant.name}</span>
            </span>
          </header>
          <ul style={{listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '2px'}}>
            {overview.practitioners.map((doc, idx, arr) => (
              <li
                key={doc.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 2px',
                  borderBottom: idx < arr.length - 1 ? '1px solid #edf4f2' : 'none',
                }}
              >
                <span style={{display: 'grid', gap: '2px'}}>
                  <strong style={{fontSize: '13px', color: MC_COLORS.textInk}}>{doc.displayName}</strong>
                  <span style={{fontSize: '12px', color: MC_COLORS.textSubtle}}>
                    {doc.specialty} · {doc.room}
                  </span>
                </span>
                <span className="mc-badge mc-badge-success">Đang nhận lịch</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
}

const kpiCardStyle = {
  backgroundColor: '#ffffff',
  border: `1px solid ${MC_COLORS.mintBorder}`,
  borderRadius: '14px',
  padding: '14px 16px',
  display: 'grid',
  gap: '4px',
} as const;

const kpiLabelStyle = {
  fontSize: '12px',
  fontWeight: 700,
  color: MC_COLORS.textMuted,
} as const;

const kpiValueStyle = {
  fontSize: '26px',
  lineHeight: 1.2,
  fontWeight: 700,
  color: MC_COLORS.textInk,
  fontVariantNumeric: 'tabular-nums',
} as const;

const kpiHintStyle = {
  fontSize: '12px',
  color: MC_COLORS.textSubtle,
} as const;

const panelCardStyle = {
  backgroundColor: '#ffffff',
  border: `1px solid ${MC_COLORS.mintBorder}`,
  borderRadius: '14px',
  padding: '16px',
  display: 'grid',
  gap: '12px',
  alignContent: 'start',
} as const;

const panelHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px',
} as const;

const primaryActionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 14px',
  borderRadius: '10px',
  border: `1px solid ${MC_COLORS.brandPrimary}`,
  backgroundColor: MC_COLORS.brandPrimary,
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const secondaryActionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 14px',
  borderRadius: '10px',
  border: `1px solid ${MC_COLORS.mintBorder}`,
  backgroundColor: '#ffffff',
  color: MC_COLORS.textInk,
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const linkBtnStyle = {
  border: 'none',
  background: 'transparent',
  color: MC_COLORS.brandInk,
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
} as const;
