'use client'

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  SunIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

export type VisitType = 'in_person' | 'follow_up' | 'teleconsult'
export type VisitReason =
  | 'general_checkup'
  | 'follow_up'
  | 'lab_review'
  | 'symptom_consult'

export interface BookingPatientOption {
  id: string
  code: string
  displayName: string
}

export interface BookingPractitionerOption {
  id: string
  displayName: string
  title: string
  initials: string
  room: string
  specialty: string
}

export interface BookingSlotOption {
  id: string
  startsAt: string
  endsAt: string
  capacity: number
  bookedCount: number
  remaining: number
  practitionerId: string
  practitionerName: string
  room: string
  specialty: string
}

export interface BookingConfirmPayload {
  patientId?: string
  slotId?: string
  practitionerId: string
  appointmentDate: string
  appointmentTime: string
  visitType: VisitType
  visitReason: VisitReason
  idempotencyKey: string
}

export interface BookingModalProps {
  isOpen: boolean
  isPatient: boolean
  tenantName: string
  activePatient: BookingPatientOption | null
  patients: BookingPatientOption[]
  practitioners: BookingPractitionerOption[]
  slots: BookingSlotOption[]
  preselectedSlotId?: string | null
  submitting: boolean
  serverError: string | null
  onClose: () => void
  onConfirm: (payload: BookingConfirmPayload) => Promise<void>
}

interface ResolvedTimeOption {
  time: string
  endTime: string
  period: 'morning' | 'afternoon'
  matchedSlot: BookingSlotOption | null
  isPast: boolean
  isFull: boolean
  isDisabled: boolean
  statusText: string
}

const MORNING_PRESETS = ['08:00', '09:00', '10:00', '11:00']
const AFTERNOON_PRESETS = ['14:00', '15:00', '16:00', '17:00']

const VISIT_TYPE_OPTIONS: ReadonlyArray<{ value: VisitType; label: string }> = [
  { value: 'in_person', label: 'Trực tiếp tại phòng khám' },
  { value: 'follow_up', label: 'Tái khám theo hẹn' },
  { value: 'teleconsult', label: 'Tư vấn trực tuyến' },
]

const VISIT_REASON_OPTIONS: ReadonlyArray<{ value: VisitReason; label: string }> = [
  { value: 'general_checkup', label: 'Khám mới chuyên khoa' },
  { value: 'follow_up', label: 'Tái khám định kỳ' },
  { value: 'lab_review', label: 'Đọc kết quả & tư vấn sinh hiệu' },
  { value: 'symptom_consult', label: 'Khám triệu chứng & cấp thuốc' },
]

function getVietnamDateParts(date: Date): {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  ymd: string
  hm: string
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  const rawHour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const hour = rawHour === '24' ? '00' : rawHour
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'

  return {
    year,
    month,
    day,
    hour,
    minute,
    ymd: `${year}-${month}-${day}`,
    hm: `${hour}:${minute}`,
  }
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!match) return ymd
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays),
  )
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isValidCalendarYmd(ymd: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!match) return false
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function formatYmdDisplay(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!match) return ymd
  return `${match[3]}/${match[2]}/${match[1]}`
}

function formatFullVietnameseDate(ymd: string): string {
  if (!isValidCalendarYmd(ymd)) return formatYmdDisplay(ymd)
  const d = new Date(`${ymd}T12:00:00+07:00`)
  const weekday = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
  }).format(d)
  return `${weekday}, ${formatYmdDisplay(ymd)}`
}

function parseYmdParts(ymd: string): { year: number; monthIndex0: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!match) {
    return { year: 2026, monthIndex0: 0, day: 1 }
  }
  return {
    year: Number(match[1]),
    monthIndex0: Number(match[2]) - 1,
    day: Number(match[3]),
  }
}

function addMonths(
  year: number,
  monthIndex0: number,
  delta: number,
): { year: number; monthIndex0: number } {
  const dt = new Date(Date.UTC(year, monthIndex0 + delta, 1))
  return {
    year: dt.getUTCFullYear(),
    monthIndex0: dt.getUTCMonth(),
  }
}

function formatMonthYearKey(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`
}

function clampYmd(ymd: string, minYmd: string, maxYmd: string): string {
  if (ymd < minYmd) return minYmd
  if (ymd > maxYmd) return maxYmd
  return ymd
}

function buildCalendarMonthCells(
  year: number,
  monthIndex0: number,
): ReadonlyArray<{ ymd: string; dayNumber: number; inCurrentMonth: boolean }> {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex0, 1))
  const mondayFirstOffset = (firstOfMonth.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate()
  const totalCells = mondayFirstOffset + daysInMonth > 35 ? 42 : 35
  const gridStart = new Date(Date.UTC(year, monthIndex0, 1 - mondayFirstOffset))

  const cells: Array<{ ymd: string; dayNumber: number; inCurrentMonth: boolean }> = []
  for (let i = 0; i < totalCells; i += 1) {
    const cellDate = new Date(
      Date.UTC(
        gridStart.getUTCFullYear(),
        gridStart.getUTCMonth(),
        gridStart.getUTCDate() + i,
      ),
    )
    const cy = cellDate.getUTCFullYear()
    const cm = String(cellDate.getUTCMonth() + 1).padStart(2, '0')
    const cd = String(cellDate.getUTCDate()).padStart(2, '0')
    cells.push({
      ymd: `${cy}-${cm}-${cd}`,
      dayNumber: cellDate.getUTCDate(),
      inCurrentMonth: cy === year && cellDate.getUTCMonth() === monthIndex0,
    })
  }
  return cells
}

const CALENDAR_WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const

function formatQuickDateChip(
  ymd: string,
  todayYmd: string,
  tomorrowYmd: string,
): { label: string; sub: string } {
  const shortDate = ymd.slice(8, 10) + '/' + ymd.slice(5, 7)
  if (ymd === todayYmd) return { label: 'Hôm nay', sub: shortDate }
  if (ymd === tomorrowYmd) return { label: 'Ngày mai', sub: shortDate }
  const d = new Date(`${ymd}T12:00:00+07:00`)
  const weekday = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
  }).format(d)
  return { label: weekday, sub: shortDate }
}

function computeEndTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  const nextHour = Number(hStr) + 1
  return `${String(nextHour).padStart(2, '0')}:${mStr}`
}

function buildBookingIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `synthetic-portal-${crypto.randomUUID()}`
  }
  return `synthetic-portal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const sectionBoxStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#153d38',
}

const hintStyle: CSSProperties = {
  fontSize: 12,
  color: '#526965',
  lineHeight: 1.4,
}

const inputStyle: CSSProperties = {
  border: '1px solid #cfe0db',
  borderRadius: 10,
  backgroundColor: '#ffffff',
  padding: '10px 12px',
  color: '#153d38',
  width: '100%',
  boxSizing: 'border-box',
}

const errorTextStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#b91c1c',
  lineHeight: 1.4,
}

export function BookingModal({
  isOpen,
  isPatient,
  tenantName,
  activePatient,
  patients,
  practitioners,
  slots,
  preselectedSlotId,
  submitting,
  serverError,
  onClose,
  onConfirm,
}: BookingModalProps) {
  const titleId = useId()
  const formId = useId()
  const patientSelectId = useId()
  const specialtyGroupId = useId()
  const dateInputId = useId()
  const dateHintId = useId()
  const dateErrorId = useId()
  const calendarPopoverId = useId()
  const timeErrorId = useId()
  const patientErrorId = useId()
  const doctorErrorId = useId()
  const reasonSelectId = useId()
  const noteInputId = useId()
  const noteHintId = useId()

  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const patientSelectRef = useRef<HTMLSelectElement | null>(null)
  const firstDoctorRadioRef = useRef<HTMLInputElement | null>(null)
  const dateTriggerRef = useRef<HTMLButtonElement | null>(null)
  const calendarPopoverRef = useRef<HTMLDivElement | null>(null)
  const calendarGridRef = useRef<HTMLDivElement | null>(null)
  const firstEnabledTimeRef = useRef<HTMLInputElement | null>(null)
  const announceTimerRef = useRef<number | undefined>(undefined)

  const vnNow = getVietnamDateParts(new Date())
  const todayYmd = vnNow.ymd
  const tomorrowYmd = addDaysToYmd(todayYmd, 1)
  const maxYmd = addDaysToYmd(todayYmd, 90)
  const initialDateParts = parseYmdParts(todayYmd)

  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState('ALL')
  const [selectedPractitionerId, setSelectedPractitionerId] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayYmd)
  const [selectedTime, setSelectedTime] = useState('')
  const [visitType, setVisitType] = useState<VisitType>('in_person')
  const [visitReason, setVisitReason] = useState<VisitReason>('general_checkup')
  const [visitNote, setVisitNote] = useState('')

  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [calendarView, setCalendarView] = useState<{ year: number; monthIndex0: number }>({
    year: initialDateParts.year,
    monthIndex0: initialDateParts.monthIndex0,
  })
  const [focusedCalendarYmd, setFocusedCalendarYmd] = useState(todayYmd)

  const [touchedPatient, setTouchedPatient] = useState(false)
  const [touchedDate, setTouchedDate] = useState(false)
  const [touchedTime, setTouchedTime] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [liveAnnouncement, setLiveAnnouncement] = useState('')

  const slotIndexByKey = useMemo(() => {
    const map = new Map<string, BookingSlotOption>()
    for (const s of slots) {
      const parts = getVietnamDateParts(new Date(s.startsAt))
      map.set(`${s.practitionerId}|${parts.ymd}|${parts.hm}`, s)
    }
    return map
  }, [slots])

  const specialties = useMemo(() => {
    const set = new Set<string>()
    for (const p of practitioners) set.add(p.specialty)
    return Array.from(set)
  }, [practitioners])

  const visiblePractitioners = useMemo(() => {
    if (selectedSpecialty === 'ALL') return practitioners
    return practitioners.filter((p) => p.specialty === selectedSpecialty)
  }, [practitioners, selectedSpecialty])

  const quickDates = useMemo(
    () => [0, 1, 2, 3, 4].map((offset) => addDaysToYmd(todayYmd, offset)),
    [todayYmd],
  )

  // Initialize modal state cleanly each time it opens
  useEffect(() => {
    if (!isOpen) return

    const nowParts = getVietnamDateParts(new Date())
    const todayStr = nowParts.ymd
    const tomorrowStr = addDaysToYmd(todayStr, 1)
    const nowMs = Date.now()

    setIdempotencyKey(buildBookingIdempotencyKey())
    setSelectedPatientId((prev) =>
      prev && patients.some((p) => p.id === prev) ? prev : (patients[0]?.id ?? ''),
    )
    setSelectedSpecialty('ALL')
    setVisitType('in_person')
    setVisitReason('general_checkup')
    setVisitNote('')
    setTouchedPatient(false)
    setTouchedDate(false)
    setTouchedTime(false)
    setSubmitted(false)
    setLiveAnnouncement('')

    const preSlot = preselectedSlotId
      ? slots.find((s) => s.id === preselectedSlotId)
      : undefined

    if (preSlot) {
      const preParts = getVietnamDateParts(new Date(preSlot.startsAt))
      const clampedDate = preParts.ymd < todayStr ? todayStr : preParts.ymd
      const calParts = parseYmdParts(clampedDate)
      setSelectedPractitionerId(preSlot.practitionerId)
      setSelectedDate(clampedDate)
      setSelectedTime(preParts.hm)
      setCalendarView({ year: calParts.year, monthIndex0: calParts.monthIndex0 })
      setFocusedCalendarYmd(clampedDate)
      setIsCalendarOpen(false)
      return
    }

    const defaultDocId = practitioners[0]?.id ?? ''
    setSelectedPractitionerId(defaultDocId)

    const allPresets = [...MORNING_PRESETS, ...AFTERNOON_PRESETS]
    const hasOpenSlotOnDate = (dateYmd: string) =>
      allPresets.find((t) => {
        const ts = new Date(`${dateYmd}T${t}:00+07:00`).getTime()
        if (ts < nowMs) return false
        const dbSlot = slotIndexByKey.get(`${defaultDocId}|${dateYmd}|${t}`)
        return !dbSlot || dbSlot.remaining > 0
      })

    const todayFirstOpen = hasOpenSlotOnDate(todayStr)
    const resolvedDate = todayFirstOpen ? todayStr : tomorrowStr
    const calParts = parseYmdParts(resolvedDate)
    setSelectedDate(resolvedDate)
    setSelectedTime(todayFirstOpen ?? hasOpenSlotOnDate(tomorrowStr) ?? '08:00')
    setCalendarView({ year: calParts.year, monthIndex0: calParts.monthIndex0 })
    setFocusedCalendarYmd(resolvedDate)
    setIsCalendarOpen(false)
  }, [isOpen, patients, practitioners, preselectedSlotId, slotIndexByKey, slots])

  // Sync native Popover toggle state and auto-close popover when modal closes
  useEffect(() => {
    const popoverEl = calendarPopoverRef.current
    if (!popoverEl) return
    if (!isOpen) {
      if (popoverEl.matches(':popover-open')) {
        popoverEl.hidePopover()
      }
      setIsCalendarOpen(false)
      return
    }
    const handleToggle = (event: Event) => {
      const open = (event as Event & { newState?: string }).newState === 'open'
      setIsCalendarOpen(open)
    }
    popoverEl.addEventListener('toggle', handleToggle)
    return () => {
      popoverEl.removeEventListener('toggle', handleToggle)
    }
  }, [isOpen])

  // Sync native <dialog> top-layer modal open/close state
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  // Safari fallback for closedby="any" light-dismiss
  useEffect(() => {
    const dialog = dialogRef.current
    if (!isOpen || !dialog) return
    if ('closedBy' in HTMLDialogElement.prototype) return

    let pressedOutside = false
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect()
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
    }
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = !isCalendarOpen && isOutside(e)
    }
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && !isCalendarOpen && isOutside(e) && !submitting) {
        dialog.close()
      }
      pressedOutside = false
    }
    dialog.addEventListener('pointerdown', onPointerDown)
    dialog.addEventListener('pointerup', onPointerUp)
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown)
      dialog.removeEventListener('pointerup', onPointerUp)
    }
  }, [isCalendarOpen, isOpen, submitting])

  useEffect(() => {
    return () => window.clearTimeout(announceTimerRef.current)
  }, [])

  const dateValidationError = useMemo(() => {
    if (!selectedDate) return 'Vui lòng chọn ngày khám.'
    if (!isValidCalendarYmd(selectedDate)) return 'Ngày khám không đúng định dạng hợp lệ.'
    if (selectedDate < todayYmd) return 'Ngày khám không thể là ngày đã qua.'
    if (selectedDate > maxYmd) return 'Chỉ hỗ trợ đặt lịch trong vòng 90 ngày tới.'
    return null
  }, [maxYmd, selectedDate, todayYmd])

  const timeOptions = useMemo<ResolvedTimeOption[]>(() => {
    if (!selectedPractitionerId || !isValidCalendarYmd(selectedDate)) return []

    const timeSet = new Set<string>([...MORNING_PRESETS, ...AFTERNOON_PRESETS])
    for (const s of slots) {
      if (s.practitionerId !== selectedPractitionerId) continue
      const parts = getVietnamDateParts(new Date(s.startsAt))
      if (parts.ymd === selectedDate) {
        timeSet.add(parts.hm)
      }
    }

    const sortedTimes = Array.from(timeSet).sort()
    const nowMs = Date.now()

    return sortedTimes.map((time) => {
      const hourNum = Number(time.slice(0, 2))
      const period: 'morning' | 'afternoon' = hourNum < 12 ? 'morning' : 'afternoon'
      const matchedSlot =
        slotIndexByKey.get(`${selectedPractitionerId}|${selectedDate}|${time}`) ?? null
      const slotMs = new Date(`${selectedDate}T${time}:00+07:00`).getTime()
      const isPast = Number.isNaN(slotMs) || slotMs < nowMs
      const isFull = matchedSlot != null && matchedSlot.remaining <= 0
      const isDisabled = isPast || isFull

      let statusText = 'Còn trống'
      if (isPast) {
        statusText = 'Đã qua'
      } else if (isFull) {
        statusText = 'Hết chỗ'
      } else if (matchedSlot) {
        statusText = `Còn ${matchedSlot.remaining}/${matchedSlot.capacity} chỗ`
      }

      return {
        time,
        endTime: computeEndTime(time),
        period,
        matchedSlot,
        isPast,
        isFull,
        isDisabled,
        statusText,
      }
    })
  }, [selectedDate, selectedPractitionerId, slotIndexByKey, slots])

  const morningOptions = useMemo(
    () => timeOptions.filter((o) => o.period === 'morning'),
    [timeOptions],
  )
  const afternoonOptions = useMemo(
    () => timeOptions.filter((o) => o.period === 'afternoon'),
    [timeOptions],
  )

  const morningOpenCount = useMemo(
    () => morningOptions.filter((o) => !o.isDisabled).length,
    [morningOptions],
  )
  const afternoonOpenCount = useMemo(
    () => afternoonOptions.filter((o) => !o.isDisabled).length,
    [afternoonOptions],
  )
  const totalOpenCount = morningOpenCount + afternoonOpenCount

  const nextAvailableSuggestion = useMemo(() => {
    if (totalOpenCount > 0 || !selectedPractitionerId) return null
    const all = [...MORNING_PRESETS, ...AFTERNOON_PRESETS]
    const nowMs = Date.now()
    for (let offset = 0; offset <= 30; offset += 1) {
      const candidateYmd = addDaysToYmd(todayYmd, offset)
      if (candidateYmd === selectedDate || candidateYmd > maxYmd) continue
      const firstOpen = all.find((t) => {
        const ts = new Date(`${candidateYmd}T${t}:00+07:00`).getTime()
        if (Number.isNaN(ts) || ts < nowMs) return false
        const dbSlot = slotIndexByKey.get(`${selectedPractitionerId}|${candidateYmd}|${t}`)
        return !dbSlot || dbSlot.remaining > 0
      })
      if (firstOpen) {
        return { ymd: candidateYmd, time: firstOpen }
      }
    }
    return null
  }, [maxYmd, selectedDate, selectedPractitionerId, slotIndexByKey, todayYmd, totalOpenCount])

  const calendarCells = useMemo(
    () => buildCalendarMonthCells(calendarView.year, calendarView.monthIndex0),
    [calendarView.monthIndex0, calendarView.year],
  )

  const minMonthKey = formatMonthYearKey(
    parseYmdParts(todayYmd).year,
    parseYmdParts(todayYmd).monthIndex0,
  )
  const maxMonthKey = formatMonthYearKey(
    parseYmdParts(maxYmd).year,
    parseYmdParts(maxYmd).monthIndex0,
  )
  const currentMonthKey = formatMonthYearKey(calendarView.year, calendarView.monthIndex0)
  const canGoPrevMonth = currentMonthKey > minMonthKey
  const canGoNextMonth = currentMonthKey < maxMonthKey

  const selectBookingDate = (ymd: string, closeCalendar: boolean) => {
    const clamped = clampYmd(ymd, todayYmd, maxYmd)
    const parts = parseYmdParts(clamped)
    setSelectedDate(clamped)
    setTouchedDate(true)
    setFocusedCalendarYmd(clamped)
    setCalendarView({ year: parts.year, monthIndex0: parts.monthIndex0 })
    if (closeCalendar) {
      const popoverEl = calendarPopoverRef.current
      if (popoverEl && popoverEl.matches(':popover-open')) {
        popoverEl.hidePopover()
      }
      dateTriggerRef.current?.focus()
    }
  }

  const handleCalendarGridKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cellYmd: string) => {
    let targetYmd: string | null = null
    if (event.key === 'ArrowLeft') {
      targetYmd = addDaysToYmd(cellYmd, -1)
    } else if (event.key === 'ArrowRight') {
      targetYmd = addDaysToYmd(cellYmd, 1)
    } else if (event.key === 'ArrowUp') {
      targetYmd = addDaysToYmd(cellYmd, -7)
    } else if (event.key === 'ArrowDown') {
      targetYmd = addDaysToYmd(cellYmd, 7)
    } else if (event.key === 'Home') {
      const p = parseYmdParts(cellYmd)
      const mondayOffset = (new Date(Date.UTC(p.year, p.monthIndex0, p.day)).getUTCDay() + 6) % 7
      targetYmd = addDaysToYmd(cellYmd, -mondayOffset)
    } else if (event.key === 'End') {
      const p = parseYmdParts(cellYmd)
      const mondayOffset = (new Date(Date.UTC(p.year, p.monthIndex0, p.day)).getUTCDay() + 6) % 7
      targetYmd = addDaysToYmd(cellYmd, 6 - mondayOffset)
    } else if (event.key === 'PageUp') {
      const prev = addMonths(calendarView.year, calendarView.monthIndex0, -1)
      const day = Math.min(parseYmdParts(cellYmd).day, 28)
      targetYmd = `${prev.year}-${String(prev.monthIndex0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    } else if (event.key === 'PageDown') {
      const next = addMonths(calendarView.year, calendarView.monthIndex0, 1)
      const day = Math.min(parseYmdParts(cellYmd).day, 28)
      targetYmd = `${next.year}-${String(next.monthIndex0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    if (!targetYmd) return
    event.preventDefault()
    const clampedTarget = clampYmd(targetYmd, todayYmd, maxYmd)
    const targetParts = parseYmdParts(clampedTarget)
    setFocusedCalendarYmd(clampedTarget)
    setCalendarView({ year: targetParts.year, monthIndex0: targetParts.monthIndex0 })
    window.requestAnimationFrame(() => {
      const btn = calendarGridRef.current?.querySelector<HTMLButtonElement>(
        `button[data-ymd="${clampedTarget}"]`,
      )
      btn?.focus()
    })
  }

  const selectedTimeOption = useMemo(
    () => timeOptions.find((o) => o.time === selectedTime && !o.isDisabled) ?? null,
    [selectedTime, timeOptions],
  )

  // Keep selected time aligned when doctor/date changes
  useEffect(() => {
    if (!isOpen || !selectedPractitionerId || dateValidationError) return
    const current = timeOptions.find((o) => o.time === selectedTime)
    if (current && !current.isDisabled) return
    const firstValid = timeOptions.find((o) => !o.isDisabled)
    setSelectedTime(firstValid?.time ?? '')
  }, [dateValidationError, isOpen, selectedPractitionerId, selectedTime, timeOptions])

  const selectedPractitioner = useMemo(
    () => practitioners.find((p) => p.id === selectedPractitionerId) ?? null,
    [practitioners, selectedPractitionerId],
  )

  const showPatientError = !isPatient && (touchedPatient || submitted) && !selectedPatientId
  const showDoctorError = submitted && !selectedPractitionerId
  const showDateError = (touchedDate || submitted) && Boolean(dateValidationError)
  const showTimeError = (touchedTime || submitted) && !selectedTimeOption

  const announceError = (message: string) => {
    window.clearTimeout(announceTimerRef.current)
    setLiveAnnouncement('')
    announceTimerRef.current = window.setTimeout(() => {
      setLiveAnnouncement(message)
    }, 500)
  }

  const handleSpecialtyChange = (nextSpecialty: string) => {
    setSelectedSpecialty(nextSpecialty)
    const nextList =
      nextSpecialty === 'ALL'
        ? practitioners
        : practitioners.filter((p) => p.specialty === nextSpecialty)
    if (nextList.length > 0 && !nextList.some((p) => p.id === selectedPractitionerId)) {
      setSelectedPractitionerId(nextList[0].id)
    }
  }

  const countOpenSlotsForDoctorOnDate = (practitionerId: string, ymd: string): number => {
    if (!isValidCalendarYmd(ymd)) return 0
    const all = [...MORNING_PRESETS, ...AFTERNOON_PRESETS]
    const nowMs = Date.now()
    let open = 0
    for (const t of all) {
      if (new Date(`${ymd}T${t}:00+07:00`).getTime() < nowMs) continue
      const dbSlot = slotIndexByKey.get(`${practitionerId}|${ymd}|${t}`)
      if (!dbSlot || dbSlot.remaining > 0) open += 1
    }
    return open
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)

    if (!isPatient && !selectedPatientId) {
      announceError('Hồ sơ người bệnh: Vui lòng chọn hồ sơ người bệnh cần đặt lịch.')
      patientSelectRef.current?.focus()
      return
    }
    if (!selectedPractitionerId) {
      announceError('Bác sĩ phụ trách: Vui lòng chọn bác sĩ khám.')
      firstDoctorRadioRef.current?.focus()
      return
    }
    if (dateValidationError) {
      announceError(`Ngày khám: ${dateValidationError}`)
      dateTriggerRef.current?.focus()
      return
    }
    if (!selectedTimeOption) {
      announceError('Khung giờ khám: Vui lòng chọn một khung giờ còn trống.')
      firstEnabledTimeRef.current?.focus()
      return
    }

    await onConfirm({
      patientId: isPatient ? activePatient?.id : selectedPatientId,
      slotId: selectedTimeOption.matchedSlot?.id,
      practitionerId: selectedPractitionerId,
      appointmentDate: selectedDate,
      appointmentTime: selectedTimeOption.time,
      visitType,
      visitReason,
      idempotencyKey,
    })
  }

  const selectedVisitTypeLabel =
    VISIT_TYPE_OPTIONS.find((v) => v.value === visitType)?.label ?? ''
  const selectedVisitReasonLabel =
    VISIT_REASON_OPTIONS.find((r) => r.value === visitReason)?.label ?? ''

  let assignedFirstTimeRef = false

  return (
    <dialog
      ref={dialogRef}
      className="booking-dialog"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      onCancel={(e) => {
        if (submitting) {
          e.preventDefault()
        }
      }}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = ''
        }
        onClose()
      }}
    >
      {isOpen && (
        <form
          id={formId}
          method="post"
          noValidate
          onSubmit={(e) => void handleSubmit(e)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            maxHeight: '90vh',
          }}
        >
          <div
            style={{
              padding: '18px 22px',
              borderBottom: '1px solid #e8efed',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <div>
              <h1
                id={titleId}
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  letterSpacing: '-0.02em',
                  color: '#153d38',
                }}
              >
                {isPatient ? 'Đặt lịch khám bệnh' : 'Tiếp nhận & Đặt lịch khám mới'}
              </h1>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  color: '#526965',
                  lineHeight: 1.45,
                }}
              >
                {tenantName} · Chọn bác sĩ, ngày khám, khung giờ và thông tin tiếp nhận
              </p>
            </div>
            <button
              type="button"
              aria-label="Đóng cửa sổ đặt lịch"
              disabled={submitting}
              onClick={() => dialogRef.current?.close()}
              style={{
                border: '1px solid #cfe0db',
                backgroundColor: '#ffffff',
                color: '#254440',
                width: 36,
                height: 36,
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <XMarkIcon width={18} height={18} />
            </button>
          </div>

          <div
            style={{
              padding: '18px 22px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              flex: 1,
            }}
          >
            {serverError && (
              <div
                role="alert"
                style={{
                  padding: '11px 14px',
                  borderRadius: 12,
                  backgroundColor: '#fff1f0',
                  border: '1px solid #ffa39e',
                  color: '#b91c1c',
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                <strong>Không thể hoàn tất đặt lịch:</strong> {serverError}
              </div>
            )}

            {/* 1. Patient Profile */}
            {isPatient ? (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  backgroundColor: '#f2f8f6',
                  border: '1px solid #cfe0db',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: '#254440',
                }}
              >
                <UserIcon width={18} height={18} color="#0f6350" style={{ flexShrink: 0 }} />
                <div>
                  Hồ sơ người bệnh:{' '}
                  <strong style={{ color: '#153d38' }}>
                    {activePatient?.displayName ?? '--'}
                  </strong>{' '}
                  · Mã hồ sơ{' '}
                  <strong style={{ color: '#153d38', fontVariantNumeric: 'tabular-nums' }}>
                    {activePatient?.code ?? '--'}
                  </strong>
                </div>
              </div>
            ) : (
              <div style={sectionBoxStyle}>
                <label htmlFor={patientSelectId} style={labelStyle}>
                  Hồ sơ người bệnh <span aria-hidden="true">*</span>
                </label>
                <select
                  ref={patientSelectRef}
                  id={patientSelectId}
                  name="patientId"
                  required
                  className="booking-control medicloud-select"
                  value={selectedPatientId}
                  aria-invalid={showPatientError ? 'true' : 'false'}
                  aria-describedby={showPatientError ? patientErrorId : undefined}
                  onBlur={() => {
                    setTouchedPatient(true)
                    if (!selectedPatientId) {
                      announceError('Hồ sơ người bệnh: Vui lòng chọn hồ sơ người bệnh.')
                    }
                  }}
                  onChange={(e) => {
                    setSelectedPatientId(e.target.value)
                    setTouchedPatient(true)
                  }}
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} · Mã {p.code}
                    </option>
                  ))}
                </select>
                {showPatientError && (
                  <div id={patientErrorId} style={errorTextStyle}>
                    Vui lòng chọn hồ sơ người bệnh trước khi đặt lịch.
                  </div>
                )}
              </div>
            )}

            {/* 2. Specialty Filter & Doctor Picker */}
            <div style={sectionBoxStyle}>
              <div
                id={specialtyGroupId}
                style={{ fontSize: 12, fontWeight: 700, color: '#4b615d' }}
              >
                Lọc theo chuyên khoa
              </div>
              <div
                role="group"
                aria-labelledby={specialtyGroupId}
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
              >
                <button
                  type="button"
                  aria-pressed={selectedSpecialty === 'ALL'}
                  onClick={() => handleSpecialtyChange('ALL')}
                  style={{
                    border:
                      selectedSpecialty === 'ALL' ? '1px solid #126b56' : '1px solid #cfe0db',
                    borderRadius: 8,
                    backgroundColor: selectedSpecialty === 'ALL' ? '#e8f7f1' : '#ffffff',
                    color: selectedSpecialty === 'ALL' ? '#0f6350' : '#254440',
                    padding: '7px 12px',
                    fontSize: 12,
                    fontWeight: selectedSpecialty === 'ALL' ? 700 : 600,
                    cursor: 'pointer',
                  }}
                >
                  Tất cả chuyên khoa
                </button>
                {specialties.map((spec) => {
                  const active = selectedSpecialty === spec
                  return (
                    <button
                      key={spec}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleSpecialtyChange(spec)}
                      style={{
                        border: active ? '1px solid #126b56' : '1px solid #cfe0db',
                        borderRadius: 8,
                        backgroundColor: active ? '#e8f7f1' : '#ffffff',
                        color: active ? '#0f6350' : '#254440',
                        padding: '7px 12px',
                        fontSize: 12,
                        fontWeight: active ? 700 : 600,
                        cursor: 'pointer',
                      }}
                    >
                      {spec}
                    </button>
                  )
                })}
              </div>

              <fieldset
                style={{
                  border: 0,
                  margin: '6px 0 0',
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
                aria-describedby={showDoctorError ? doctorErrorId : undefined}
              >
                <legend style={{ ...labelStyle, marginBottom: 4 }}>
                  Bác sĩ phụ trách <span aria-hidden="true">*</span>
                </legend>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 10,
                  }}
                >
                  {visiblePractitioners.map((doc, idx) => {
                    const checked = selectedPractitionerId === doc.id
                    const openCount = countOpenSlotsForDoctorOnDate(doc.id, selectedDate)
                    return (
                      <label
                        key={doc.id}
                        className="booking-radio-card"
                        data-disabled="false"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: checked ? '1px solid #126b56' : '1px solid #cfe0db',
                          backgroundColor: checked ? '#eefaf5' : '#ffffff',
                          boxShadow: checked ? 'inset 0 0 0 1px #126b56' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          ref={idx === 0 ? firstDoctorRadioRef : undefined}
                          type="radio"
                          name="practitionerId"
                          value={doc.id}
                          checked={checked}
                          onChange={() => setSelectedPractitionerId(doc.id)}
                          className="sr-only-control"
                        />
                        <span
                          aria-hidden="true"
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            backgroundColor: checked ? '#126b56' : '#e6f2ec',
                            color: checked ? '#ffffff' : '#0f6350',
                            fontSize: 13,
                            fontWeight: 700,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {doc.initials}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              display: 'block',
                              fontSize: 14,
                              fontWeight: 700,
                              color: '#153d38',
                              lineHeight: 1.35,
                            }}
                          >
                            {doc.displayName}
                          </span>
                          <span
                            style={{
                              display: 'block',
                              fontSize: 12,
                              color: '#526965',
                              marginTop: 2,
                              lineHeight: 1.4,
                            }}
                          >
                            {doc.specialty} · {doc.room}
                          </span>
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              color: openCount > 0 ? '#0f6350' : '#924c08',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {openCount > 0
                              ? `${openCount} khung giờ khả dụng ngày ${formatYmdDisplay(selectedDate)}`
                              : `Hết lịch trống ngày ${formatYmdDisplay(selectedDate)}`}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            border: checked ? '1px solid #126b56' : '1.5px solid #b8d2cb',
                            backgroundColor: checked ? '#126b56' : '#ffffff',
                            color: '#ffffff',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {checked && <CheckIcon width={12} height={12} strokeWidth={2.5} />}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {showDoctorError && (
                  <div id={doctorErrorId} style={errorTextStyle}>
                    Vui lòng chọn bác sĩ phụ trách.
                  </div>
                )}
              </fieldset>
            </div>

            {/* 3. Appointment Date (Custom MediCloud Vietnamese Calendar Picker) */}
            <div style={sectionBoxStyle}>
              <label
                htmlFor={dateInputId}
                style={{
                  ...labelStyle,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CalendarDaysIcon width={16} height={16} color="#0f6350" style={{ flexShrink: 0 }} />
                <span>
                  Ngày khám <span aria-hidden="true">*</span>
                </span>
              </label>
              <div id={dateHintId} style={hintStyle}>
                Chọn ngày theo múi giờ Việt Nam (GMT+7), hỗ trợ đặt trước tối đa 90 ngày.
              </div>
              <input type="hidden" name="appointmentDate" value={selectedDate} />
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <button
                  ref={dateTriggerRef}
                  id={dateInputId}
                  type="button"
                  className="booking-date-trigger"
                  popoverTarget={calendarPopoverId}
                  aria-haspopup="dialog"
                  aria-expanded={isCalendarOpen}
                  aria-controls={calendarPopoverId}
                  aria-invalid={showDateError ? 'true' : 'false'}
                  aria-describedby={showDateError ? `${dateHintId} ${dateErrorId}` : dateHintId}
                  onClick={() => {
                    const parts = parseYmdParts(
                      isValidCalendarYmd(selectedDate) ? selectedDate : todayYmd,
                    )
                    setCalendarView({ year: parts.year, monthIndex0: parts.monthIndex0 })
                    setFocusedCalendarYmd(
                      isValidCalendarYmd(selectedDate) ? selectedDate : todayYmd,
                    )
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <CalendarDaysIcon
                      width={16}
                      height={16}
                      color="#0f6350"
                      style={{ flexShrink: 0 }}
                    />
                    <span>{formatFullVietnameseDate(selectedDate)}</span>
                  </span>
                  <ChevronDownIcon
                    width={16}
                    height={16}
                    color="#0f6350"
                    style={{
                      flexShrink: 0,
                      transform: isCalendarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 160ms ease',
                    }}
                  />
                </button>
                <div
                  ref={calendarPopoverRef}
                  id={calendarPopoverId}
                  popover="auto"
                  role="dialog"
                  aria-label="Chọn ngày khám"
                  className="booking-calendar-popover"
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Tháng trước"
                      disabled={!canGoPrevMonth}
                      onClick={() =>
                        setCalendarView((prev) => addMonths(prev.year, prev.monthIndex0, -1))
                      }
                      style={{
                        border: '1px solid #cfe0db',
                        borderRadius: 8,
                        backgroundColor: '#ffffff',
                        color: '#254440',
                        width: 30,
                        height: 30,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: canGoPrevMonth ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <ChevronLeftIcon width={15} height={15} />
                    </button>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#153d38',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      Tháng {calendarView.monthIndex0 + 1}, {calendarView.year}
                    </div>
                    <button
                      type="button"
                      aria-label="Tháng sau"
                      disabled={!canGoNextMonth}
                      onClick={() =>
                        setCalendarView((prev) => addMonths(prev.year, prev.monthIndex0, 1))
                      }
                      style={{
                        border: '1px solid #cfe0db',
                        borderRadius: 8,
                        backgroundColor: '#ffffff',
                        color: '#254440',
                        width: 30,
                        height: 30,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: canGoNextMonth ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <ChevronRightIcon width={15} height={15} />
                    </button>
                  </div>

                  <div
                    aria-hidden="true"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                      gap: 4,
                      marginBottom: 4,
                    }}
                  >
                    {CALENDAR_WEEKDAYS.map((wd) => (
                      <div
                        key={wd}
                        style={{
                          textAlign: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#526965',
                          paddingBlock: 4,
                        }}
                      >
                        {wd}
                      </div>
                    ))}
                  </div>

                  <div
                    ref={calendarGridRef}
                    role="grid"
                    aria-label={`Lịch Tháng ${calendarView.monthIndex0 + 1}, ${calendarView.year}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                      gap: 4,
                    }}
                  >
                    {calendarCells.map((cell) => {
                      const outOfRange = cell.ymd < todayYmd || cell.ymd > maxYmd
                      const isDisabled = outOfRange || !cell.inCurrentMonth
                      const isSelected = selectedDate === cell.ymd
                      const isToday = cell.ymd === todayYmd
                      const dayOpenCount =
                        !isDisabled && selectedPractitionerId
                          ? countOpenSlotsForDoctorOnDate(selectedPractitionerId, cell.ymd)
                          : 0
                      const activeFocusYmd = clampYmd(focusedCalendarYmd, todayYmd, maxYmd)

                      return (
                        <button
                          key={cell.ymd}
                          type="button"
                          data-ymd={cell.ymd}
                          className="booking-calendar-day"
                          disabled={isDisabled}
                          data-selected={isSelected ? 'true' : 'false'}
                          data-today={isToday ? 'true' : 'false'}
                          aria-pressed={isSelected}
                          aria-label={`${formatFullVietnameseDate(cell.ymd)}${
                            isDisabled
                              ? ' · Ngoài phạm vi đặt lịch'
                              : dayOpenCount > 0
                                ? ` · Còn ${dayOpenCount} khung giờ trống`
                                : ' · Hết lịch trống'
                          }`}
                          tabIndex={cell.ymd === activeFocusYmd && !isDisabled ? 0 : -1}
                          onClick={() => selectBookingDate(cell.ymd, true)}
                          onKeyDown={(e) => handleCalendarGridKeyDown(e, cell.ymd)}
                        >
                          <span
                            style={{
                              lineHeight: 1,
                              color: !cell.inCurrentMonth ? '#526965' : undefined,
                            }}
                          >
                            {cell.dayNumber}
                          </span>
                          {!isDisabled && (
                            <span
                              aria-hidden="true"
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: '50%',
                                backgroundColor: isSelected
                                  ? '#ffffff'
                                  : dayOpenCount > 0
                                    ? '#126b56'
                                    : '#d97706',
                              }}
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px solid #e8efed',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: '#526965',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: '#126b56',
                          display: 'inline-block',
                        }}
                      />
                      Còn lịch trống
                    </span>
                    <button
                      type="button"
                      onClick={() => selectBookingDate(todayYmd, true)}
                      style={{
                        border: 0,
                        backgroundColor: 'transparent',
                        color: '#0f6350',
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      Hôm nay
                    </button>
                  </div>
                </div>
              </div>
              {showDateError && (
                <div id={dateErrorId} style={errorTextStyle}>
                  {dateValidationError}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 2,
                }}
              >
                {quickDates.map((ymd) => {
                  const chip = formatQuickDateChip(ymd, todayYmd, tomorrowYmd)
                  const active = selectedDate === ymd
                  return (
                    <button
                      key={ymd}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectBookingDate(ymd, false)}
                      style={{
                        border: active ? '1px solid #126b56' : '1px solid #cfe0db',
                        backgroundColor: active ? '#e8f7f1' : '#ffffff',
                        color: active ? '#0f6350' : '#254440',
                        borderRadius: 10,
                        padding: '6px 11px',
                        fontSize: 12,
                        fontWeight: active ? 700 : 600,
                        fontVariantNumeric: 'tabular-nums',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>{chip.label}</span>
                      <span style={{ color: active ? '#0f6350' : '#526965' }}>{chip.sub}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 4. Time Slots (Morning / Afternoon) */}
            <fieldset
              style={{
                border: 0,
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
              aria-describedby={showTimeError ? timeErrorId : undefined}
            >
              <legend style={{ ...labelStyle, marginBottom: 2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ClockIcon width={16} height={16} color="#0f6350" style={{ flexShrink: 0 }} />
                  <span>
                    Khung giờ khám <span aria-hidden="true">*</span>
                  </span>
                </span>
              </legend>

              {!dateValidationError && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 10,
                    backgroundColor: '#f5f8f7',
                    border: '1px solid #e2ebe8',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: selectedTimeOption ? '#0f6350' : '#924c08',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <CheckCircleIcon
                      width={15}
                      height={15}
                      color={selectedTimeOption ? '#126b56' : '#924c08'}
                      style={{ flexShrink: 0 }}
                    />
                    <span>
                      {selectedTimeOption
                        ? `Đang chọn: ${selectedTimeOption.time} – ${selectedTimeOption.endTime} · 60 phút`
                        : `Không còn khung giờ trống ngày ${formatYmdDisplay(selectedDate)}`}
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      fontSize: 12,
                      color: '#4b615d',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: '#126b56',
                          display: 'inline-block',
                        }}
                      />
                      Đang chọn
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                          border: '1.5px solid #9ab9b1',
                          display: 'inline-block',
                        }}
                      />
                      Còn trống
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: '#d97706',
                          display: 'inline-block',
                        }}
                      />
                      Hết chỗ
                    </span>
                  </div>
                </div>
              )}

              {!dateValidationError && totalOpenCount === 0 && nextAvailableSuggestion && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    backgroundColor: '#fffaf0',
                    border: '1px solid #ead8b5',
                    fontSize: 12,
                    color: '#784910',
                  }}
                >
                  <span>
                    Bác sĩ đã kín hoặc qua giờ làm việc ngày {formatYmdDisplay(selectedDate)}.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      selectBookingDate(nextAvailableSuggestion.ymd, false)
                      setSelectedTime(nextAvailableSuggestion.time)
                      setTouchedTime(true)
                    }}
                    style={{
                      border: '1px solid #126b56',
                      borderRadius: 8,
                      backgroundColor: '#126b56',
                      color: '#ffffff',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      cursor: 'pointer',
                    }}
                  >
                    Chọn ngày gần nhất ({formatYmdDisplay(nextAvailableSuggestion.ymd)} ·{' '}
                    {nextAvailableSuggestion.time})
                  </button>
                </div>
              )}

              {dateValidationError ? (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px dashed #cfe0db',
                    fontSize: 13,
                    color: '#4b615d',
                  }}
                >
                  Vui lòng chọn ngày khám hợp lệ để hiển thị các khung giờ trống.
                </div>
              ) : (
                <>
                  {[
                    {
                      key: 'morning',
                      label: 'Buổi sáng',
                      range: '08:00 – 12:00',
                      openCount: morningOpenCount,
                      items: morningOptions,
                    },
                    {
                      key: 'afternoon',
                      label: 'Buổi chiều',
                      range: '14:00 – 18:00',
                      openCount: afternoonOpenCount,
                      items: afternoonOptions,
                    },
                  ].map((period) => (
                    <div
                      key={period.key}
                      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {period.key === 'morning' ? (
                            <SunIcon
                              width={15}
                              height={15}
                              color="#0f6350"
                              style={{ flexShrink: 0 }}
                            />
                          ) : (
                            <ClockIcon
                              width={15}
                              height={15}
                              color="#0f6350"
                              style={{ flexShrink: 0 }}
                            />
                          )}
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#153d38' }}>
                            {period.label}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: '#526965',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {period.range}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            padding: '2px 8px',
                            borderRadius: 999,
                            backgroundColor: period.openCount > 0 ? '#f2f8f6' : '#fff4e5',
                            color: period.openCount > 0 ? '#0f6350' : '#924c08',
                          }}
                        >
                          {period.openCount > 0
                            ? `Còn ${period.openCount}/${period.items.length} khung giờ`
                            : 'Đã kín lịch'}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(144px, 1fr))',
                          gap: 8,
                        }}
                      >
                        {period.items.map((opt) => {
                          const checked = selectedTime === opt.time && !opt.isDisabled
                          let refToAttach:
                            | ((el: HTMLInputElement | null) => void)
                            | undefined
                          if (!opt.isDisabled && !assignedFirstTimeRef) {
                            assignedFirstTimeRef = true
                            refToAttach = (el) => {
                              firstEnabledTimeRef.current = el
                            }
                          }
                          const isScarceOpen =
                            !opt.isDisabled &&
                            opt.matchedSlot != null &&
                            opt.matchedSlot.remaining === 1 &&
                            opt.matchedSlot.capacity > 1
                          return (
                            <label
                              key={opt.time}
                              className="booking-radio-card"
                              data-disabled={opt.isDisabled ? 'true' : 'false'}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                                padding: '10px 12px',
                                borderRadius: 11,
                                border: checked
                                  ? '1px solid #126b56'
                                  : opt.isFull
                                    ? '1px dashed #d9b982'
                                    : opt.isPast
                                      ? '1px solid #e2ebe8'
                                      : '1px solid #cfe0db',
                                backgroundColor: checked
                                  ? '#e8f7f1'
                                  : opt.isFull
                                    ? '#fffaf0'
                                    : opt.isPast
                                      ? '#f5f8f7'
                                      : '#ffffff',
                                boxShadow: checked ? 'inset 0 0 0 1px #126b56' : 'none',
                                cursor: opt.isDisabled ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <input
                                ref={refToAttach}
                                type="radio"
                                name="appointmentTime"
                                value={opt.time}
                                checked={checked}
                                disabled={opt.isDisabled}
                                onChange={() => {
                                  setSelectedTime(opt.time)
                                  setTouchedTime(true)
                                }}
                                className="sr-only-control"
                              />
                              <span
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 6,
                                  minHeight: 20,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                    fontVariantNumeric: 'tabular-nums',
                                    color: checked
                                      ? '#0f6350'
                                      : opt.isFull
                                        ? '#784910'
                                        : opt.isPast
                                          ? '#526965'
                                          : '#153d38',
                                    textDecoration: opt.isDisabled ? 'line-through' : 'none',
                                  }}
                                >
                                  {opt.time}
                                </span>
                                {checked ? (
                                  <span
                                    aria-hidden="true"
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: '50%',
                                      backgroundColor: '#126b56',
                                      color: '#ffffff',
                                      display: 'grid',
                                      placeItems: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <CheckIcon width={11} height={11} strokeWidth={2.5} />
                                  </span>
                                ) : opt.isFull ? (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 700,
                                      color: '#924c08',
                                      backgroundColor: '#ffedd5',
                                      borderRadius: 6,
                                      padding: '1px 6px',
                                      lineHeight: 1.35,
                                    }}
                                  >
                                    Hết chỗ
                                  </span>
                                ) : opt.isPast ? (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: '#526965',
                                    }}
                                  >
                                    Đã qua
                                  </span>
                                ) : (
                                  <span
                                    aria-hidden="true"
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: '50%',
                                      border: '1.5px solid #b8d2cb',
                                      backgroundColor: '#ffffff',
                                      flexShrink: 0,
                                    }}
                                  />
                                )}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: checked ? 600 : 500,
                                  lineHeight: 1.3,
                                  color: checked
                                    ? '#0f6350'
                                    : opt.isFull
                                      ? '#784910'
                                      : '#526965',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {opt.time} – {opt.endTime}
                                {isScarceOpen ? ' · Còn 1 chỗ' : ''}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {showTimeError && (
                <div id={timeErrorId} style={errorTextStyle}>
                  Vui lòng chọn một khung giờ khám còn trống.
                </div>
              )}
            </fieldset>

            {/* 5. Visit Type, Reason & Intake Note */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 14,
              }}
            >
              <fieldset
                style={{
                  border: 0,
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <legend style={{ ...labelStyle, marginBottom: 4 }}>Hình thức khám</legend>
                {VISIT_TYPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="medicloud-radio-option">
                    <input
                      type="radio"
                      name="visitType"
                      value={opt.value}
                      checked={visitType === opt.value}
                      className="medicloud-radio"
                      onChange={() => setVisitType(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </fieldset>

              <div style={sectionBoxStyle}>
                <label htmlFor={reasonSelectId} style={labelStyle}>
                  Mục đích khám
                </label>
                <select
                  id={reasonSelectId}
                  name="visitReason"
                  className="booking-control medicloud-select"
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value as VisitReason)}
                >
                  {VISIT_REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={sectionBoxStyle}>
              <label htmlFor={noteInputId} style={labelStyle}>
                Ghi chú tiếp nhận (tùy chọn)
              </label>
              <div id={noteHintId} style={hintStyle}>
                Tối đa 200 ký tự — hỗ trợ ghi chú hành chính, không nhập dữ liệu y tế nhạy cảm.
              </div>
              <textarea
                id={noteInputId}
                name="visitNote"
                rows={2}
                maxLength={200}
                value={visitNote}
                className="booking-control"
                aria-describedby={noteHintId}
                onChange={(e) => setVisitNote(e.target.value)}
                placeholder="Ví dụ: Cần hỗ trợ xe lăn tại sảnh, khám vào đầu giờ..."
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                }}
              />
            </div>

            {/* 6. Live Appointment Summary */}
            <div
              style={{
                padding: '13px 15px',
                borderRadius: 12,
                backgroundColor: '#f2f8f6',
                border: '1px solid #cfe0db',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 13,
                color: '#254440',
              }}
            >
              <div style={{ fontWeight: 700, color: '#153d38' }}>Tóm tắt lịch hẹn dự kiến</div>
              <div>
                <strong>Bác sĩ:</strong>{' '}
                {selectedPractitioner
                  ? `${selectedPractitioner.displayName} · ${selectedPractitioner.specialty} (${selectedPractitioner.room})`
                  : 'Chưa chọn'}
              </div>
              <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                <strong>Ngày & giờ khám:</strong> {formatYmdDisplay(selectedDate)} ·{' '}
                {selectedTimeOption
                  ? `${selectedTimeOption.time} – ${selectedTimeOption.endTime} (GMT+7)`
                  : 'Chưa chọn khung giờ'}
              </div>
              <div>
                <strong>Hình thức & mục đích:</strong> {selectedVisitTypeLabel} ·{' '}
                {selectedVisitReasonLabel}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 22px',
              borderTop: '1px solid #e8efed',
              backgroundColor: '#fafcfb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              disabled={submitting}
              onClick={() => dialogRef.current?.close()}
              style={{
                border: '1px solid #cfe0db',
                borderRadius: 10,
                backgroundColor: '#ffffff',
                color: '#254440',
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                border: 0,
                borderRadius: 10,
                backgroundColor: '#126b56',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(18, 107, 86, 0.2)',
              }}
            >
              <CheckCircleIcon width={16} height={16} />
              {submitting ? 'Đang xử lý...' : 'Xác nhận đặt lịch'}
            </button>
          </div>
        </form>
      )}
      <div aria-live="polite" className="sr-only-control">
        {liveAnnouncement}
      </div>
    </dialog>
  )
}
