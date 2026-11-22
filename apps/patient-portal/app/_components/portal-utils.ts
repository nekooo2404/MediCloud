import type { AppointmentStatus, CheckInStatus } from '../_lib/types';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatSlotDateTime(iso: string): string {
  if (!iso) return 'Chưa xác định';
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function appointmentStatusLabel(status: AppointmentStatus): {
  label: string;
  variant: 'green' | 'info' | 'warning' | 'error' | 'neutral';
} {
  switch (status) {
    case 'confirmed':
      return { label: 'Đã xác nhận', variant: 'green' };
    case 'pending':
      return { label: 'Chờ xác nhận', variant: 'warning' };
    case 'cancelled':
      return { label: 'Đã hủy', variant: 'error' };
    case 'completed':
      return { label: 'Hoàn thành', variant: 'info' };
  }
}

export function checkInStatusLabel(status: CheckInStatus): {
  label: string;
  variant: 'green' | 'warning' | 'neutral';
} {
  switch (status) {
    case 'checked_in':
      return { label: 'Đã tiếp nhận', variant: 'green' };
    case 'not_checked_in':
      return { label: 'Chưa tiếp nhận', variant: 'warning' };
    case 'voided':
      return { label: 'Đã vô hiệu', variant: 'neutral' };
  }
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `synthetic-portal-${crypto.randomUUID()}`;
  }
  return `synthetic-portal-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
