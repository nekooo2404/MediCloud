'use client';

import {useState} from 'react';
import {MagnifyingGlassIcon, PlusIcon} from '@heroicons/react/24/outline';
import type {AppointmentItem, SliceFilterOptions} from '@/lib/api/workspace-client';
import {APPOINTMENT_STATUS_LABELS, formatVnDateTime, MC_COLORS} from '@/lib/design-tokens';

interface AppointmentsPanelProps {
  role: 'patient' | 'staff';
  items: AppointmentItem[];
  nextCursor: string | null;
  loading: boolean;
  mutatingKey: string | null;
  activeStatus: string;
  searchQuery: string;
  sortBy: 'startsAt' | 'status';
  sortDir: 'asc' | 'desc';
  onFilterChange: (patch: SliceFilterOptions) => void;
  onLoadMore: () => void;
  onOpenNewBooking: () => void;
  onOpenReschedule: (appt: AppointmentItem) => void;
  onMutate: (key: string, body: Record<string, unknown>) => Promise<unknown>;
}

const STATUS_TABS = [
  {id: 'ALL', label: 'Tất cả'},
  {id: 'CONFIRMED', label: 'Đã xác nhận'},
  {id: 'COMPLETED', label: 'Hoàn tất'},
  {id: 'CANCELLED', label: 'Đã hủy'},
  {id: 'NO_SHOW', label: 'Vắng mặt'},
] as const;

export function AppointmentsPanel({
  role,
  items,
  nextCursor,
  loading,
  mutatingKey,
  activeStatus,
  searchQuery,
  sortBy,
  sortDir,
  onFilterChange,
  onLoadMore,
  onOpenNewBooking,
  onOpenReschedule,
  onMutate,
}: AppointmentsPanelProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const toggleSort = (col: 'startsAt' | 'status') => {
    const nextDir = sortBy === col && sortDir === 'asc' ? 'desc' : 'asc';
    onFilterChange({sort: col, dir: nextDir});
  };

  async function confirmCancel(appointmentId: string) {
    if (cancelReason.trim().length < 3) {
      setLocalError('Vui lòng nhập lý do hủy lịch tối thiểu 3 ký tự.');
      return;
    }
    setLocalError(null);
    await onMutate(`cancel-${appointmentId}`, {
      action: 'cancel_appointment',
      appointmentId,
      reason: cancelReason.trim(),
    });
    setCancellingId(null);
    setCancelReason('');
  }

  return (
    <section aria-label="Quản lý lịch hẹn khám bệnh" style={{display: 'grid', gap: '16px'}}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#ffffff',
          border: `1px solid ${MC_COLORS.mintBorder}`,
          borderRadius: '14px',
          padding: '12px 14px',
        }}
      >
        <nav aria-label="Lọc trạng thái lịch hẹn" style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
          {STATUS_TABS.map((tab) => {
            const active = activeStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => onFilterChange({status: tab.id})}
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
                {tab.label}
              </button>
            );
          })}
        </nav>

        <section style={{display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'}}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '10px',
              border: `1px solid ${MC_COLORS.mintBorder}`,
              backgroundColor: '#ffffff',
            }}
          >
            <MagnifyingGlassIcon style={{width: 16, height: 16, color: MC_COLORS.textSubtle}} />
            <input
              type="search"
              placeholder="Tìm bác sĩ, lý do khám..."
              aria-label="Tìm kiếm lịch hẹn"
              value={searchQuery}
              onChange={(e) => onFilterChange({q: e.target.value})}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                color: MC_COLORS.textInk,
                minWidth: '170px',
              }}
            />
          </label>
          <button
            type="button"
            onClick={onOpenNewBooking}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: `1px solid ${MC_COLORS.brandPrimary}`,
              backgroundColor: MC_COLORS.brandPrimary,
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <PlusIcon style={{width: 16, height: 16}} />
            <span>Đặt lịch mới</span>
          </button>
        </section>
      </header>

      {localError && (
        <section
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: MC_COLORS.dangerBg,
            color: MC_COLORS.dangerText,
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {localError}
        </section>
      )}

      {cancellingId && (
        <article
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            border: `1px solid #f0b9b5`,
            backgroundColor: MC_COLORS.dangerBg,
            display: 'grid',
            gap: '10px',
          }}
        >
          <strong style={{fontSize: '14px', color: MC_COLORS.dangerText}}>
            Xác nhận hủy lịch hẹn và hoàn lại chỗ trống
          </strong>
          <input
            type="text"
            placeholder="Nhập lý do hủy lịch (bắt buộc tối thiểu 3 ký tự)..."
            aria-label="Lý do hủy lịch"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #e0a39f',
              fontSize: '13px',
            }}
          />
          <span style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
            <button
              type="button"
              disabled={Boolean(mutatingKey)}
              onClick={() => void confirmCancel(cancellingId)}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: `1px solid ${MC_COLORS.dangerText}`,
                backgroundColor: MC_COLORS.dangerText,
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Xác nhận hủy lịch
            </button>
            <button
              type="button"
              onClick={() => {
                setCancellingId(null);
                setCancelReason('');
              }}
              style={btnGhostStyle}
            >
              Đóng
            </button>
          </span>
        </article>
      )}

      <section className="table-wrap" aria-busy={loading} tabIndex={0}>
        <table className="mc-table">
          <caption>
            Danh sách lịch hẹn ({items.length})
            {loading && <progress className="loading-spinner" style={{marginLeft: 10}} aria-label="Đang tải danh sách lịch hẹn" />}
          </caption>
          <thead>
            <tr>
              <th scope="col">Mã lịch</th>
              {role === 'staff' && <th scope="col">Bệnh nhân</th>}
              <th scope="col">Bác sĩ & Phòng khám</th>
              <th scope="col" aria-sort={sortBy === 'startsAt' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                <button type="button" onClick={() => toggleSort('startsAt')}>
                  <span>Giờ khám</span>
                  <span aria-hidden="true">{sortBy === 'startsAt' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th scope="col" aria-sort={sortBy === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                <button type="button" onClick={() => toggleSort('status')}>
                  <span>Trạng thái</span>
                  <span aria-hidden="true">{sortBy === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th scope="col">Tiếp nhận / Hàng đợi</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={role === 'staff' ? 7 : 6} style={{textAlign: 'center', color: MC_COLORS.textMuted, padding: '24px'}}>
                  {loading ? 'Đang tải dữ liệu...' : 'Không có lịch hẹn phù hợp với bộ lọc hiện tại.'}
                </td>
              </tr>
            ) : (
              items.map((appt) => {
                const st = APPOINTMENT_STATUS_LABELS[appt.status] ?? {label: appt.status, tone: 'neutral' as const};
                const isActive = appt.status === 'CONFIRMED' || appt.status === 'PENDING';
                return (
                  <tr key={appt.id}>
                    <td data-label="Mã lịch" style={{fontWeight: 700}}>
                      {appt.referenceCode}
                    </td>
                    {role === 'staff' && (
                      <td data-label="Bệnh nhân">
                        <strong>{appt.patientName}</strong>
                        <span style={{display: 'block', fontSize: '12px', color: MC_COLORS.textSubtle}}>{appt.patientCode}</span>
                      </td>
                    )}
                    <td data-label="Bác sĩ">
                      <strong>{appt.practitionerName}</strong>
                      <span style={{display: 'block', fontSize: '12px', color: MC_COLORS.textSubtle}}>
                        {appt.specialty} · {appt.room}
                      </span>
                    </td>
                    <td data-label="Giờ khám">{formatVnDateTime(appt.startsAt)}</td>
                    <td data-label="Trạng thái">
                      <span className={`mc-badge mc-badge-${st.tone}`}>{st.label}</span>
                    </td>
                    <td data-label="Tiếp nhận">
                      {appt.queueTicket ? (
                        <span className="mc-badge mc-badge-success">
                          Phiếu {appt.queueTicket.ticketNumber} · {appt.queueTicket.status}
                        </span>
                      ) : appt.checkInStatus === 'CHECKED_IN' ? (
                        <span className="mc-badge mc-badge-success">Đã tiếp nhận</span>
                      ) : (
                        <span className="mc-badge mc-badge-neutral">Chưa check-in</span>
                      )}
                    </td>
                    <td data-label="Thao tác">
                      <span style={{display: 'inline-flex', flexWrap: 'wrap', gap: '6px'}}>
                        {role === 'staff' && isActive && appt.checkInStatus !== 'CHECKED_IN' && (
                          <button
                            type="button"
                            disabled={Boolean(mutatingKey)}
                            onClick={() =>
                              void onMutate(`checkin-${appt.id}`, {
                                action: 'check_in',
                                appointmentId: appt.id,
                                channel: 'desk',
                              })
                            }
                            style={btnPrimarySmallStyle}
                          >
                            Check-in
                          </button>
                        )}
                        {isActive && (
                          <button type="button" onClick={() => onOpenReschedule(appt)} style={btnGhostStyle}>
                            Đổi lịch
                          </button>
                        )}
                        {isActive && (
                          <button type="button" onClick={() => setCancellingId(appt.id)} style={btnDangerSmallStyle}>
                            Hủy
                          </button>
                        )}
                        {role === 'staff' && isActive && (
                          <button
                            type="button"
                            disabled={Boolean(mutatingKey)}
                            onClick={() =>
                              void onMutate(`noshow-${appt.id}`, {
                                action: 'mark_no_show',
                                appointmentId: appt.id,
                                reason: 'Quá giờ hẹn không đến khám',
                              })
                            }
                            style={btnGhostStyle}
                          >
                            Vắng mặt
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {nextCursor && (
        <footer style={{display: 'flex', justifyContent: 'center'}}>
          <button type="button" disabled={loading} onClick={onLoadMore} style={btnGhostStyle}>
            {loading ? 'Đang tải thêm...' : 'Tải thêm lịch hẹn'}
          </button>
        </footer>
      )}
    </section>
  );
}

const btnPrimarySmallStyle = {
  padding: '5px 10px',
  borderRadius: '8px',
  border: `1px solid ${MC_COLORS.brandPrimary}`,
  backgroundColor: MC_COLORS.brandPrimary,
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const btnGhostStyle = {
  padding: '5px 10px',
  borderRadius: '8px',
  border: `1px solid ${MC_COLORS.mintBorder}`,
  backgroundColor: '#ffffff',
  color: MC_COLORS.textInk,
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const btnDangerSmallStyle = {
  padding: '5px 10px',
  borderRadius: '8px',
  border: '1px solid #f0b9b5',
  backgroundColor: '#ffffff',
  color: MC_COLORS.dangerText,
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
} as const;
