export const MC_COLORS = {
  brandPrimary: '#126b56',
  brandHover: '#0f5c4a',
  brandInk: '#0f6350',
  mintWash: '#e8f7f1',
  mintBorder: '#cfe0db',
  canvasBg: '#f5f8f7',
  surfaceBg: '#ffffff',
  surfaceSubtle: '#f8fbfa',
  textInk: '#153d38',
  textMuted: '#4b615d',
  textSubtle: '#526965',
  dangerText: '#b42318',
  dangerBg: '#fef3f2',
  warningText: '#9a5b13',
  warningBg: '#fef6ee',
} as const;

export const VISIT_TYPES = [
  {id: 'in_person', label: 'Khám mới chuyên khoa', note: 'Khám trực tiếp cùng bác sĩ phụ trách'},
  {id: 'follow_up', label: 'Tái khám định kỳ', note: 'Theo dõi diễn tiến bệnh án và chỉnh đơn'},
  {id: 'teleconsult', label: 'Tư vấn chỉ số từ xa', note: 'Đọc kết quả & tư vấn sinh hiệu'},
] as const;

export const VISIT_REASONS = [
  {id: 'general_checkup', label: 'Khám mới chuyên khoa'},
  {id: 'follow_up', label: 'Tái khám định kỳ'},
  {id: 'lab_review', label: 'Đọc kết quả & tư vấn sinh hiệu'},
  {id: 'symptom_consult', label: 'Khám triệu chứng & cấp thuốc'},
] as const;

export const OBSERVATION_CODES = [
  {code: 'synthetic-temperature', label: 'Thân nhiệt', defaultUnit: '°C', placeholder: '36.8'},
  {code: 'synthetic-heart-rate', label: 'Nhịp tim', defaultUnit: 'bpm', placeholder: '74'},
  {code: 'synthetic-systolic-bp', label: 'Huyết áp tâm thu', defaultUnit: 'mmHg', placeholder: '120'},
  {code: 'synthetic-diastolic-bp', label: 'Huyết áp tâm trương', defaultUnit: 'mmHg', placeholder: '80'},
  {code: 'synthetic-spo2', label: 'Độ bão hòa Oxy (SpO₂)', defaultUnit: '%', placeholder: '98'},
  {code: 'synthetic-blood-glucose', label: 'Đường huyết mao mạch', defaultUnit: 'mmol/L', placeholder: '5.4'},
] as const;

export const APPOINTMENT_STATUS_LABELS: Record<string, {label: string; tone: 'neutral' | 'success' | 'warning' | 'danger'}> = {
  PENDING: {label: 'Chờ xác nhận', tone: 'warning'},
  CONFIRMED: {label: 'Đã xác nhận', tone: 'success'},
  CANCELLED: {label: 'Đã hủy', tone: 'danger'},
  COMPLETED: {label: 'Đã hoàn tất', tone: 'neutral'},
  NO_SHOW: {label: 'Vắng mặt', tone: 'danger'},
};

export const QUEUE_STATUS_LABELS: Record<string, {label: string; tone: 'neutral' | 'success' | 'warning' | 'danger'}> = {
  CHECKED_IN: {label: 'Đã check-in', tone: 'warning'},
  WAITING: {label: 'Đang chờ gọi', tone: 'warning'},
  CALLED: {label: 'Đang mời vào', tone: 'success'},
  IN_SERVICE: {label: 'Đang khám', tone: 'success'},
  DONE: {label: 'Hoàn tất', tone: 'neutral'},
  SKIPPED: {label: 'Tạm bỏ qua', tone: 'danger'},
};

export const ENCOUNTER_STATUS_LABELS: Record<string, {label: string; tone: 'neutral' | 'success' | 'warning' | 'danger'}> = {
  OPEN: {label: 'Mới mở', tone: 'warning'},
  IN_PROGRESS: {label: 'Đang khám & đo chỉ số', tone: 'warning'},
  COMPLETED: {label: 'Đã hoàn tất', tone: 'success'},
  AMENDED: {label: 'Đã đính chính', tone: 'neutral'},
  CANCELLED: {label: 'Đã hủy', tone: 'danger'},
};

export function formatVnDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatVnTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function toGmt7DateKey(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '11';
  const day = parts.find((p) => p.type === 'day')?.value ?? '24';
  return `${y}-${m}-${day}`;
}
