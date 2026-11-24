'use client';

import {useMemo} from 'react';
import {ChevronLeftIcon, ChevronRightIcon} from '@heroicons/react/24/outline';
import {MC_COLORS} from '@/lib/design-tokens';

interface BookingCalendarPopoverProps {
  selectedDate: string;
  availableDates: Set<string>;
  viewMonth: string; // YYYY-MM
  onChangeMonth: (nextMonth: string) => void;
  onSelectDate: (dateKey: string) => void;
}

const WEEKDAYS = ['H', 'B', 'T', 'N', 'S', 'B', 'C'];

function parseMonth(monthStr: string): {year: number; month: number} {
  const [y, m] = monthStr.split('-').map(Number);
  return {year: y || 2026, month: m || 11};
}

function formatMonthLabel(year: number, month: number): string {
  const dt = new Date(Date.UTC(year, month - 1, 15));
  return new Intl.DateTimeFormat('vi-VN', {month: 'long', year: 'numeric'}).format(dt);
}

function addMonths(monthStr: string, delta: number): string {
  const {year, month} = parseMonth(monthStr);
  const dt = new Date(Date.UTC(year, month - 1 + delta, 1));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function BookingCalendarPopover({
  selectedDate,
  availableDates,
  viewMonth,
  onChangeMonth,
  onSelectDate,
}: BookingCalendarPopoverProps) {
  const {year, month} = parseMonth(viewMonth);
  const todayKey = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
    const m = parts.find((p) => p.type === 'month')?.value ?? '11';
    const d = parts.find((p) => p.type === 'day')?.value ?? '24';
    return `${y}-${m}-${d}`;
  }, []);

  const cells = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const list: Array<{key: string; day: number; inMonth: boolean}> = [];
    for (let i = 0; i < mondayOffset; i += 1) {
      list.push({key: `pad-start-${i}`, day: 0, inMonth: false});
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      list.push({key: dateKey, day: d, inMonth: true});
    }
    return list;
  }, [year, month]);

  return (
    <section
      aria-label="Lịch chọn ngày có lịch mở"
      style={{
        border: `1px solid ${MC_COLORS.mintBorder}`,
        borderRadius: '14px',
        padding: '12px',
        backgroundColor: '#ffffff',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          gap: '8px',
        }}
      >
        <strong style={{fontSize: '14px', textTransform: 'capitalize', color: MC_COLORS.textInk}}>
          {formatMonthLabel(year, month)}
        </strong>
        <span style={{display: 'inline-flex', gap: '4px'}}>
          <button
            type="button"
            aria-label="Tháng trước"
            onClick={() => onChangeMonth(addMonths(viewMonth, -1))}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              border: `1px solid ${MC_COLORS.mintBorder}`,
              backgroundColor: '#ffffff',
              color: MC_COLORS.textInk,
              cursor: 'pointer',
              display: 'inline-grid',
              placeItems: 'center',
            }}
          >
            <ChevronLeftIcon style={{width: 16, height: 16}} />
          </button>
          <button
            type="button"
            aria-label="Tháng sau"
            onClick={() => onChangeMonth(addMonths(viewMonth, 1))}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              border: `1px solid ${MC_COLORS.mintBorder}`,
              backgroundColor: '#ffffff',
              color: MC_COLORS.textInk,
              cursor: 'pointer',
              display: 'inline-grid',
              placeItems: 'center',
            }}
          >
            <ChevronRightIcon style={{width: 16, height: 16}} />
          </button>
        </span>
      </header>

      <section
        role="grid"
        aria-label="Ngày trong tháng"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '4px',
        }}
      >
        {WEEKDAYS.map((wd, idx) => (
          <span
            key={`${wd}-${idx}`}
            style={{
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: 700,
              color: MC_COLORS.textSubtle,
              padding: '4px 0',
            }}
          >
            {wd}
          </span>
        ))}
        {cells.map((cell) => {
          if (!cell.inMonth) {
            return <span key={cell.key} aria-hidden="true" />;
          }
          const isSelected = cell.key === selectedDate;
          const isToday = cell.key === todayKey;
          const hasPublished = availableDates.has(cell.key);
          return (
            <button
              key={cell.key}
              type="button"
              className="booking-calendar-day"
              disabled={!hasPublished}
              data-selected={isSelected ? 'true' : undefined}
              data-today={isToday ? 'true' : undefined}
              aria-pressed={isSelected}
              aria-label={`Ngày ${cell.day} tháng ${month}${hasPublished ? ', có lịch mở' : ', chưa có lịch'}`}
              onClick={() => onSelectDate(cell.key)}
            >
              <span>{cell.day}</span>
              {hasPublished && (
                <span
                  aria-hidden="true"
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '999px',
                    backgroundColor: isSelected ? '#ffffff' : MC_COLORS.brandPrimary,
                  }}
                />
              )}
            </button>
          );
        })}
      </section>
    </section>
  );
}
