'use client';

import {useMemo, useState} from 'react';
import {CheckBadgeIcon, MegaphoneIcon, PlusCircleIcon} from '@heroicons/react/24/outline';
import type {PractitionerSummary, QueueTicketItem} from '@/lib/api/workspace-client';
import {
  formatVnDateTime,
  MC_COLORS,
  OBSERVATION_CODES,
  QUEUE_STATUS_LABELS,
} from '@/lib/design-tokens';

interface StaffQueuePanelProps {
  tickets: QueueTicketItem[];
  practitioners: PractitionerSummary[];
  activePractitionerId?: string;
  loading: boolean;
  mutatingKey: string | null;
  onMutate: (key: string, body: Record<string, unknown>) => Promise<unknown>;
}

export function StaffQueuePanel({
  tickets,
  practitioners,
  activePractitionerId,
  loading,
  mutatingKey,
  onMutate,
}: StaffQueuePanelProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [obsCode, setObsCode] = useState<string>(OBSERVATION_CODES[0].code);
  const [obsValue, setObsValue] = useState<string>('36.8');
  const [obsUnit, setObsUnit] = useState<string>(OBSERVATION_CODES[0].defaultUnit);
  const [amendingObsId, setAmendingObsId] = useState<string | null>(null);
  const [amendReason, setAmendReason] = useState<string>('');
  const [amendValue, setAmendValue] = useState<string>('');
  const [showPublish, setShowPublish] = useState(false);
  const [pubDocId, setPubDocId] = useState<string>(practitioners[0]?.id ?? '');
  const [pubDate, setPubDate] = useState<string>('2026-12-08');
  const [pubSession, setPubSession] = useState<'morning' | 'afternoon'>('morning');
  const [actionError, setActionError] = useState<string | null>(null);

  const sortedTickets = useMemo(() => {
    const score = (t: QueueTicketItem) => {
      const done = t.status === 'DONE' || t.status === 'SKIPPED';
      const own = !activePractitionerId || t.practitionerId === activePractitionerId;
      if (!done && own) return 0;
      if (!done) return 1;
      return 2;
    };
    return [...tickets].sort((a, b) => score(a) - score(b));
  }, [tickets, activePractitionerId]);

  const activeTicket = useMemo(
    () =>
      sortedTickets.find((t) => t.id === selectedTicketId) ??
      sortedTickets.find((t) => t.status !== 'DONE' && t.status !== 'SKIPPED') ??
      sortedTickets[0] ??
      null,
    [sortedTickets, selectedTicketId],
  );

  async function safeRun(key: string, body: Record<string, unknown>) {
    setActionError(null);
    try {
      await onMutate(key, body);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Thao tác thất bại');
    }
  }

  return (
    <section aria-label="Điều phối hàng đợi phòng khám" style={{display: 'grid', gap: '18px'}}>
      {activeTicket && (
        <article
          aria-label="Ngữ cảnh bệnh nhân đang thao tác"
          style={{
            position: 'sticky',
            top: '8px',
            zIndex: 10,
            padding: '12px 16px',
            borderRadius: '12px',
            border: `1.5px solid ${MC_COLORS.brandPrimary}`,
            backgroundColor: MC_COLORS.mintWash,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{display: 'grid', gap: '2px'}}>
            <strong style={{fontSize: '14px', color: MC_COLORS.brandInk}}>
              Đang chọn phiếu {activeTicket.ticketNumber}: {activeTicket.patientName} ({activeTicket.patientCode})
            </strong>
            <span style={{fontSize: '12px', color: MC_COLORS.textInk}}>
              Nhóm máu: {activeTicket.bloodType} · Dị ứng: {activeTicket.allergy} · {activeTicket.practitionerName} ({activeTicket.room})
            </span>
          </span>
          <span className="mc-badge mc-badge-success">
            {QUEUE_STATUS_LABELS[activeTicket.status]?.label ?? activeTicket.status}
          </span>
        </article>
      )}

      {actionError && (
        <section role="alert" style={{padding: '10px 14px', borderRadius: '10px', backgroundColor: MC_COLORS.dangerBg, color: MC_COLORS.dangerText, fontSize: '13px', fontWeight: 600}}>
          {actionError}
        </section>
      )}

      <section style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
        <strong style={{fontSize: '15px', color: MC_COLORS.textInk}}>
          Hàng đợi bệnh nhân hôm nay ({tickets.length})
        </strong>
        <button
          type="button"
          onClick={() => setShowPublish((v) => !v)}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            border: `1px solid ${MC_COLORS.mintBorder}`,
            backgroundColor: '#ffffff',
            color: MC_COLORS.textInk,
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showPublish ? 'Ẩn công bố lịch bác sĩ' : '+ Công bố khung giờ bác sĩ'}
        </button>
      </section>

      {showPublish && (
        <article
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            border: `1px solid ${MC_COLORS.mintBorder}`,
            backgroundColor: '#ffffff',
            display: 'grid',
            gap: '10px',
          }}
        >
          <strong style={{fontSize: '14px', color: MC_COLORS.textInk}}>Công bố ca khám bác sĩ mới (4 slot × 1 giờ)</strong>
          <section style={{display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end'}}>
            <label style={{display: 'grid', gap: '4px'}}>
              <span style={{fontSize: '12px', fontWeight: 700}}>Bác sĩ</span>
              <select className="medicloud-select" value={pubDocId} onChange={(e) => setPubDocId(e.target.value)}>
                {practitioners.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.displayName} ({d.specialty})
                  </option>
                ))}
              </select>
            </label>
            <label style={{display: 'grid', gap: '4px'}}>
              <span style={{fontSize: '12px', fontWeight: 700}}>Ngày (UTC+7)</span>
              <input
                type="date"
                value={pubDate}
                onChange={(e) => setPubDate(e.target.value)}
                style={{padding: '8px 10px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`}}
              />
            </label>
            <label style={{display: 'grid', gap: '4px'}}>
              <span style={{fontSize: '12px', fontWeight: 700}}>Buổi</span>
              <select
                className="medicloud-select"
                value={pubSession}
                onChange={(e) => setPubSession(e.target.value as 'morning' | 'afternoon')}
              >
                <option value="morning">Buổi sáng (08:00 – 12:00)</option>
                <option value="afternoon">Buổi chiều (14:00 – 18:00)</option>
              </select>
            </label>
            <button
              type="button"
              disabled={Boolean(mutatingKey) || !pubDocId}
              onClick={() => {
                const startH = pubSession === 'morning' ? '08:00:00+07:00' : '14:00:00+07:00';
                const endH = pubSession === 'morning' ? '12:00:00+07:00' : '18:00:00+07:00';
                void safeRun(`pub-${pubDocId}-${pubDate}-${pubSession}`, {
                  action: 'publish_schedule',
                  practitionerId: pubDocId,
                  startsAt: new Date(`${pubDate}T${startH}`).toISOString(),
                  endsAt: new Date(`${pubDate}T${endH}`).toISOString(),
                  slotDurationMinutes: 60,
                  capacity: 3,
                });
              }}
              style={primaryBtnStyle}
            >
              Công bố lịch
            </button>
          </section>
        </article>
      )}

      <section className="table-wrap" aria-busy={loading}>
        <table className="mc-table">
          <caption>Hàng đợi phòng khám</caption>
          <thead>
            <tr>
              <th scope="col">Số phiếu</th>
              <th scope="col">Bệnh nhân</th>
              <th scope="col">Bác sĩ / Giờ hẹn</th>
              <th scope="col">Trạng thái hàng đợi</th>
              <th scope="col">Hồ sơ khám</th>
              <th scope="col">Thao tác điều phối</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={6} style={{textAlign: 'center', color: MC_COLORS.textMuted, padding: '24px'}}>
                  {loading ? 'Đang tải hàng đợi...' : 'Chưa có bệnh nhân check-in trong hàng đợi.'}
                </td>
              </tr>
            ) : (
              sortedTickets.map((t) => {
                const st = QUEUE_STATUS_LABELS[t.status] ?? {label: t.status, tone: 'neutral' as const};
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: activeTicket?.id === t.id ? '#eef9f5' : undefined,
                    }}
                  >
                    <td data-label="Số phiếu" style={{fontWeight: 700}}>
                      {t.ticketNumber}
                    </td>
                    <td data-label="Bệnh nhân">
                      <strong>{t.patientName}</strong>
                      <span style={{display: 'block', fontSize: '12px', color: MC_COLORS.textSubtle}}>{t.patientCode}</span>
                    </td>
                    <td data-label="Bác sĩ">
                      <strong>{t.practitionerName}</strong>
                      <span style={{display: 'block', fontSize: '12px', color: MC_COLORS.textSubtle}}>
                        {formatVnDateTime(t.startsAt)} · {t.room}
                      </span>
                    </td>
                    <td data-label="Trạng thái">
                      <span className={`mc-badge mc-badge-${st.tone}`}>{st.label}</span>
                    </td>
                    <td data-label="Ca khám">
                      {t.encounter ? (
                        <span className="mc-badge mc-badge-neutral">
                          {t.encounter.referenceCode} ({t.encounter.observations.filter((o) => o.isLatest).length} chỉ số)
                        </span>
                      ) : (
                        <span style={{fontSize: '12px', color: MC_COLORS.textSubtle}}>Chưa mở hồ sơ</span>
                      )}
                    </td>
                    <td data-label="Thao tác">
                      <span style={{display: 'inline-flex', flexWrap: 'wrap', gap: '6px'}}>
                        {(t.status === 'CHECKED_IN' || t.status === 'WAITING') && (
                          <button
                            type="button"
                            disabled={Boolean(mutatingKey)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTicketId(t.id);
                              void safeRun(`q-call-${t.id}`, {
                                action: 'queue_transition',
                                ticketId: t.id,
                                toStatus: 'CALLED',
                              });
                            }}
                            style={primaryBtnSmallStyle}
                          >
                            <MegaphoneIcon style={{width: 14, height: 14}} />
                            <span>Gọi bệnh nhân</span>
                          </button>
                        )}
                        {!t.encounter && (t.status === 'CALLED' || t.status === 'WAITING' || t.status === 'IN_SERVICE') && (
                          (!activePractitionerId || t.practitionerId === activePractitionerId) ? (
                            <button
                              type="button"
                              disabled={Boolean(mutatingKey)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTicketId(t.id);
                                void safeRun(`enc-start-${t.appointmentId}`, {
                                  action: 'create_encounter',
                                  appointmentId: t.appointmentId,
                                  practitionerId: t.practitionerId,
                                });
                              }}
                              style={primaryBtnSmallStyle}
                            >
                              <PlusCircleIcon style={{width: 14, height: 14}} />
                              <span>Bắt đầu khám</span>
                            </button>
                          ) : (
                            <span
                              title={`Chỉ ${t.practitionerName} được phép mở ca khám`}
                              style={{fontSize: '12px', color: MC_COLORS.textSubtle, alignSelf: 'center'}}
                            >
                              Phụ trách: {t.practitionerName}
                            </span>
                          )
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicketId(t.id);
                          }}
                          style={ghostBtnStyle}
                        >
                          Chi tiết ca
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {activeTicket && activeTicket.encounter && (
        <article
          aria-label="Phiên khám đang xử lý"
          style={{
            backgroundColor: '#ffffff',
            border: `1px solid ${MC_COLORS.mintBorder}`,
            borderRadius: '14px',
            padding: '16px',
            display: 'grid',
            gap: '14px',
          }}
        >
          <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
            <section>
              <strong style={{fontSize: '15px', color: MC_COLORS.textInk}}>
                Hồ sơ khám {activeTicket.encounter.referenceCode} · Phiên bản v{activeTicket.encounter.version} (
                {activeTicket.encounter.status})
              </strong>
              <p style={{margin: '2px 0 0', fontSize: '12px', color: MC_COLORS.textMuted}}>
                CL-A: Bác sĩ có thể ghi nhiều chỉ số liên tiếp, đính chính chỉ số và chủ động bấm Xác nhận hoàn tất ca khám.
              </p>
            </section>
            {(activeTicket.encounter.status === 'OPEN' || activeTicket.encounter.status === 'IN_PROGRESS') && (
              <button
                type="button"
                disabled={Boolean(mutatingKey)}
                onClick={() =>
                  void safeRun(`complete-${activeTicket.encounter!.id}`, {
                    action: 'complete_encounter',
                    encounterId: activeTicket.encounter!.id,
                    expectedVersion: activeTicket.encounter!.version,
                  })
                }
                style={primaryBtnStyle}
              >
                <CheckBadgeIcon style={{width: 18, height: 18}} />
                <span>Xác nhận hoàn tất ca khám</span>
              </button>
            )}
          </header>

          {(activeTicket.encounter.status === 'OPEN' || activeTicket.encounter.status === 'IN_PROGRESS') && (
            <section
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                alignItems: 'flex-end',
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: MC_COLORS.surfaceSubtle,
                border: `1px solid ${MC_COLORS.mintBorder}`,
              }}
            >
              <label style={{display: 'grid', gap: '4px'}}>
                <span style={{fontSize: '12px', fontWeight: 700}}>Chỉ số sinh hiệu</span>
                <select
                  className="medicloud-select"
                  value={obsCode}
                  onChange={(e) => {
                    const chosen = OBSERVATION_CODES.find((c) => c.code === e.target.value);
                    setObsCode(e.target.value);
                    if (chosen) {
                      setObsUnit(chosen.defaultUnit);
                      setObsValue(chosen.placeholder);
                    }
                  }}
                >
                  {OBSERVATION_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{display: 'grid', gap: '4px'}}>
                <span style={{fontSize: '12px', fontWeight: 700}}>Giá trị</span>
                <input
                  type="number"
                  step="0.1"
                  value={obsValue}
                  onChange={(e) => setObsValue(e.target.value)}
                  style={{width: '110px', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`}}
                />
              </label>
              <label style={{display: 'grid', gap: '4px'}}>
                <span style={{fontSize: '12px', fontWeight: 700}}>Đơn vị</span>
                <input
                  type="text"
                  value={obsUnit}
                  onChange={(e) => setObsUnit(e.target.value)}
                  style={{width: '90px', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`}}
                />
              </label>
              <button
                type="button"
                disabled={Boolean(mutatingKey)}
                onClick={() =>
                  void safeRun(`add-obs-${activeTicket.encounter!.id}`, {
                    action: 'record_observation',
                    encounterId: activeTicket.encounter!.id,
                    code: obsCode,
                    value: Number(obsValue),
                    unit: obsUnit,
                    measuredAt: new Date().toISOString(),
                    expectedVersion: activeTicket.encounter!.version,
                  })
                }
                style={primaryBtnStyle}
              >
                + Ghi nhận chỉ số
              </button>
            </section>
          )}

          {activeTicket.encounter.observations.length > 0 && (
            <ul style={{listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '2px'}}>
              {activeTicket.encounter.observations.map((obs, idx, arr) => (
                <li
                  key={obs.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 4px',
                    borderBottom: idx < arr.length - 1 ? `1px solid #edf4f2` : 'none',
                    opacity: obs.isLatest ? 1 : 0.65,
                  }}
                >
                  <span style={{display: 'grid', gap: '2px'}}>
                    <strong style={{fontSize: '13px', color: MC_COLORS.textInk}}>
                      {obs.label}: {obs.value} {obs.unit} (v{obs.version} · {obs.status})
                    </strong>
                    <span style={{fontSize: '12px', color: MC_COLORS.textSubtle}}>
                      Đo lúc {formatVnDateTime(obs.measuredAt)}
                      {obs.amendReason ? ` · Lý do đính chính: ${obs.amendReason}` : ''}
                    </span>
                  </span>
                  {obs.isLatest && activeTicket.encounter!.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmendingObsId(obs.id);
                        setAmendValue(String(obs.value));
                        setAmendReason('');
                      }}
                      style={ghostBtnStyle}
                    >
                      Đính chính chỉ số
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {amendingObsId && (
            <section
              style={{
                padding: '12px',
                borderRadius: '10px',
                border: `1px solid ${MC_COLORS.mintBorder}`,
                backgroundColor: '#fefcf8',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <input
                type="number"
                step="0.1"
                value={amendValue}
                onChange={(e) => setAmendValue(e.target.value)}
                aria-label="Giá trị đính chính mới"
                style={{width: '100px', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`}}
              />
              <input
                type="text"
                placeholder="Lý do đính chính (>= 3 ký tự)..."
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                aria-label="Lý do đính chính"
                style={{flex: 1, minWidth: '180px', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${MC_COLORS.mintBorder}`}}
              />
              <button
                type="button"
                disabled={Boolean(mutatingKey) || amendReason.trim().length < 3}
                onClick={async () => {
                  const obs = activeTicket.encounter!.observations.find((o) => o.id === amendingObsId);
                  if (!obs) return;
                  await safeRun(`amend-${obs.id}`, {
                    action: 'amend_observation',
                    encounterId: activeTicket.encounter!.id,
                    observationId: obs.id,
                    value: Number(amendValue),
                    unit: obs.unit,
                    measuredAt: new Date().toISOString(),
                    reason: amendReason.trim(),
                    expectedVersion: obs.version,
                  });
                  setAmendingObsId(null);
                }}
                style={primaryBtnSmallStyle}
              >
                Lưu đính chính
              </button>
              <button type="button" onClick={() => setAmendingObsId(null)} style={ghostBtnStyle}>
                Hủy
              </button>
            </section>
          )}
        </article>
      )}
    </section>
  );
}

const primaryBtnStyle = {
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
} as const;

const primaryBtnSmallStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '5px 10px',
  borderRadius: '8px',
  border: `1px solid ${MC_COLORS.brandPrimary}`,
  backgroundColor: MC_COLORS.brandPrimary,
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const ghostBtnStyle = {
  padding: '5px 10px',
  borderRadius: '8px',
  border: `1px solid ${MC_COLORS.mintBorder}`,
  backgroundColor: '#ffffff',
  color: MC_COLORS.textInk,
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
} as const;
