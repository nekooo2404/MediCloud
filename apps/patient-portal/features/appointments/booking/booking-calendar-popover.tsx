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

function daysInGregorianMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Tomohiko Sakamoto day-of-week: returns Monday=0..Sunday=6 without Date.UTC drift. */
function mondayOffsetForFirstOfMonth(year: number, month: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let y = year;
  if (month < 3) y -= 1;
  const sunZero = (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[month - 1]! + 1) % 7;
  return (sunZero + 6) % 7;
}

const MONTH_LABELS_VI = [
  'tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6',
  'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12',
] as const;

function formatMonthLabel(year: number, month: number): string {
  const temporalApi = (globalThis as {Temporal?: {PlainYearMonth?: {from: (v: {year: number; month: number; calendar: string}) => {toLocaleString: (locale: string, opts: Intl.DateTimeFormatOptions) => string}}}}).Temporal;
  if (temporalApi?.PlainYearMonth) {
    try {
      return temporalApi.PlainYearMonth.from({year, month, calendar: 'iso8601'}).toLocaleString('vi-VN', {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      // fallback below
    }
  }
  return `${MONTH_LABELS_VI[(month - 1 + 12) % 12] ?? 'tháng 1'} năm ${year}`;
}

function addMonths(monthStr: string, delta: number): string {
  const {year, month} = parseMonth(monthStr);
  const temporalApi = (globalThis as {Temporal?: {PlainYearMonth?: {from: (v: {year: number; month: number; calendar: string}) => {add: (d: {months: number}) => {year: number; month: number}}}}}).Temporal;
  if (temporalApi?.PlainYearMonth) {
    try {
      const next = temporalApi.PlainYearMonth.from({year, month, calendar: 'iso8601'}).add({months: delta});
      return `${next.year}-${String(next.month).padStart(2, '0')}`;
    } catch {
      // fallback below
    }
  }
  const total = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = ((total % 12) + 12) % 12 + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
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
    const mondayOffset = mondayOffsetForFirstOfMonth(year, month);
    const daysInMonth = daysInGregorianMonth(year, month);
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
