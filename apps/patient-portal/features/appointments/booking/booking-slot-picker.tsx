'use client';

import {useEffect, useMemo, useState} from 'react';
import {ClockIcon} from '@heroicons/react/24/outline';
import {fetchDoctorSlots, WorkspaceClientError} from '@/lib/api/workspace-client';
import {formatVnTime, MC_COLORS, toGmt7DateKey} from '@/lib/design-tokens';
import {BookingCalendarPopover} from './booking-calendar-popover';

export interface PublishedDoctorSlot {
  id: string;
  starts_at: string;
  ends_at?: string;
  capacity: number;
  remaining: number;
}

interface BookingSlotPickerProps {
  practitionerId: string;
  practitionerName: string;
  tenantCode?: string;
  selectedSlotId: string;
  onSelectSlot: (slot: PublishedDoctorSlot) => void;
}

export function BookingSlotPicker({
  practitionerId,
  practitionerName,
  tenantCode,
  selectedSlotId,
  onSelectSlot,
}: BookingSlotPickerProps) {
  const [slots, setSlots] = useState<PublishedDoctorSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [viewMonth, setViewMonth] = useState<string>('2026-11');

  useEffect(() => {
    if (!practitionerId) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    fetchDoctorSlots(practitionerId, {tenantCode}, controller.signal)
      .then((rows) => {
        setSlots(rows);
        const firstAvailable = rows.find((s) => s.remaining > 0) ?? rows[0];
        if (firstAvailable) {
          const dateKey = toGmt7DateKey(firstAvailable.starts_at);
          setSelectedDate(dateKey);
          setViewMonth(dateKey.slice(0, 7));
          if (!selectedSlotId && firstAvailable.remaining > 0) {
            onSelectSlot(firstAvailable);
          }
        }
      })
      .catch((err) => {
        if ((err as {name?: string})?.name === 'AbortError') return;
        setLoadError(
          err instanceof WorkspaceClientError
            ? err.message
            : 'Không thể tải danh sách khung giờ đã mở.',
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [practitionerId, tenantCode]);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const slot of slots) {
      if (slot.remaining > 0) {
        set.add(toGmt7DateKey(slot.starts_at));
      }
    }
    return set;
  }, [slots]);

  const daySlots = useMemo(() => {
    if (!selectedDate) return [];
    return slots.filter((s) => toGmt7DateKey(s.starts_at) === selectedDate);
  }, [slots, selectedDate]);

  const morningSlots = daySlots.filter((s) => {
    const h = Number(formatVnTime(s.starts_at).split(':')[0] ?? 0);
    return h < 13;
  });
  const afternoonSlots = daySlots.filter((s) => {
    const h = Number(formatVnTime(s.starts_at).split(':')[0] ?? 0);
    return h >= 13;
  });

  if (loading) {
    return (
      <section aria-busy="true" style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '24px 0'}}>
        <progress className="loading-spinner" aria-label="Đang tải khung giờ đã công bố của bác sĩ" />
        <span style={{fontSize: '14px', color: MC_COLORS.textMuted}}>
          Đang tải khung giờ đã mở cho {practitionerName}...
        </span>
      </section>
    );
  }

  if (loadError) {
    return (
      <section role="alert" style={{padding: '14px', borderRadius: '12px', backgroundColor: MC_COLORS.dangerBg, color: MC_COLORS.dangerText}}>
        {loadError}
      </section>
    );
  }

  if (slots.length === 0) {
    return (
      <section style={{padding: '18px', borderRadius: '12px', border: `1px solid ${MC_COLORS.mintBorder}`, backgroundColor: MC_COLORS.surfaceSubtle}}>
        <strong style={{display: 'block', marginBottom: '4px', color: MC_COLORS.textInk}}>
          Chưa có lịch mở cho bác sĩ này
        </strong>
        <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textMuted}}>
          Hệ thống chỉ cho phép đặt vào khung giờ đã được bệnh viện công bố trên lịch bác sĩ. Vui lòng chọn bác sĩ khác hoặc liên hệ lễ tân.
        </p>
      </section>
    );
  }

  const renderSlotGroup = (title: string, items: PublishedDoctorSlot[]) => {
    if (items.length === 0) return null;
    return (
      <section style={{display: 'grid', gap: '8px'}}>
        <h4 style={{margin: 0, fontSize: '13px', fontWeight: 700, color: MC_COLORS.textMuted}}>{title}</h4>
        <section style={{display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 140px), 1fr))'}}>
          {items.map((slot) => {
            const full = slot.remaining <= 0;
            const checked = slot.id === selectedSlotId;
            const endTime = slot.ends_at
              ? formatVnTime(slot.ends_at)
              : formatVnTime(new Date(Date.parse(slot.starts_at) + 3_600_000).toISOString());
            return (
              <button
                key={slot.id}
                type="button"
                disabled={full}
                aria-pressed={checked}
                onClick={() => onSelectSlot(slot)}
                style={{
                  display: 'grid',
                  gap: '4px',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  fontVariantNumeric: 'tabular-nums',
                  cursor: full ? 'not-allowed' : 'pointer',
                  border: `1.5px solid ${
                    checked ? MC_COLORS.brandPrimary : full ? '#e6d8c5' : MC_COLORS.mintBorder
                  }`,
                  backgroundColor: checked ? '#eaf7f2' : full ? '#fdf5ea' : '#ffffff',
                  color: full ? MC_COLORS.warningText : MC_COLORS.textInk,
                }}
              >
                <span style={{display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '14px'}}>
                  <ClockIcon style={{width: 15, height: 15}} />
                  {formatVnTime(slot.starts_at)} – {endTime}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: full ? MC_COLORS.warningText : MC_COLORS.brandInk,
                  }}
                >
                  {full ? 'Hết chỗ' : `Còn ${slot.remaining} chỗ`}
                </span>
              </button>
            );
          })}
        </section>
      </section>
    );
  };

  return (
    <section
      aria-label="Bước 2: Chọn ngày và khung giờ khám đã công bố"
      style={{
        display: 'grid',
        gap: '16px',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
        alignItems: 'start',
      }}
    >
      <BookingCalendarPopover
        selectedDate={selectedDate}
        availableDates={availableDates}
        viewMonth={viewMonth}
        onChangeMonth={setViewMonth}
        onSelectDate={(dateKey) => {
          setSelectedDate(dateKey);
          const firstInDay = slots.find((s) => toGmt7DateKey(s.starts_at) === dateKey && s.remaining > 0);
          if (firstInDay) onSelectSlot(firstInDay);
        }}
      />

      <section style={{display: 'grid', gap: '14px'}}>
        <header>
          <strong style={{fontSize: '14px', color: MC_COLORS.textInk}}>
            Khung giờ đã mở ngày {selectedDate.split('-').reverse().join('/')}
          </strong>
          <p style={{margin: '2px 0 0', fontSize: '12px', color: MC_COLORS.textSubtle}}>
            Chỉ hiển thị khung giờ thực tế trên hệ thống (giờ Việt Nam UTC+7).
          </p>
        </header>
        {renderSlotGroup('Buổi sáng (08:00 – 12:00)', morningSlots)}
        {renderSlotGroup('Buổi chiều (14:00 – 18:00)', afternoonSlots)}
        {daySlots.length === 0 && (
          <p style={{margin: 0, fontSize: '13px', color: MC_COLORS.textMuted}}>
            Không có khung giờ trống trong ngày này. Vui lòng chọn ngày có chấm xanh trên lịch.
          </p>
        )}
      </section>
    </section>
  );
}
