'use client';

import dynamic from 'next/dynamic';
import type {ObservationItem} from '@/lib/api/workspace-client';
import {formatVnDateTime, MC_COLORS} from '@/lib/design-tokens';

const LazyVitalsChart = dynamic(
  () => import('./vitals-chart').then((mod) => mod.VitalsChart),
  {
    ssr: false,
    loading: () => (
      <section style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0'}}>
        <progress className="loading-spinner" aria-label="Đang tải biểu đồ sinh hiệu" />
        <span style={{fontSize: '13px', color: MC_COLORS.textMuted}}>Đang tải biểu đồ sinh hiệu...</span>
      </section>
    ),
  },
);

interface VitalsPanelProps {
  role: 'patient' | 'staff';
  items: ObservationItem[];
  nextCursor: string | null;
  loading: boolean;
  onLoadMore: () => void;
}

export function VitalsPanel({role, items, nextCursor, loading, onLoadMore}: VitalsPanelProps) {
  return (
    <section aria-label="Chỉ số sinh hiệu lâm sàng" style={{display: 'grid', gap: '16px'}}>
      <article
        style={{
          backgroundColor: '#ffffff',
          border: `1px solid ${MC_COLORS.mintBorder}`,
          borderRadius: '14px',
          padding: '16px',
          display: 'grid',
          gap: '12px',
        }}
      >
        <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <strong style={{fontSize: '15px', color: MC_COLORS.textInk}}>Biểu đồ biến thiên sinh hiệu</strong>
          {loading && <progress className="loading-spinner" aria-label="Đang tải chỉ số sinh hiệu" />}
        </header>
        <LazyVitalsChart items={items} />
      </article>

      <section className="table-wrap" aria-busy={loading}>
        <table className="mc-table">
          <caption>Lịch sử đo chỉ số sinh hiệu mới nhất ({items.length})</caption>
          <thead>
            <tr>
              <th scope="col">Chỉ số</th>
              {role === 'staff' && <th scope="col">Bệnh nhân</th>}
              <th scope="col" className="num">
                Giá trị
              </th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Hồ sơ</th>
              <th scope="col">Thời điểm đo</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={role === 'staff' ? 6 : 5} style={{textAlign: 'center', padding: '24px', color: MC_COLORS.textMuted}}>
                  {loading ? 'Đang tải...' : 'Chưa có chỉ số sinh hiệu nào.'}
                </td>
              </tr>
            ) : (
              items.map((obs) => (
                <tr key={obs.id}>
                  <td data-label="Chỉ số" style={{fontWeight: 700}}>
                    {obs.label}
                  </td>
                  {role === 'staff' && <td data-label="Bệnh nhân">{obs.patientName ?? '—'}</td>}
                  <td data-label="Giá trị" className="num" style={{fontWeight: 700}}>
                    {obs.value} {obs.unit}
                  </td>
                  <td data-label="Trạng thái">
                    <span className={`mc-badge ${obs.status === 'AMENDED' ? 'mc-badge-warning' : 'mc-badge-success'}`}>
                      v{obs.version} · {obs.status}
                    </span>
                  </td>
                  <td data-label="Hồ sơ">{obs.encounterCode ?? '—'}</td>
                  <td data-label="Thời điểm">{formatVnDateTime(obs.measuredAt)}</td>
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
            Tải thêm chỉ số
          </button>
        </footer>
      )}
    </section>
  );
}
