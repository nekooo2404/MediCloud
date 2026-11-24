'use client';

import type {EncounterItem, SliceFilterOptions} from '@/lib/api/workspace-client';
import {ENCOUNTER_STATUS_LABELS, formatVnDateTime, MC_COLORS} from '@/lib/design-tokens';

interface RecordsPanelProps {
  role: 'patient' | 'staff';
  encounters: EncounterItem[];
  nextCursor: string | null;
  loading: boolean;
  mutatingKey: string | null;
  activeStatus: string;
  onFilterChange: (patch: SliceFilterOptions) => void;
  onLoadMore: () => void;
  onMutate: (key: string, body: Record<string, unknown>) => Promise<unknown>;
}

const STATUS_OPTS = [
  {id: 'ALL', label: 'Tất cả ca khám'},
  {id: 'OPEN', label: 'Mới mở'},
  {id: 'IN_PROGRESS', label: 'Đang đo chỉ số'},
  {id: 'COMPLETED', label: 'Đã hoàn tất'},
  {id: 'AMENDED', label: 'Đã đính chính'},
] as const;

export function RecordsPanel({
  role,
  encounters,
  nextCursor,
  loading,
  mutatingKey,
  activeStatus,
  onFilterChange,
  onLoadMore,
  onMutate,
}: RecordsPanelProps) {
  return (
    <section aria-label="Hồ sơ khám lâm sàng và kết quả" style={{display: 'grid', gap: '16px'}}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: '#ffffff',
          border: `1px solid ${MC_COLORS.mintBorder}`,
          borderRadius: '14px',
          padding: '12px 14px',
        }}
      >
        <nav aria-label="Lọc hồ sơ khám" style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
          {STATUS_OPTS.map((opt) => {
            const active = activeStatus === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => onFilterChange({status: opt.id})}
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
                {opt.label}
              </button>
            );
          })}
        </nav>
        {loading && <progress className="loading-spinner" aria-label="Đang tải hồ sơ khám" />}
      </header>

      {encounters.length === 0 ? (
        <article
          style={{
            backgroundColor: '#ffffff',
            border: `1px solid ${MC_COLORS.mintBorder}`,
            borderRadius: '14px',
            padding: '24px',
            textAlign: 'center',
            color: MC_COLORS.textMuted,
          }}
        >
          {loading ? 'Đang tải hồ sơ khám...' : 'Không có hồ sơ khám phù hợp.'}
        </article>
      ) : (
        <section style={{display: 'grid', gap: '12px'}}>
          {encounters.map((enc) => {
            const st = ENCOUNTER_STATUS_LABELS[enc.status] ?? {label: enc.status, tone: 'neutral' as const};
            const latestObs = enc.observations.filter((o) => o.isLatest);
            const historyObs = enc.observations.filter((o) => !o.isLatest);
            return (
              <article
                key={enc.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: `1px solid ${MC_COLORS.mintBorder}`,
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'grid',
                  gap: '10px',
                }}
              >
                <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
                  <section style={{display: 'grid', gap: '2px'}}>
                    <strong style={{fontSize: '15px', color: MC_COLORS.textInk}}>
                      {enc.referenceCode} · {enc.practitionerName} ({enc.specialty})
                    </strong>
                    <span style={{fontSize: '12px', color: MC_COLORS.textMuted}}>
                      {role === 'staff' ? `${enc.patientName} (${enc.patientCode}) · ` : ''}
                      Khám lúc {formatVnDateTime(enc.startsAt)}
                      {enc.completedAt ? ` · Hoàn tất ${formatVnDateTime(enc.completedAt)}` : ''}
                    </span>
                  </section>
                  <span style={{display: 'inline-flex', alignItems: 'center', gap: '8px'}}>
                    <span className={`mc-badge mc-badge-${st.tone}`}>{st.label}</span>
                    {role === 'staff' && (enc.status === 'OPEN' || enc.status === 'IN_PROGRESS') && (
                      <button
                        type="button"
                        disabled={Boolean(mutatingKey)}
                        onClick={() =>
                          void onMutate(`rec-complete-${enc.id}`, {
                            action: 'complete_encounter',
                            encounterId: enc.id,
                            expectedVersion: enc.version,
                          })
                        }
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${MC_COLORS.brandPrimary}`,
                          backgroundColor: MC_COLORS.brandPrimary,
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Hoàn tất ca khám
                      </button>
                    )}
                  </span>
                </header>

                {latestObs.length > 0 ? (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      display: 'grid',
                      gap: '10px',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
                      borderTop: `1px solid #edf4f2`,
                      paddingTop: '10px',
                    }}
                  >
                    {latestObs.map((obs) => (
                      <li
                        key={obs.id}
                        style={{
                          padding: '6px 8px',
                          display: 'grid',
                          gap: '2px',
                          borderLeft: `3px solid ${MC_COLORS.brandPrimary}`,
                        }}
                      >
                        <span style={{fontSize: '12px', fontWeight: 700, color: MC_COLORS.textMuted}}>
                          {obs.label} {obs.version > 1 ? `· Bản đính chính v${obs.version}` : ''}
                        </span>
                        <strong style={{fontSize: '18px', color: MC_COLORS.textInk, fontVariantNumeric: 'tabular-nums'}}>
                          {obs.value} {obs.unit}
                        </strong>
                        <span style={{fontSize: '12px', color: MC_COLORS.textSubtle}}>
                          {formatVnDateTime(obs.measuredAt)}
                          {obs.amendReason ? ` · ${obs.amendReason}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textSubtle}}>Chưa có chỉ số sinh hiệu được ghi nhận.</p>
                )}

                {historyObs.length > 0 && (
                  <details style={{fontSize: '12px', color: MC_COLORS.textSubtle}}>
                    <summary style={{cursor: 'pointer', fontWeight: 600}}>
                      Xem lịch sử đính chính ({historyObs.length} bản ghi trước)
                    </summary>
                    <section style={{marginTop: '6px', display: 'grid', gap: '4px'}}>
                      {historyObs.map((oldObs) => (
                        <span key={oldObs.id}>
                          v{oldObs.version}: {oldObs.label} = {oldObs.value} {oldObs.unit} ({formatVnDateTime(oldObs.measuredAt)})
                        </span>
                      ))}
                    </section>
                  </details>
                )}
              </article>
            );
          })}
        </section>
      )}

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
            Tải thêm hồ sơ
          </button>
        </footer>
      )}
    </section>
  );
}
