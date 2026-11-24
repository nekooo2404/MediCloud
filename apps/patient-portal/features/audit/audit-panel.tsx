'use client';

import type {AuditEventItem} from '@/lib/api/workspace-client';
import {formatVnDateTime, MC_COLORS} from '@/lib/design-tokens';

interface AuditPanelProps {
  role: 'patient' | 'staff';
  items: AuditEventItem[];
  nextCursor: string | null;
  loading: boolean;
  onLoadMore: () => void;
}

export function AuditPanel({role, items, nextCursor, loading, onLoadMore}: AuditPanelProps) {
  return (
    <section aria-label="Nhật ký hoạt động và kiểm toán" style={{display: 'grid', gap: '16px'}}>
      <section className="table-wrap" aria-busy={loading}>
        <table className="mc-table">
          <caption>
            {role === 'staff' ? 'Nhật ký kiểm toán truy cập & thao tác (append-only)' : 'Nhật ký hoạt động hồ sơ cá nhân'}
            {loading && <progress className="loading-spinner" style={{marginLeft: 10}} aria-label="Đang tải nhật ký" />}
          </caption>
          <thead>
            <tr>
              <th scope="col">Thời điểm</th>
              <th scope="col">Hành động</th>
              <th scope="col">Mục đích</th>
              <th scope="col">Mã đối chiếu</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} style={{textAlign: 'center', padding: '24px', color: MC_COLORS.textMuted}}>
                  {loading ? 'Đang tải nhật ký...' : 'Chưa có sự kiện nào trong khoảng thời gian truy vấn.'}
                </td>
              </tr>
            ) : (
              items.map((ev) => (
                <tr key={ev.id}>
                  <td data-label="Thời điểm">{formatVnDateTime(ev.occurredAt)}</td>
                  <td data-label="Hành động" style={{fontWeight: 700}}>
                    {ev.actionLabel}
                  </td>
                  <td data-label="Mục đích">
                    <span className="mc-badge mc-badge-neutral">{ev.purpose}</span>
                  </td>
                  <td data-label="Mã đối chiếu" style={{fontSize: '12px', color: MC_COLORS.textSubtle}}>
                    {ev.correlationId ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {nextCursor && (
        <footer style={{display: 'flex', justifyContent: 'center'}}>
          <button
            type="button"
            disabled={loading}
            onClick={onLoadMore}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: `1px solid ${MC_COLORS.mintBorder}`,
              backgroundColor: '#ffffff',
              color: MC_COLORS.textInk,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tải thêm nhật ký
          </button>
        </footer>
      )}
    </section>
  );
}
