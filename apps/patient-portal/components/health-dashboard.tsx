'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import {
  HomeIcon, CalendarDaysIcon, ClipboardDocumentListIcon, ChatBubbleLeftRightIcon,
  HeartIcon, UserGroupIcon, BeakerIcon, DocumentTextIcon, VideoCameraIcon,
  BellIcon, MagnifyingGlassIcon, ChevronRightIcon, ArrowLeftIcon,
  ClockIcon, PlusIcon, CheckCircleIcon,
  Bars3Icon, XMarkIcon, SparklesIcon, ShieldCheckIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { BookingModal } from '@/components/booking-modal'

export type NavKey = 'overview' | 'appointments' | 'queue' | 'records' | 'vitals' | 'activity'
type StatusFilter = 'ALL' | 'WAITING' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED'
type EncounterFilter = 'ALL' | 'OPEN' | 'COMPLETED'
type ActivityFilter = 'ALL' | 'Điều trị lâm sàng' | 'Điều phối tiếp nhận' | 'Hệ thống'

interface NavItem {
  key: NavKey
  label: string
  icon: typeof HomeIcon
  badge?: string
}

interface DashboardPatient {
  id: string
  code: string
  displayName: string
  initials: string
  bloodType?: string
  allergy?: string
  status: string
}

interface DashboardPractitioner {
  id: string
  displayName: string
  title: string
  initials: string
  room: string
  specialty: string
  status: string
}

interface DashboardSlot {
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

interface DashboardAppointment {
  id: string
  referenceCode: string
  patientId: string
  patientName: string
  patientCode: string
  slotId: string
  startsAt: string
  endsAt: string
  status: string
  checkInStatus: string
  checkedInAt: string | null
  practitionerId: string
  practitionerName: string
  room: string
  specialty: string
  createdAt: string
  encounters: Array<{
    id: string
    referenceCode: string
    status: string
    createdAt: string
    completedAt: string | null
    observationsCount: number
  }>
}

interface DashboardEncounter {
  id: string
  referenceCode: string
  appointmentId: string
  patientId: string
  patientName: string
  patientCode: string
  practitionerId: string
  practitionerName: string
  specialty: string
  status: string
  startsAt: string
  createdAt: string
  completedAt: string | null
  observations: Array<{
    id: string
    code: string
    label: string
    value: number
    unit: string
    measuredAt: string
  }>
}

interface DashboardObservation {
  id: string
  encounterId: string
  encounterCode: string
  patientId: string
  patientName: string
  practitionerName: string
  code: string
  label: string
  value: number
  unit: string
  measuredAt: string
}

interface DashboardAuditEvent {
  id: string
  action: string
  actionLabel: string
  purpose: string
  occurredAt: string
}

interface DashboardResponse {
  fetchedAt: string
  role: 'patient' | 'staff'
  tenant: {
    id: string
    code: string
    name: string
    status: string
  }
  activePatient: DashboardPatient | null
  activePractitioner: DashboardPractitioner | null
  patients: DashboardPatient[]
  practitioners: DashboardPractitioner[]
  slots: DashboardSlot[]
  appointments: DashboardAppointment[]
  encounters: DashboardEncounter[]
  observations: DashboardObservation[]
  auditEvents: DashboardAuditEvent[]
  metrics: {
    totalTenantsAppointments: number
    confirmedAppointments: number
    pendingAppointments: number
    completedAppointments: number
    cancelledAppointments: number
    checkedInAppointments: number
    waitingCheckInAppointments: number
    totalEncounters: number
    openEncounters: number
    completedEncounters: number
    totalObservations: number
    availableSlotsCount: number
    staffCount: number
    outboxTotal: number
    outboxPending: number
    patientUpcomingAppointments: number
    patientTotalAppointments: number
    patientEncountersCount: number
    patientCompletedEncountersCount: number
    patientObservationsCount: number
  }
}

const styles = stylex.create({
  page: {
    minHeight: '100vh',
    backgroundColor: '#f5f8f7',
    color: '#153d38',
    fontFamily: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  shell: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: 260,
    flexShrink: 0,
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e8efed',
    padding: '24px 16px',
    display: { default: 'none', '@media (min-width: 960px)': 'flex' },
    flexDirection: 'column',
    gap: 22,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, paddingInline: 8 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    backgroundColor: '#e8f7f1',
    color: '#0f6350',
  },
  brandName: { fontSize: 18, fontWeight: 700, letterSpacing: '-0.025em', color: '#153d38' },
  brandSub: {
    color: '#526965',
    fontSize: 12,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  profile: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 10px',
    border: '1px solid #e8efed',
    borderRadius: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    borderRadius: '50%',
    backgroundColor: '#e5d8cc',
    color: '#6a4934',
    fontSize: 13,
    fontWeight: 700,
  },
  profName: { fontSize: 14, fontWeight: 700, color: '#153d38' },
  profRole: { fontSize: 12, color: '#526965', marginTop: 3 },
  navGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  groupLabel: {
    paddingInline: 10,
    fontSize: 12,
    color: '#4b615d',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    border: 0,
    backgroundColor: 'transparent',
    color: '#4b615d',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
    width: '100%',
  },
  navActive: { backgroundColor: '#e8f7f1', color: '#0f6350', fontWeight: 700 },
  navIcon: { width: 18, height: 18, flexShrink: 0 },
  navBadge: {
    marginInlineStart: 'auto',
    borderRadius: 99,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    backgroundColor: '#fff0dc',
    color: '#924c08',
  },
  sideBottom: {
    marginTop: 'auto',
    padding: '14px 12px',
    borderRadius: 14,
    backgroundColor: '#f2f8f6',
    color: '#254440',
    fontSize: 12,
    lineHeight: 1.55,
  },
  safeIcon: { width: 16, height: 16, verticalAlign: 'middle', marginInlineEnd: 6, color: '#0f6350' },
  main: { minWidth: 0, flex: 1 },
  topbar: {
    minHeight: 72,
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e8efed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingInline: 'clamp(16px, 3vw, 36px)',
    paddingBlock: 10,
    gap: 16,
    flexWrap: 'wrap',
  },
  topLeft: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  mobileMenu: {
    display: { default: 'inline-flex', '@media (min-width: 960px)': 'none' },
    border: 0,
    backgroundColor: 'transparent',
    color: '#254440',
    cursor: 'pointer',
    padding: 6,
  },
  breadcrumb: { fontSize: 13, color: '#4b615d' },
  topActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  searchInput: {
    border: '1px solid #cfe0db',
    borderRadius: 10,
    padding: '8px 12px',
    color: '#153d38',
    fontSize: 13,
    width: 240,
    maxWidth: '100%',
    backgroundColor: '#ffffff',
  },
  iconButton: {
    position: 'relative',
    width: 38,
    height: 38,
    border: '1px solid #cfe0db',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    color: '#4b615d',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  content: { maxWidth: 1440, marginInline: 'auto', padding: '24px clamp(16px, 3vw, 36px) 72px' },
  welcomeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 18,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(24px, 2.6vw, 30px)',
    letterSpacing: '-0.025em',
    lineHeight: 1.2,
    color: '#153d38',
    fontWeight: 700,
  },
  subtitle: { margin: '6px 0 0', color: '#4b615d', fontSize: 14, lineHeight: 1.5 },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 16px',
    border: 0,
    borderRadius: 10,
    backgroundColor: '#126b56',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(18, 107, 86, 0.2)',
  },
  actionIcon: { width: 16, height: 16 },
  stats: {
    display: 'grid',
    gridTemplateColumns: { default: 'repeat(2, minmax(0, 1fr))', '@media (min-width: 760px)': 'repeat(4, minmax(0, 1fr))' },
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    padding: '16px 18px',
    borderRadius: 16,
    border: '1px solid #e8efed',
    backgroundColor: '#ffffff',
    minWidth: 0,
  },
  statTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#4b615d',
    fontSize: 12,
    fontWeight: 600,
    gap: 8,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#e8f7f1',
    color: '#0f6350',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  statNum: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.025em',
    fontVariantNumeric: 'tabular-nums',
    color: '#153d38',
  },
  statHint: { marginTop: 4, fontSize: 12, color: '#526965', lineHeight: 1.4 },
  statDelta: { color: '#126b56', fontWeight: 700 },
  layout: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0,1fr)', '@media (min-width: 1100px)': 'minmax(0,1.55fr) minmax(300px,0.9fr)' },
    gap: 16,
    alignItems: 'start',
  },
  column: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
  card: { border: '1px solid #e8efed', borderRadius: 16, backgroundColor: '#ffffff', overflow: 'hidden' },
  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '16px 18px',
    borderBottom: '1px solid #e8efed',
    flexWrap: 'wrap',
  },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: '#153d38' },
  cardSub: { margin: '4px 0 0', fontSize: 12, color: '#526965', lineHeight: 1.4 },
  textButton: {
    border: 0,
    backgroundColor: 'transparent',
    color: '#126b56',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 0',
  },
  appointment: { padding: 16, borderBottom: '1px solid #e8efed' },
  apptMain: { display: 'flex', alignItems: 'center', gap: 12 },
  dateBox: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#eaf7f2',
    color: '#0f6350',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  dateNum: { fontSize: 18, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  dateDay: { marginTop: 4, fontSize: 12, fontWeight: 700 },
  appointmentInfo: { minWidth: 0, flex: 1 },
  docName: { fontSize: 14, fontWeight: 700, color: '#153d38', lineHeight: 1.35 },
  docMeta: {
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#526965',
    flexWrap: 'wrap',
    lineHeight: 1.45,
  },
  tinyIcon: { width: 14, height: 14, flexShrink: 0 },
  status: {
    padding: '5px 10px',
    borderRadius: 99,
    backgroundColor: '#e9f7f0',
    color: '#0f6350',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  statusWarning: {
    padding: '5px 10px',
    borderRadius: 99,
    backgroundColor: '#fff4e5',
    color: '#924c08',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  divider: { height: 1, backgroundColor: '#e8efed', marginBlock: 12 },
  apptActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaCaption: { fontSize: 12, color: '#526965' },
  linkGroup: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  outlineButton: {
    border: '1px solid #cfe0db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    color: '#254440',
    padding: '7px 11px',
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  outlineButtonActive: { backgroundColor: '#e8f7f1', borderColor: '#126b56', color: '#0f6350', fontWeight: 700 },
  visitButton: {
    border: 0,
    borderRadius: 8,
    backgroundColor: '#126b56',
    color: '#ffffff',
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  chartWrap: { padding: '16px 18px 18px' },
  chartTop: {
    display: 'flex',
    alignItems: 'end',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
    flexWrap: 'wrap',
  },
  chartValue: {
    fontSize: 24,
    color: '#153d38',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    fontVariantNumeric: 'tabular-nums',
  },
  chartLabel: { color: '#526965', fontSize: 12, marginTop: 4 },
  chart: { display: 'flex', alignItems: 'end', gap: 10, height: 128, borderBottom: '1px solid #e8efed', paddingInline: 4 },
  chartBarGroup: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'end',
    alignItems: 'center',
    gap: 6,
  },
  chartBarVal: { fontSize: 12, color: '#0f6350', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  chartBar: { width: '72%', maxWidth: 36, borderRadius: '6px 6px 2px 2px', backgroundColor: '#b9e6d6' },
  chartBarNow: { backgroundColor: '#126b56' },
  chartDay: { fontSize: 12, color: '#526965', textAlign: 'center' },
  chartLegend: { display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#526965', marginTop: 10 },
  legendDot: { width: 8, height: 8, borderRadius: '50%', backgroundColor: '#126b56' },
  timeline: { padding: '4px 18px 10px' },
  timelineItem: { display: 'flex', gap: 12, paddingBlock: 12, borderBottom: '1px solid #e8efed' },
  time: {
    width: 84,
    flexShrink: 0,
    color: '#4b615d',
    fontSize: 12,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    paddingTop: 2,
  },
  timeLine: { width: 2, backgroundColor: '#cfe0db', borderRadius: 2, position: 'relative', flexShrink: 0 },
  timeDot: {
    position: 'absolute',
    top: 4,
    left: -4,
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: '#126b56',
    border: '2px solid #ffffff',
    boxShadow: '0 0 0 1px #cfe0db',
  },
  timelineInfo: { minWidth: 0, flex: 1 },
  taskName: { color: '#153d38', fontSize: 13, fontWeight: 700, lineHeight: 1.4 },
  taskSub: { color: '#526965', fontSize: 12, marginTop: 4, lineHeight: 1.45 },
  taskTag: {
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 8,
    backgroundColor: '#f1f6f4',
    color: '#4b615d',
    alignSelf: 'start',
    whiteSpace: 'nowrap',
  },
  personRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: '1px solid #e8efed' },
  personAvatar: {
    width: 36,
    height: 36,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    backgroundColor: '#e6f2ec',
    color: '#0f6350',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  personInfo: { flex: 1, minWidth: 0 },
  personName: { fontSize: 13, fontWeight: 700, color: '#153d38' },
  personSub: { fontSize: 12, color: '#526965', marginTop: 3 },
  personStatus: { color: '#126b56', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' },
  carePlan: { padding: '14px 18px 18px' },
  progressTop: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4b615d' },
  progressBar: { height: 7, backgroundColor: '#e8efed', borderRadius: 9, marginTop: 9, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 9, backgroundColor: '#126b56' },
  taskLine: { display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, fontSize: 13, color: '#4b615d', lineHeight: 1.45 },
  taskDone: { color: '#126b56', fontWeight: 600 },
  taskCheck: { width: 16, height: 16, flexShrink: 0 },
  notice: {
    display: 'flex',
    gap: 11,
    padding: 14,
    borderRadius: 13,
    border: '1px solid #ead8b5',
    backgroundColor: '#fffaf0',
    color: '#735320',
    fontSize: 13,
    lineHeight: 1.55,
  },
  noticeIcon: { width: 18, height: 18, color: '#924c08', flexShrink: 0, marginTop: 2 },
  mobileNav: {
    display: { default: 'flex', '@media (min-width: 960px)': 'none' },
    position: 'fixed',
    zIndex: 4,
    insetInline: 0,
    bottom: 0,
    padding: '8px 10px calc(8px + env(safe-area-inset-bottom))',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e8efed',
    justifyContent: 'space-around',
  },
  mobileNavBtn: {
    border: 0,
    backgroundColor: 'transparent',
    color: '#4b615d',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    cursor: 'pointer',
    padding: '5px 8px',
    borderRadius: 8,
  },
  mobileNavBtnActive: { color: '#0f6350', backgroundColor: '#e8f7f1', fontWeight: 700 },
  noticeToast: {
    position: 'fixed',
    zIndex: 60,
    bottom: 78,
    insetInlineEnd: 20,
    borderRadius: 12,
    backgroundColor: '#153d38',
    color: '#ffffff',
    padding: '12px 16px',
    boxShadow: '0 10px 28px rgba(15, 38, 35, 0.22)',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 180, flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: '#254440' },
  selectInput: {
    border: '1px solid #cfe0db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: '8px 10px',
    fontSize: 13,
    color: '#153d38',
  },
  obsChipList: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  obsChip: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #cfe0db',
    backgroundColor: '#f7faf9',
    fontSize: 12,
    color: '#254440',
  },
  slotRowBtn: {
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    border: 0,
    borderBottom: '1px solid #e8efed',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  emptyBox: { padding: 20, fontSize: 13, color: '#4b615d' },
})

function formatVietnamDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return { day: '--', month: '--', time: '--:--', fullDate: '--' }
  const vnDate = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d)
  const vnTime = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)

  const day = vnDate.find((p) => p.type === 'day')?.value ?? '--'
  const monthNum = vnDate.find((p) => p.type === 'month')?.value ?? '--'
  const year = vnDate.find((p) => p.type === 'year')?.value ?? '--'

  return {
    day,
    month: `Th ${Number(monthNum)}`,
    time: vnTime,
    fullDate: `${day}/${monthNum}/${year}`,
  }
}

function formatAppointmentStatusLabel(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'Đã xác nhận'
    case 'PENDING':
      return 'Chờ xác nhận'
    case 'COMPLETED':
      return 'Đã hoàn tất'
    case 'CANCELLED':
      return 'Đã hủy'
    default:
      return status
  }
}

function formatCheckInStatusLabel(checkInStatus: string): string {
  switch (checkInStatus) {
    case 'CHECKED_IN':
      return 'Đã tiếp nhận'
    case 'NOT_CHECKED_IN':
      return 'Chưa tiếp nhận'
    case 'VOIDED':
      return 'Đã hủy tiếp nhận'
    default:
      return checkInStatus
  }
}

export function HealthDashboard({
  portalRole = 'patient',
  initialTab = 'overview',
}: {
  portalRole?: 'patient' | 'staff'
  initialTab?: NavKey
}) {
  const isPatient = portalRole === 'patient'
  const [activeTab, setActiveTab] = useState<NavKey>(initialTab)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    initialTab === 'queue' ? 'WAITING' : 'ALL',
  )
  const [encounterFilter, setEncounterFilter] = useState<EncounterFilter>('ALL')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('ALL')
  const [showAllAppointments, setShowAllAppointments] = useState(false)
  const [showAllEncounters, setShowAllEncounters] = useState(false)
  const [showAllObservations, setShowAllObservations] = useState(false)
  const [showAllAuditEvents, setShowAllAuditEvents] = useState(false)
  const [showAllWaitingQueue, setShowAllWaitingQueue] = useState(false)
  const [showAllCheckedInQueue, setShowAllCheckedInQueue] = useState(false)
  const [notice, setNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Modal popup state for appointment booking
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const [preselectedSlotId, setPreselectedSlotId] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [confirmEncounterId, setConfirmEncounterId] = useState<string | null>(null)
  const [obsValueInput, setObsValueInput] = useState('36.8')
  const [obsUnitInput, setObsUnitInput] = useState('°C')
  const [obsCodeInput, setObsCodeInput] = useState('synthetic-code-vital')

  const note = useCallback((text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 3200)
  }, [])

  const fetchDashboard = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/bff/dashboard', {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Không thể tải dữ liệu từ hệ thống.')
      }
      setData(json as DashboardResponse)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi kết nối dịch vụ y tế')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDashboard()
  }, [fetchDashboard])

  const availableSlots = useMemo(
    () => (data?.slots ?? []).filter((s) => s.remaining > 0),
    [data],
  )

  const openBookingModal = useCallback((slotId?: string) => {
    setModalError(null)
    setPreselectedSlotId(slotId ?? null)
    setMenuOpen(false)
    setIsBookingModalOpen(true)
  }, [])

  const runMutation = async (
    payload: Record<string, unknown>,
    successText: string,
    opts?: { fromModal?: boolean },
  ) => {
    setSubmitting(true)
    if (opts?.fromModal) setModalError(null)
    try {
      const res = await fetch('/api/bff/dashboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Không thể thực hiện thao tác.')
      }
      if (opts?.fromModal) {
        setIsBookingModalOpen(false)
      }
      note(successText)
      setConfirmEncounterId(null)
      await fetchDashboard({ silent: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Thao tác không thành công'
      if (opts?.fromModal) {
        setModalError(message)
      } else {
        note(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectTab = useCallback((key: NavKey) => {
    setActiveTab(key)
    setMenuOpen(false)
    setShowAllAppointments(false)
    setShowAllEncounters(false)
    setShowAllObservations(false)
    setShowAllAuditEvents(false)
    setShowAllWaitingQueue(false)
    setShowAllCheckedInQueue(false)
    setStatusFilter(key === 'queue' ? 'WAITING' : 'ALL')
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (key === 'overview') {
        url.searchParams.delete('tab')
      } else {
        url.searchParams.set('tab', key)
      }
      window.history.replaceState(window.history.state, '', url)
    }
  }, [])

  const filteredAppointments = useMemo(() => {
    let list = data?.appointments ?? []
    if (statusFilter === 'WAITING') {
      list = list.filter((a) => (a.status === 'CONFIRMED' || a.status === 'PENDING') && a.checkInStatus === 'NOT_CHECKED_IN')
    } else if (statusFilter === 'CHECKED_IN') {
      list = list.filter((a) => a.checkInStatus === 'CHECKED_IN' && a.status !== 'COMPLETED')
    } else if (statusFilter === 'COMPLETED') {
      list = list.filter((a) => a.status === 'COMPLETED')
    } else if (statusFilter === 'CANCELLED') {
      list = list.filter((a) => a.status === 'CANCELLED')
    }

    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (a) =>
        a.patientName.toLowerCase().includes(q) ||
        a.patientCode.toLowerCase().includes(q) ||
        a.practitionerName.toLowerCase().includes(q) ||
        a.specialty.toLowerCase().includes(q) ||
        a.referenceCode.toLowerCase().includes(q),
    )
  }, [data, searchQuery, statusFilter])

  const visibleAppointments = useMemo(
    () => (showAllAppointments ? filteredAppointments : filteredAppointments.slice(0, 2)),
    [filteredAppointments, showAllAppointments],
  )

  const tabAppointments = useMemo(
    () => (showAllAppointments ? filteredAppointments : filteredAppointments.slice(0, 4)),
    [filteredAppointments, showAllAppointments],
  )

  const queueWaiting = useMemo(
    () =>
      (data?.appointments ?? []).filter(
        (a) => (a.status === 'CONFIRMED' || a.status === 'PENDING') && a.checkInStatus === 'NOT_CHECKED_IN',
      ),
    [data],
  )

  const visibleQueueWaiting = useMemo(
    () => (showAllWaitingQueue ? queueWaiting : queueWaiting.slice(0, 3)),
    [queueWaiting, showAllWaitingQueue],
  )

  const queueCheckedIn = useMemo(
    () =>
      (data?.appointments ?? []).filter(
        (a) => a.status !== 'CANCELLED' && a.status !== 'COMPLETED' && a.checkInStatus === 'CHECKED_IN',
      ),
    [data],
  )

  const visibleQueueCheckedIn = useMemo(
    () => (showAllCheckedInQueue ? queueCheckedIn : queueCheckedIn.slice(0, 3)),
    [queueCheckedIn, showAllCheckedInQueue],
  )

  const filteredEncounters = useMemo(() => {
    let list = data?.encounters ?? []
    if (encounterFilter !== 'ALL') {
      list = list.filter((e) => e.status === encounterFilter)
    }
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (e) =>
        e.referenceCode.toLowerCase().includes(q) ||
        e.patientName.toLowerCase().includes(q) ||
        e.patientCode.toLowerCase().includes(q) ||
        e.practitionerName.toLowerCase().includes(q) ||
        e.specialty.toLowerCase().includes(q),
    )
  }, [data, encounterFilter, searchQuery])

  const filteredObservations = useMemo(() => {
    const list = (data?.observations ?? []).slice().reverse()
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.encounterCode.toLowerCase().includes(q) ||
        o.patientName.toLowerCase().includes(q) ||
        o.practitionerName.toLowerCase().includes(q),
    )
  }, [data, searchQuery])

  const filteredAuditEvents = useMemo(() => {
    let list = data?.auditEvents ?? []
    if (activityFilter !== 'ALL') {
      list = list.filter((ev) => ev.purpose === activityFilter)
    }
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (ev) =>
        ev.actionLabel.toLowerCase().includes(q) ||
        ev.purpose.toLowerCase().includes(q),
    )
  }, [data, activityFilter, searchQuery])

  const visibleEncounters = useMemo(
    () => (showAllEncounters ? filteredEncounters : filteredEncounters.slice(0, 4)),
    [filteredEncounters, showAllEncounters],
  )

  const visibleObservations = useMemo(
    () => (showAllObservations ? filteredObservations : filteredObservations.slice(0, 4)),
    [filteredObservations, showAllObservations],
  )

  const visibleAuditEvents = useMemo(
    () => (showAllAuditEvents ? filteredAuditEvents : filteredAuditEvents.slice(0, 4)),
    [filteredAuditEvents, showAllAuditEvents],
  )

  const patientNav: NavItem[] = useMemo(
    () => [
      { key: 'overview', label: 'Tổng quan', icon: HomeIcon },
      { key: 'appointments', label: 'Lịch khám', icon: CalendarDaysIcon, badge: String(data?.metrics.patientUpcomingAppointments ?? 0) },
      { key: 'records', label: 'Hồ sơ sức khỏe', icon: ClipboardDocumentListIcon, badge: String(data?.metrics.patientEncountersCount ?? 0) },
      { key: 'vitals', label: 'Chỉ số sinh hiệu', icon: BeakerIcon, badge: String(data?.metrics.patientObservationsCount ?? 0) },
      { key: 'activity', label: 'Lịch sử hoạt động', icon: DocumentTextIcon, badge: String(data?.auditEvents.length ?? 0) },
    ],
    [data],
  )

  const staffNav: NavItem[] = useMemo(
    () => [
      { key: 'overview', label: 'Bàn làm việc', icon: HomeIcon },
      { key: 'appointments', label: 'Lịch khám hôm nay', icon: CalendarDaysIcon, badge: String(data?.metrics.totalTenantsAppointments ?? 0) },
      { key: 'queue', label: 'Hàng đợi bệnh nhân', icon: UserGroupIcon, badge: String(data?.metrics.waitingCheckInAppointments ?? 0) },
      { key: 'records', label: 'Hồ sơ bệnh án', icon: ClipboardDocumentListIcon, badge: String(data?.metrics.openEncounters ?? 0) },
      { key: 'vitals', label: 'Chỉ số & chỉ định', icon: BeakerIcon, badge: String(data?.metrics.totalObservations ?? 0) },
      { key: 'activity', label: 'Nhật ký lâm sàng', icon: ChatBubbleLeftRightIcon, badge: String(data?.auditEvents.length ?? 0) },
    ],
    [data],
  )

  const nav = isPatient ? patientNav : staffNav
  const activeNavLabel = nav.find((item) => item.key === activeTab)?.label ?? (isPatient ? 'Tổng quan' : 'Bàn làm việc')

  const activeProfileName = isPatient
    ? data?.activePatient?.displayName ?? 'Đang tải hồ sơ...'
    : data?.activePractitioner?.displayName ?? 'Đang tải thông tin...'
  const activeProfileSub = isPatient
    ? `Mã hồ sơ: ${data?.activePatient?.code ?? '--'} · Đang hoạt động`
    : `${data?.activePractitioner?.specialty ?? '--'} · ${data?.activePractitioner?.room ?? ''}`
  const activeAvatar = isPatient
    ? data?.activePatient?.initials ?? 'BN'
    : data?.activePractitioner?.initials ?? 'BS'

  const latestObservation = data?.observations[data.observations.length - 1] ?? null

  const chartItems = useMemo(() => {
    if (!data) return []
    if (isPatient) {
      const obs = data.observations.slice(-7)
      const maxVal = Math.max(...obs.map((o) => o.value), 1)
      return obs.map((o, idx) => {
        const badge = formatVietnamDateTime(o.measuredAt)
        return {
          id: o.id,
          label: `${badge.day}/${badge.month.replace('Th ', '')}`,
          rawValue: `${o.value} ${o.unit}`,
          heightPct: Math.max(22, Math.round((o.value / maxVal) * 95)),
          isHighlight: idx === obs.length - 1,
        }
      })
    }
    const slotsSlice = data.slots.slice(0, 7)
    return slotsSlice.map((s, idx) => {
      const badge = formatVietnamDateTime(s.startsAt)
      const pct = s.capacity > 0 ? Math.max(22, Math.round((s.bookedCount / s.capacity) * 95)) : 22
      return {
        id: s.id,
        label: `${badge.day} (${badge.time})`,
        rawValue: `${s.bookedCount}/${s.capacity}`,
        heightPct: pct,
        isHighlight: idx === slotsSlice.length - 1,
      }
    })
  }, [data, isPatient])

  const completionPct = useMemo(() => {
    if (!data) return 0
    if (isPatient) {
      const total = data.metrics.patientEncountersCount
      return total > 0 ? Math.round((data.metrics.patientCompletedEncountersCount / total) * 100) : 0
    }
    const total = data.metrics.totalEncounters
    return total > 0 ? Math.round((data.metrics.completedEncounters / total) * 100) : 0
  }, [data, isPatient])

  const pageHeaderCopy = useMemo(() => {
    if (activeTab === 'overview') {
      return {
        title: isPatient
          ? `Xin chào, ${data?.activePatient?.displayName ?? '...'}`
          : `Chào buổi sáng, ${data?.activePractitioner?.displayName ?? '...'}`,
        subtitle: isPatient
          ? 'Theo dõi chỉ số sức khỏe, lịch hẹn khám và kế hoạch điều trị cá nhân của bạn.'
          : 'Quản lý danh sách tiếp nhận, điều phối ca khám lâm sàng và ghi nhận chỉ số sinh hiệu trong ngày.',
      }
    }
    if (activeTab === 'appointments') {
      return {
        title: isPatient ? 'Quản lý lịch khám của bạn' : 'Lịch khám & Tiếp nhận toàn cơ sở',
        subtitle: isPatient
          ? 'Xem chi tiết lịch hẹn, xác nhận đến khám hoặc đặt khung giờ chuyên khoa mới.'
          : 'Theo dõi trạng thái lịch hẹn, thực hiện tiếp nhận tại quầy và bắt đầu ca khám.',
      }
    }
    if (activeTab === 'queue') {
      return {
        title: 'Hàng đợi tiếp nhận & Phòng khám',
        subtitle: 'Phân loại người bệnh chờ check-in tại quầy và người bệnh đã sẵn sàng vào phòng khám.',
      }
    }
    if (activeTab === 'records') {
      return {
        title: isPatient ? 'Hồ sơ sức khỏe & Lịch sử khám bệnh' : 'Quản lý hồ sơ bệnh án lâm sàng',
        subtitle: isPatient
          ? 'Tổng hợp toàn bộ các đợt thăm khám chuyên khoa và chỉ số đã ghi nhận của bạn.'
          : 'Theo dõi các ca khám đang mở và hoàn tất ghi nhận sinh hiệu lâm sàng.',
      }
    }
    if (activeTab === 'vitals') {
      return {
        title: isPatient ? 'Chỉ số sinh hiệu & Theo dõi định kỳ' : 'Chỉ số lâm sàng & Công suất phòng khám',
        subtitle: isPatient
          ? 'Biểu đồ xu hướng và chi tiết từng lần đo sinh hiệu trong hồ sơ cá nhân.'
          : 'Cấu hình thông số đo lâm sàng và theo dõi toàn bộ kết quả đã ghi nhận.',
      }
    }
    return {
      title: isPatient ? 'Lịch sử hoạt động hồ sơ' : 'Nhật ký hoạt động lâm sàng',
      subtitle: 'Theo dõi minh bạch các thao tác đặt lịch, tiếp nhận và cập nhật hồ sơ y tế.',
    }
  }, [activeTab, isPatient, data])

  const renderAppointmentItem = (appt: DashboardAppointment) => {
    const badge = formatVietnamDateTime(appt.startsAt)
    const openEncounter = appt.encounters.find((e) => e.status === 'OPEN')
    return (
      <div key={appt.id} {...stylex.props(styles.appointment)}>
        <div {...stylex.props(styles.apptMain)}>
          <div {...stylex.props(styles.dateBox)}>
            <span {...stylex.props(styles.dateNum)}>{badge.day}</span>
            <span {...stylex.props(styles.dateDay)}>{badge.month}</span>
          </div>
          <div {...stylex.props(styles.appointmentInfo)}>
            <div {...stylex.props(styles.docName)}>
              {isPatient
                ? `Khám ${appt.specialty} · ${appt.practitionerName}`
                : `${appt.patientName} (${appt.patientCode}) · Khám ${appt.specialty}`}
            </div>
            <div {...stylex.props(styles.docMeta)}>
              <ClockIcon {...stylex.props(styles.tinyIcon)} />
              {badge.fullDate} lúc {badge.time} · {appt.room} · {appt.practitionerName}
            </div>
            <div {...stylex.props(styles.docMeta)}>
              Mã lịch hẹn: <strong>{appt.referenceCode}</strong> · Trạng thái tiếp nhận:{' '}
              <strong>{formatCheckInStatusLabel(appt.checkInStatus)}</strong>
            </div>
          </div>
          <span {...stylex.props(styles.status)}>
            {formatAppointmentStatusLabel(appt.status)}
          </span>
        </div>

        <div {...stylex.props(styles.divider)} />

        <div {...stylex.props(styles.apptActions)}>
          <span {...stylex.props(styles.metaCaption)}>
            {openEncounter
              ? `Đang mở hồ sơ khám ${openEncounter.referenceCode}`
              : appt.encounters.length > 0
                ? `Đã có ${appt.encounters.length} hồ sơ khám`
                : 'Vui lòng đến trước giờ hẹn 15 phút'}
          </span>

          <div {...stylex.props(styles.linkGroup)}>
            {appt.checkInStatus !== 'CHECKED_IN' && appt.status !== 'CANCELLED' && (
              <button
                type="button"
                disabled={submitting}
                {...stylex.props(styles.outlineButton)}
                onClick={() =>
                  void runMutation(
                    {
                      action: 'check_in',
                      appointmentId: appt.id,
                      channel: isPatient ? 'portal' : 'desk',
                    },
                    `Đã xác nhận tiếp nhận cho lịch hẹn ${appt.referenceCode}.`,
                  )
                }
              >
                <CheckCircleIcon width={13} />
                {isPatient ? 'Xác nhận đến khám' : 'Tiếp nhận (Check-in)'}
              </button>
            )}

            {!isPatient && appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && !openEncounter && (
              <button
                type="button"
                disabled={submitting}
                {...stylex.props(styles.visitButton)}
                onClick={() =>
                  void runMutation(
                    {
                      action: 'create_encounter',
                      appointmentId: appt.id,
                    },
                    `Đã mở hồ sơ khám lâm sàng cho người bệnh ${appt.patientName}.`,
                  )
                }
              >
                <VideoCameraIcon width={13} />
                Bắt đầu ca khám
              </button>
            )}

            {!isPatient && openEncounter && confirmEncounterId !== openEncounter.id && (
              <button
                type="button"
                disabled={submitting}
                {...stylex.props(styles.visitButton)}
                onClick={() => setConfirmEncounterId(openEncounter.id)}
              >
                <BeakerIcon width={13} />
                Ghi sinh hiệu & Hoàn tất
              </button>
            )}

            {!isPatient && openEncounter && confirmEncounterId === openEncounter.id && (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  {...stylex.props(styles.visitButton)}
                  onClick={() =>
                    void runMutation(
                      {
                        action: 'record_observation',
                        encounterId: openEncounter.id,
                        code: obsCodeInput,
                        value: Number(obsValueInput) || 36.8,
                        unit: obsUnitInput,
                      },
                      `Đã lưu chỉ số sinh hiệu (${obsValueInput} ${obsUnitInput}) và hoàn tất hồ sơ ${openEncounter.referenceCode}.`,
                    )
                  }
                >
                  <CheckCircleIcon width={13} />
                  Xác nhận hoàn tất ({obsValueInput} {obsUnitInput})
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  {...stylex.props(styles.outlineButton)}
                  onClick={() => setConfirmEncounterId(null)}
                >
                  Hủy
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderTrendChartCard = () => (
    <section {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.cardHead)}>
        <div>
          <h2 {...stylex.props(styles.cardTitle)}>
            {isPatient ? 'Xu hướng chỉ số sức khỏe' : 'Tình hình công suất lịch khám'}
          </h2>
          <p {...stylex.props(styles.cardSub)}>
            {isPatient
              ? 'Biến thiên chỉ số sinh hiệu qua các lần thăm khám'
              : 'Tỷ lệ lấp đầy các khung giờ khám chuyên khoa trong tuần'}
          </p>
        </div>
        {activeTab === 'overview' && (
          <button
            type="button"
            {...stylex.props(styles.textButton)}
            onClick={() => handleSelectTab('vitals')}
          >
            Xem chi tiết <ChevronRightIcon width={12} />
          </button>
        )}
      </div>

      <div {...stylex.props(styles.chartWrap)}>
        <div {...stylex.props(styles.chartTop)}>
          <div>
            <div {...stylex.props(styles.chartValue)}>
              {isPatient
                ? latestObservation
                  ? `${latestObservation.value} ${latestObservation.unit}`
                  : '36.8 °C'
                : `${data?.metrics.availableSlotsCount ?? 0} khung giờ trống`}
            </div>
            <div {...stylex.props(styles.chartLabel)}>
              {isPatient
                ? `${latestObservation?.label ?? 'Thân nhiệt'} trung bình trong ngưỡng bình thường`
                : `Tổng số khung giờ đang mở đăng ký: ${data?.slots.length ?? 0} ca`}
            </div>
          </div>
          <span {...stylex.props(styles.status)}>
            {isPatient ? 'Trong ngưỡng tốt' : 'Đang nhận đặt lịch'}
          </span>
        </div>

        <div {...stylex.props(styles.chart)} aria-label="Biểu đồ thống kê y tế">
          {chartItems.map((item) => (
            <div key={item.id} {...stylex.props(styles.chartBarGroup)}>
              <span {...stylex.props(styles.chartBarVal)}>{item.rawValue}</span>
              <div
                aria-label={`${item.label}: ${item.rawValue}`}
                {...stylex.props(styles.chartBar, item.isHighlight && styles.chartBarNow)}
                style={{ height: `${item.heightPct}%` }}
              />
              <span {...stylex.props(styles.chartDay)}>{item.label}</span>
            </div>
          ))}
        </div>

        <div {...stylex.props(styles.chartLegend)}>
          <span {...stylex.props(styles.legendDot)} />
          {isPatient
            ? 'Chỉ số sinh hiệu đo tại các đợt khám lâm sàng'
            : 'Số lượng người bệnh đã đăng ký trên tổng sức chứa mỗi ca khám'}
        </div>
      </div>
    </section>
  )

  const renderCareTeamCard = () => (
    <section {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.cardHead)}>
        <div>
          <h2 {...stylex.props(styles.cardTitle)}>
            {isPatient ? 'Đội ngũ bác sĩ chăm sóc' : 'Bác sĩ & Nhân sự trong ca trực'}
          </h2>
          <p {...stylex.props(styles.cardSub)}>
            {isPatient
              ? 'Các chuyên gia y tế phụ trách theo dõi sức khỏe của bạn'
              : 'Đang phối hợp điều trị và tiếp nhận tại cơ sở'}
          </p>
        </div>
      </div>
      {(data?.practitioners ?? []).map((prac) => (
        <Person
          key={prac.id}
          name={prac.displayName}
          specialty={`${prac.specialty} · ${prac.room}`}
          initials={prac.initials}
          status="Đang trực"
        />
      ))}
    </section>
  )

  const renderCarePlanCard = () => (
    <section {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.cardHead)}>
        <div>
          <h2 {...stylex.props(styles.cardTitle)}>
            {isPatient ? 'Kế hoạch chăm sóc & Điều trị' : 'Tóm tắt tiến độ ca trực'}
          </h2>
          <p {...stylex.props(styles.cardSub)}>
            {isPatient ? 'Tiến độ hoàn thành các đợt thăm khám' : 'Thống kê tiến độ xử lý hồ sơ trong ngày'}
          </p>
        </div>
        <SparklesIcon width={18} color="#0f6350" />
      </div>
      <div {...stylex.props(styles.carePlan)}>
        <div {...stylex.props(styles.progressTop)}>
          <span>Tỷ lệ hoàn tất hồ sơ khám</span>
          <strong style={{ color: '#126b56' }}>{completionPct}%</strong>
        </div>
        <div {...stylex.props(styles.progressBar)}>
          <div {...stylex.props(styles.progressFill)} style={{ width: `${completionPct}%` }} />
        </div>
        <div {...stylex.props(styles.taskLine, styles.taskDone)}>
          <CheckCircleIcon {...stylex.props(styles.taskCheck)} />
          {isPatient
            ? `${data?.metrics.patientCompletedEncountersCount ?? 0} đợt khám đã hoàn thành đầy đủ`
            : `${data?.metrics.completedEncounters ?? 0} ca khám đã hoàn thành hồ sơ`}
        </div>
        <div {...stylex.props(styles.taskLine)}>
          <ClockIcon {...stylex.props(styles.taskCheck)} />
          {isPatient
            ? `${(data?.metrics.patientEncountersCount ?? 0) - (data?.metrics.patientCompletedEncountersCount ?? 0)} đợt khám đang trong quá trình theo dõi`
            : `${data?.metrics.openEncounters ?? 0} ca khám đang thực hiện tại phòng khám`}
        </div>
        <div {...stylex.props(styles.taskLine)}>
          <DocumentTextIcon {...stylex.props(styles.taskCheck)} />
          {isPatient
            ? `${data?.metrics.patientObservationsCount ?? 0} chỉ số sinh hiệu đã được lưu trữ`
            : `${data?.metrics.checkedInAppointments ?? 0} người bệnh đã hoàn tất thủ tục tiếp nhận`}
        </div>
      </div>
    </section>
  )

  const renderVitalsConfigCard = () => (
    <section {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.cardHead)}>
        <div>
          <h2 {...stylex.props(styles.cardTitle)}>
            Thiết lập thông số sinh hiệu lâm sàng
          </h2>
          <p {...stylex.props(styles.cardSub)}>
            Áp dụng khi xác nhận hoàn tất ca khám đang mở
          </p>
        </div>
      </div>
      <div {...stylex.props(styles.carePlan)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div {...stylex.props(styles.fieldGroup)}>
          <label htmlFor="obs-code" {...stylex.props(styles.fieldLabel)}>Loại chỉ số</label>
          <select
            id="obs-code"
            value={obsCodeInput}
            onChange={(e) => {
              const nextCode = e.target.value
              setObsCodeInput(nextCode)
              if (nextCode === 'synthetic-code-vital') {
                setObsValueInput('36.8')
                setObsUnitInput('°C')
              } else if (nextCode === 'synthetic-code-hr') {
                setObsValueInput('74')
                setObsUnitInput('bpm')
              } else if (nextCode === 'synthetic-code-bp') {
                setObsValueInput('118')
                setObsUnitInput('mmHg')
              } else if (nextCode === 'synthetic-code-spo2') {
                setObsValueInput('98')
                setObsUnitInput('%')
              }
            }}
            {...stylex.props(styles.selectInput)}
            className={`${stylex.props(styles.selectInput).className ?? ''} medicloud-select`.trim()}
          >
            <option value="synthetic-code-vital">Thân nhiệt (°C)</option>
            <option value="synthetic-code-hr">Nhịp tim (bpm)</option>
            <option value="synthetic-code-bp">Huyết áp tâm thu (mmHg)</option>
            <option value="synthetic-code-spo2">Độ bão hòa Oxy SpO₂ (%)</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div {...stylex.props(styles.fieldGroup)}>
            <label htmlFor="obs-val" {...stylex.props(styles.fieldLabel)}>Giá trị đo</label>
            <input
              id="obs-val"
              type="number"
              step="0.1"
              value={obsValueInput}
              onChange={(e) => setObsValueInput(e.target.value)}
              {...stylex.props(styles.selectInput)}
            />
          </div>
          <div {...stylex.props(styles.fieldGroup)}>
            <label htmlFor="obs-unit" {...stylex.props(styles.fieldLabel)}>Đơn vị</label>
            <input
              id="obs-unit"
              type="text"
              value={obsUnitInput}
              onChange={(e) => setObsUnitInput(e.target.value)}
              {...stylex.props(styles.selectInput)}
            />
          </div>
        </div>
      </div>
    </section>
  )

  const renderMedicalSummaryCard = () => (
    <section {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.cardHead)}>
        <div>
          <h2 {...stylex.props(styles.cardTitle)}>
            {isPatient ? 'Tóm tắt hồ sơ y tế' : 'Thông tin ca trực khoa phòng'}
          </h2>
          <p {...stylex.props(styles.cardSub)}>
            Cập nhật lúc {data?.fetchedAt ? formatVietnamDateTime(data.fetchedAt).time : '--:--'}
          </p>
        </div>
      </div>
      <div {...stylex.props(styles.carePlan)}>
        {isPatient && (
          <div {...stylex.props(styles.taskLine)} style={{ marginTop: 0 }}>
            <UserGroupIcon {...stylex.props(styles.taskCheck)} />
            <span style={{ flex: 1 }}>Họ tên & Mã hồ sơ</span>
            <strong style={{ color: '#153d38' }}>
              {data?.activePatient?.displayName ?? '--'} ({data?.activePatient?.code ?? '--'})
            </strong>
          </div>
        )}
        <div {...stylex.props(styles.taskLine)}>
          <HeartIcon {...stylex.props(styles.taskCheck)} />
          <span style={{ flex: 1 }}>{isPatient ? 'Nhóm máu' : 'Đơn vị công tác'}</span>
          <strong style={{ color: '#153d38' }}>
            {isPatient ? data?.activePatient?.bloodType ?? 'O+' : data?.tenant.name ?? '--'}
          </strong>
        </div>
        <div {...stylex.props(styles.taskLine)}>
          <BeakerIcon {...stylex.props(styles.taskCheck)} />
          <span style={{ flex: 1 }}>{isPatient ? 'Tiền sử dị ứng' : 'Chuyên khoa phụ trách'}</span>
          <strong style={{ color: '#153d38' }}>
            {isPatient ? data?.activePatient?.allergy ?? 'Không ghi nhận' : data?.activePractitioner?.specialty ?? '--'}
          </strong>
        </div>
        <div {...stylex.props(styles.taskLine)}>
          <DocumentTextIcon {...stylex.props(styles.taskCheck)} />
          <span style={{ flex: 1 }}>Khung giờ khám còn trống</span>
          <strong style={{ color: '#153d38' }}>{data?.metrics.availableSlotsCount ?? 0} ca khám</strong>
        </div>
      </div>
    </section>
  )

  const renderNoticeBanner = () => (
    <section {...stylex.props(styles.notice)}>
      <BellIcon {...stylex.props(styles.noticeIcon)} />
      <div>
        <strong>{isPatient ? 'Lưu ý chăm sóc sức khỏe' : 'Ghi chú điều phối ca trực'}</strong>
        <br />
        {isPatient
          ? 'Vui lòng mang theo mã lịch hẹn khi đến quầy tiếp nhận và tuân thủ hướng dẫn điều trị của bác sĩ chuyên khoa.'
          : `Hiện có ${data?.metrics.waitingCheckInAppointments ?? 0} người bệnh đang chờ tiếp nhận và ${data?.metrics.openEncounters ?? 0} hồ sơ khám cần bác sĩ hoàn tất chỉ số.`}
      </div>
    </section>
  )

  const renderAvailableSlotsSideCard = () => (
    <section {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.cardHead)}>
        <div>
          <h2 {...stylex.props(styles.cardTitle)}>Khung giờ khám còn trống</h2>
          <p {...stylex.props(styles.cardSub)}>
            Chọn một khung giờ để mở nhanh cửa sổ đặt lịch
          </p>
        </div>
        <span {...stylex.props(styles.status)}>{availableSlots.length} ca trống</span>
      </div>
      {availableSlots.length === 0 ? (
        <div {...stylex.props(styles.emptyBox)}>
          Hiện chưa có khung giờ trống nào khả dụng.
        </div>
      ) : (
        availableSlots.slice(0, 5).map((slot) => {
          const badge = formatVietnamDateTime(slot.startsAt)
          return (
            <button
              key={slot.id}
              type="button"
              {...stylex.props(styles.slotRowBtn)}
              onClick={() => openBookingModal(slot.id)}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#153d38' }}>
                  {badge.fullDate} · {badge.time} — {slot.specialty}
                </div>
                <div style={{ fontSize: 12, color: '#526965', marginTop: 3 }}>
                  {slot.practitionerName} · {slot.room}
                </div>
              </div>
              <span {...stylex.props(styles.status)}>Còn {slot.remaining} chỗ</span>
            </button>
          )
        })
      )}
    </section>
  )

  const renderEncounterCard = (enc: DashboardEncounter) => {
    const badge = formatVietnamDateTime(enc.createdAt)
    const isOpen = enc.status === 'OPEN'
    return (
      <div key={enc.id} {...stylex.props(styles.appointment)}>
        <div {...stylex.props(styles.apptMain)}>
          <div {...stylex.props(styles.dateBox)}>
            <span {...stylex.props(styles.dateNum)}>{badge.day}</span>
            <span {...stylex.props(styles.dateDay)}>{badge.month}</span>
          </div>
          <div {...stylex.props(styles.appointmentInfo)}>
            <div {...stylex.props(styles.docName)}>
              {isPatient
                ? `Hồ sơ ${enc.referenceCode} · ${enc.specialty}`
                : `${enc.patientName} (${enc.patientCode}) · Hồ sơ ${enc.referenceCode}`}
            </div>
            <div {...stylex.props(styles.docMeta)}>
              <ClockIcon {...stylex.props(styles.tinyIcon)} />
              {badge.fullDate} lúc {badge.time} · Bác sĩ: {enc.practitionerName}
            </div>
            {enc.completedAt && (
              <div {...stylex.props(styles.docMeta)}>
                Hoàn tất lúc {formatVietnamDateTime(enc.completedAt).fullDate} {formatVietnamDateTime(enc.completedAt).time}
              </div>
            )}
          </div>
          <span {...stylex.props(isOpen ? styles.statusWarning : styles.status)}>
            {isOpen ? 'Đang khám' : 'Đã hoàn tất'}
          </span>
        </div>

        {enc.observations.length > 0 && (
          <div {...stylex.props(styles.obsChipList)}>
            {enc.observations.map((obs) => (
              <span key={obs.id} {...stylex.props(styles.obsChip)}>
                <strong>{obs.label}:</strong> {obs.value} {obs.unit} ({formatVietnamDateTime(obs.measuredAt).time})
              </span>
            ))}
          </div>
        )}

        {!isPatient && isOpen && (
          <>
            <div {...stylex.props(styles.divider)} />
            <div {...stylex.props(styles.apptActions)}>
              <span {...stylex.props(styles.metaCaption)}>
                Đang chờ ghi nhận sinh hiệu để hoàn tất ca khám
              </span>
              <div {...stylex.props(styles.linkGroup)}>
                {confirmEncounterId !== enc.id ? (
                  <button
                    type="button"
                    disabled={submitting}
                    {...stylex.props(styles.visitButton)}
                    onClick={() => setConfirmEncounterId(enc.id)}
                  >
                    <BeakerIcon width={13} />
                    Ghi sinh hiệu & Hoàn tất
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={submitting}
                      {...stylex.props(styles.visitButton)}
                      onClick={() =>
                        void runMutation(
                          {
                            action: 'record_observation',
                            encounterId: enc.id,
                            code: obsCodeInput,
                            value: Number(obsValueInput) || 36.8,
                            unit: obsUnitInput,
                          },
                          `Đã lưu chỉ số sinh hiệu (${obsValueInput} ${obsUnitInput}) và hoàn tất hồ sơ ${enc.referenceCode}.`,
                        )
                      }
                    >
                      <CheckCircleIcon width={13} />
                      Xác nhận hoàn tất ({obsValueInput} {obsUnitInput})
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      {...stylex.props(styles.outlineButton)}
                      onClick={() => setConfirmEncounterId(null)}
                    >
                      Hủy
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <Layout height="auto" contentWidth={1440} content={<LayoutContent padding={0}>
      <div {...stylex.props(styles.page)}>
        <div {...stylex.props(styles.shell)}>
          <aside {...stylex.props(styles.sidebar)} aria-label="Điều hướng chính">
            <div {...stylex.props(styles.brand)}>
              <div {...stylex.props(styles.logo)}><HeartIcon width={21} height={21} /></div>
              <div>
                <div {...stylex.props(styles.brandName)}>MediCloud</div>
                <div {...stylex.props(styles.brandSub)}>Y tế số</div>
              </div>
            </div>

            <div {...stylex.props(styles.profile)}>
              <div {...stylex.props(styles.avatar)}>{activeAvatar}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div {...stylex.props(styles.profName)}>{activeProfileName}</div>
                <div {...stylex.props(styles.profRole)}>{activeProfileSub}</div>
              </div>
            </div>

            <nav {...stylex.props(styles.navGroup)} aria-label="Không gian làm việc">
              <div {...stylex.props(styles.groupLabel)}>Không gian của tôi</div>
              {nav.map(({ key, label, icon: Icon, badge }) => (
                <button
                  key={key}
                  type="button"
                  aria-current={activeTab === key ? 'page' : undefined}
                  {...stylex.props(styles.navItem, activeTab === key && styles.navActive)}
                  onClick={() => handleSelectTab(key)}
                >
                  <Icon {...stylex.props(styles.navIcon)} />
                  {label}
                  {badge && <span {...stylex.props(styles.navBadge)}>{badge}</span>}
                </button>
              ))}
            </nav>

            <div {...stylex.props(styles.sideBottom)}>
              <ShieldCheckIcon {...stylex.props(styles.safeIcon)} />
              Thông tin sức khỏe được mã hóa, kiểm soát phân quyền và bảo mật theo tiêu chuẩn y tế.
            </div>
          </aside>

          <main {...stylex.props(styles.main)}>
            <header {...stylex.props(styles.topbar)}>
              <div {...stylex.props(styles.topLeft)}>
                <button
                  type="button"
                  aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
                  {...stylex.props(styles.mobileMenu)}
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {menuOpen ? <XMarkIcon width={20} /> : <Bars3Icon width={20} />}
                </button>
                <span {...stylex.props(styles.breadcrumb)}>
                  MediCloud <span aria-hidden="true">/</span> {activeNavLabel} <span aria-hidden="true">·</span>{' '}
                  <strong style={{ color: '#126b56' }}>
                    {data ? data.tenant.name : 'Đang tải...'}
                  </strong>
                </span>
              </div>

              <div {...stylex.props(styles.topActions)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MagnifyingGlassIcon width={16} height={16} color="#526965" />
                  <input
                    type="search"
                    aria-label="Tìm kiếm bác sĩ, chuyên khoa, mã lịch hẹn"
                    placeholder="Tìm bác sĩ, chuyên khoa, mã lịch hẹn..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    {...stylex.props(styles.searchInput)}
                  />
                </div>

                <button
                  type="button"
                  aria-label="Làm mới dữ liệu"
                  title="Cập nhật dữ liệu mới nhất"
                  {...stylex.props(styles.iconButton)}
                  onClick={() => {
                    void fetchDashboard()
                    note('Đã cập nhật dữ liệu mới nhất')
                  }}
                >
                  <ArrowPathIcon width={17} height={17} />
                </button>
              </div>
            </header>

            {menuOpen && (
              <div style={{ padding: 12, background: '#fff', borderBottom: '1px solid #e8efed', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {nav.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    {...stylex.props(styles.outlineButton, activeTab === key && styles.outlineButtonActive)}
                    onClick={() => handleSelectTab(key)}
                  >
                    <Icon width={14} />
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div {...stylex.props(styles.content)}>
              {errorMsg && (
                <div role="alert" style={{ marginBottom: 18, padding: 14, borderRadius: 12, backgroundColor: '#fff1f0', border: '1px solid #ffa39e', color: '#b91c1c', fontSize: 13 }}>
                  <strong>Thông báo hệ thống:</strong> {errorMsg}
                </div>
              )}

              <section {...stylex.props(styles.welcomeRow)}>
                <div>
                  <h1 {...stylex.props(styles.title)}>{pageHeaderCopy.title}</h1>
                  <p {...stylex.props(styles.subtitle)}>{pageHeaderCopy.subtitle}</p>
                  {activeTab !== 'overview' && (
                    <div style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        {...stylex.props(styles.textButton)}
                        onClick={() => handleSelectTab('overview')}
                      >
                        <ArrowLeftIcon width={13} />
                        Quay lại {isPatient ? 'Tổng quan' : 'Bàn làm việc'}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  {...stylex.props(styles.actionButton)}
                  onClick={() => openBookingModal()}
                >
                  <PlusIcon {...stylex.props(styles.actionIcon)} />
                  {isPatient ? 'Đặt lịch khám' : 'Tiếp nhận bệnh nhân'}
                </button>
              </section>

              {activeTab === 'overview' && (
                <>
                  <section {...stylex.props(styles.stats)} aria-label="Chỉ số tổng quan">
                    <Stat
                      icon={<HeartIcon width={16} />}
                      label={isPatient ? 'Chỉ số sinh hiệu gần nhất' : 'Tổng lịch khám'}
                      value={
                        loading && !data
                          ? '...'
                          : isPatient
                            ? latestObservation
                              ? `${latestObservation.value} ${latestObservation.unit}`
                              : 'Ổn định'
                            : String(data?.metrics.totalTenantsAppointments ?? 0)
                      }
                      hint={
                        isPatient
                          ? latestObservation
                            ? `${latestObservation.label} · ${formatVietnamDateTime(latestObservation.measuredAt).fullDate}`
                            : 'Chưa có bản ghi mới'
                          : <><span {...stylex.props(styles.statDelta)}>{data?.metrics.confirmedAppointments ?? 0} đã xác nhận</span> · {data?.metrics.completedAppointments ?? 0} hoàn tất</>
                      }
                    />
                    <Stat
                      icon={<CalendarDaysIcon width={16} />}
                      label={isPatient ? 'Lịch hẹn sắp tới' : 'Bệnh nhân chờ tiếp nhận'}
                      value={
                        loading && !data
                          ? '...'
                          : isPatient
                            ? String(data?.metrics.patientUpcomingAppointments ?? 0).padStart(2, '0')
                            : String(data?.metrics.waitingCheckInAppointments ?? 0).padStart(2, '0')
                      }
                      hint={
                        isPatient
                          ? `Tổng số lịch hẹn: ${data?.metrics.patientTotalAppointments ?? 0} lượt`
                          : `Đã tiếp nhận tại quầy: ${data?.metrics.checkedInAppointments ?? 0} người bệnh`
                      }
                    />
                    <Stat
                      icon={<BeakerIcon width={16} />}
                      label={isPatient ? 'Lượt khám chuyên khoa' : 'Ca khám đang thực hiện'}
                      value={
                        loading && !data
                          ? '...'
                          : isPatient
                            ? String(data?.metrics.patientEncountersCount ?? 0).padStart(2, '0')
                            : String(data?.metrics.openEncounters ?? 0).padStart(2, '0')
                      }
                      hint={
                        isPatient
                          ? `Đã hoàn tất: ${data?.metrics.patientCompletedEncountersCount ?? 0} đợt khám`
                          : `Tổng hồ sơ khám: ${data?.metrics.totalEncounters ?? 0} (${data?.metrics.completedEncounters ?? 0} hoàn tất)`
                      }
                    />
                    <Stat
                      icon={<ClipboardDocumentListIcon width={16} />}
                      label={isPatient ? 'Tiến độ kế hoạch điều trị' : 'Tỷ lệ hoàn tất hồ sơ'}
                      value={loading && !data ? '...' : `${completionPct}%`}
                      hint={
                        isPatient
                          ? `${data?.metrics.patientObservationsCount ?? 0} chỉ số theo dõi đã ghi nhận`
                          : `${data?.metrics.totalObservations ?? 0} chỉ số lâm sàng đã lưu`
                      }
                    />
                  </section>

                  <div {...stylex.props(styles.layout)}>
                    <div {...stylex.props(styles.column)}>
                      <section {...stylex.props(styles.card)}>
                        <div {...stylex.props(styles.cardHead)}>
                          <div>
                            <h2 {...stylex.props(styles.cardTitle)}>
                              {isPatient ? 'Lịch hẹn khám của bạn' : 'Danh sách lịch khám & Tiếp nhận bệnh nhân'}
                            </h2>
                            <p {...stylex.props(styles.cardSub)}>
                              {isPatient
                                ? `Hiển thị ${visibleAppointments.length} / ${filteredAppointments.length} lịch hẹn cá nhân`
                                : `Hiển thị ${visibleAppointments.length} / ${filteredAppointments.length} hồ sơ lịch hẹn tại cơ sở`}
                            </p>
                          </div>

                          <div {...stylex.props(styles.linkGroup)} style={{ alignItems: 'center' }}>
                            {!isPatient && (
                              <>
                                {([
                                  { id: 'ALL', label: 'Tất cả' },
                                  { id: 'WAITING', label: 'Chờ tiếp nhận' },
                                  { id: 'CHECKED_IN', label: 'Đã tiếp nhận' },
                                  { id: 'COMPLETED', label: 'Hoàn tất' },
                                ] as const).map((tab) => (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    {...stylex.props(
                                      styles.outlineButton,
                                      statusFilter === tab.id && styles.outlineButtonActive,
                                    )}
                                    onClick={() => setStatusFilter(tab.id)}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </>
                            )}
                            <button
                              type="button"
                              {...stylex.props(styles.textButton)}
                              onClick={() => handleSelectTab('appointments')}
                            >
                              Xem tất cả <ChevronRightIcon width={12} />
                            </button>
                          </div>
                        </div>

                        {visibleAppointments.length === 0 ? (
                          <div {...stylex.props(styles.emptyBox)}>
                            Không có lịch hẹn nào trong mục này. Bạn có thể bấm &ldquo;{isPatient ? 'Đặt lịch khám' : 'Tiếp nhận bệnh nhân'}&rdquo; để tạo mới.
                          </div>
                        ) : (
                          visibleAppointments.map(renderAppointmentItem)
                        )}

                        <ExpandListFooter
                          total={filteredAppointments.length}
                          limit={2}
                          expanded={showAllAppointments}
                          noun="lịch hẹn"
                          onToggle={() => setShowAllAppointments((prev) => !prev)}
                        />
                      </section>

                      {renderTrendChartCard()}

                      <section {...stylex.props(styles.card)}>
                        <div {...stylex.props(styles.cardHead)}>
                          <div>
                            <h2 {...stylex.props(styles.cardTitle)}>
                              {isPatient ? 'Lịch sử thăm khám & Kết quả đo' : 'Nhật ký hoạt động lâm sàng'}
                            </h2>
                            <p {...stylex.props(styles.cardSub)}>
                              {isPatient
                                ? 'Các chỉ số và kết quả ghi nhận trong hồ sơ sức khỏe của bạn'
                                : 'Các thao tác tiếp nhận, mở hồ sơ và hoàn tất ca khám gần nhất'}
                            </p>
                          </div>
                          <button
                            type="button"
                            {...stylex.props(styles.textButton)}
                            onClick={() => handleSelectTab(isPatient ? 'vitals' : 'activity')}
                          >
                            Xem tất cả <ChevronRightIcon width={12} />
                          </button>
                        </div>

                        <div {...stylex.props(styles.timeline)}>
                          {isPatient
                            ? (data?.observations ?? []).slice().reverse().slice(0, 3).map((obs) => {
                                const badge = formatVietnamDateTime(obs.measuredAt)
                                return (
                                  <TimelineItem
                                    key={obs.id}
                                    time={`${badge.day}/${badge.month.replace('Th ', '')} ${badge.time}`}
                                    title={`${obs.label}: ${obs.value} ${obs.unit}`}
                                    detail={`Hồ sơ ${obs.encounterCode} · Bác sĩ phụ trách: ${obs.practitionerName}`}
                                    tag="Đã ghi nhận"
                                  />
                                )
                              })
                            : (data?.auditEvents ?? []).slice(0, 3).map((ev) => {
                                const badge = formatVietnamDateTime(ev.occurredAt)
                                return (
                                  <TimelineItem
                                    key={ev.id}
                                    time={`${badge.day}/${badge.month.replace('Th ', '')} ${badge.time}`}
                                    title={ev.actionLabel}
                                    detail={`Phân loại nghiệp vụ: ${ev.purpose} · Ghi nhận ngày ${badge.fullDate}`}
                                    tag={ev.purpose}
                                  />
                                )
                              })}
                        </div>
                      </section>
                    </div>

                    <div {...stylex.props(styles.column)}>
                      {renderCareTeamCard()}
                      {renderCarePlanCard()}
                      {!isPatient && renderVitalsConfigCard()}
                      {renderNoticeBanner()}
                      {renderMedicalSummaryCard()}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'appointments' && (
                <div {...stylex.props(styles.layout)}>
                  <div {...stylex.props(styles.column)}>
                    <section {...stylex.props(styles.card)}>
                      <div {...stylex.props(styles.cardHead)}>
                        <div>
                          <h2 {...stylex.props(styles.cardTitle)}>
                            {isPatient ? 'Toàn bộ lịch hẹn khám' : 'Danh sách lịch khám toàn cơ sở'}
                          </h2>
                          <p {...stylex.props(styles.cardSub)}>
                            Hiển thị {tabAppointments.length} / {filteredAppointments.length} hồ sơ lịch hẹn khớp bộ lọc
                          </p>
                        </div>
                        <div {...stylex.props(styles.linkGroup)}>
                          {([
                            { id: 'ALL', label: 'Tất cả' },
                            { id: 'WAITING', label: 'Chờ tiếp nhận' },
                            { id: 'CHECKED_IN', label: 'Đã tiếp nhận' },
                            { id: 'COMPLETED', label: 'Hoàn tất' },
                            ...(isPatient ? ([{ id: 'CANCELLED', label: 'Đã hủy' }] as const) : []),
                          ] as const).map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              {...stylex.props(
                                styles.outlineButton,
                                statusFilter === tab.id && styles.outlineButtonActive,
                              )}
                              onClick={() => setStatusFilter(tab.id)}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {tabAppointments.length === 0 ? (
                        <div {...stylex.props(styles.emptyBox)}>
                          Chưa có lịch hẹn nào ở trạng thái này.
                        </div>
                      ) : (
                        tabAppointments.map(renderAppointmentItem)
                      )}

                      <ExpandListFooter
                        total={filteredAppointments.length}
                        limit={4}
                        expanded={showAllAppointments}
                        noun="lịch hẹn"
                        onToggle={() => setShowAllAppointments((prev) => !prev)}
                      />
                    </section>
                  </div>

                  <div {...stylex.props(styles.column)}>
                    {renderAvailableSlotsSideCard()}
                    {renderCareTeamCard()}
                  </div>
                </div>
              )}

              {activeTab === 'queue' && !isPatient && (
                <div {...stylex.props(styles.layout)}>
                  <div {...stylex.props(styles.column)}>
                    <section {...stylex.props(styles.card)}>
                      <div {...stylex.props(styles.cardHead)}>
                        <div>
                          <h2 {...stylex.props(styles.cardTitle)}>Chờ tiếp nhận tại quầy</h2>
                          <p {...stylex.props(styles.cardSub)}>
                            {queueWaiting.length} người bệnh đã đặt lịch nhưng chưa làm thủ tục Check-in
                          </p>
                        </div>
                        <span {...stylex.props(styles.statusWarning)}>{queueWaiting.length} đang chờ</span>
                      </div>
                      {visibleQueueWaiting.length === 0 ? (
                        <div {...stylex.props(styles.emptyBox)}>
                          Tất cả người bệnh có lịch đã được tiếp nhận tại quầy.
                        </div>
                      ) : (
                        visibleQueueWaiting.map(renderAppointmentItem)
                      )}

                      <ExpandListFooter
                        total={queueWaiting.length}
                        limit={3}
                        expanded={showAllWaitingQueue}
                        noun="hồ sơ chờ"
                        onToggle={() => setShowAllWaitingQueue((prev) => !prev)}
                      />
                    </section>

                    <section {...stylex.props(styles.card)}>
                      <div {...stylex.props(styles.cardHead)}>
                        <div>
                          <h2 {...stylex.props(styles.cardTitle)}>Đã tiếp nhận — Chờ vào phòng khám</h2>
                          <p {...stylex.props(styles.cardSub)}>
                            {queueCheckedIn.length} người bệnh sẵn sàng bắt đầu ca khám hoặc đang thực hiện khám
                          </p>
                        </div>
                        <span {...stylex.props(styles.status)}>{queueCheckedIn.length} hồ sơ</span>
                      </div>
                      {visibleQueueCheckedIn.length === 0 ? (
                        <div {...stylex.props(styles.emptyBox)}>
                          Hiện không có người bệnh nào đang chờ trong phòng khám.
                        </div>
                      ) : (
                        visibleQueueCheckedIn.map(renderAppointmentItem)
                      )}

                      <ExpandListFooter
                        total={queueCheckedIn.length}
                        limit={3}
                        expanded={showAllCheckedInQueue}
                        noun="hồ sơ đã tiếp nhận"
                        onToggle={() => setShowAllCheckedInQueue((prev) => !prev)}
                      />
                    </section>
                  </div>

                  <div {...stylex.props(styles.column)}>
                    {renderCarePlanCard()}
                    {renderNoticeBanner()}
                  </div>
                </div>
              )}

              {activeTab === 'records' && (
                <div {...stylex.props(styles.layout)}>
                  <div {...stylex.props(styles.column)}>
                    <section {...stylex.props(styles.card)}>
                      <div {...stylex.props(styles.cardHead)}>
                        <div>
                          <h2 {...stylex.props(styles.cardTitle)}>
                            {isPatient ? 'Các đợt khám & Hồ sơ sức khỏe của bạn' : 'Danh sách ca khám lâm sàng (Encounters)'}
                          </h2>
                          <p {...stylex.props(styles.cardSub)}>
                            Hiển thị {visibleEncounters.length} / {filteredEncounters.length} hồ sơ khám phù hợp
                          </p>
                        </div>
                        <div {...stylex.props(styles.linkGroup)}>
                          {([
                            { id: 'ALL', label: 'Tất cả' },
                            { id: 'OPEN', label: 'Đang khám' },
                            { id: 'COMPLETED', label: 'Đã hoàn tất' },
                          ] as const).map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              {...stylex.props(
                                styles.outlineButton,
                                encounterFilter === tab.id && styles.outlineButtonActive,
                              )}
                              onClick={() => setEncounterFilter(tab.id)}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {visibleEncounters.length === 0 ? (
                        <div {...stylex.props(styles.emptyBox)}>
                          Chưa có hồ sơ khám nào khớp bộ lọc hiện tại.
                        </div>
                      ) : (
                        visibleEncounters.map(renderEncounterCard)
                      )}

                      <ExpandListFooter
                        total={filteredEncounters.length}
                        limit={4}
                        expanded={showAllEncounters}
                        noun="hồ sơ khám"
                        onToggle={() => setShowAllEncounters((prev) => !prev)}
                      />
                    </section>
                  </div>

                  <div {...stylex.props(styles.column)}>
                    {isPatient ? (
                      <>
                        {renderMedicalSummaryCard()}
                        {renderCareTeamCard()}
                        {renderCarePlanCard()}
                      </>
                    ) : (
                      <>
                        {renderVitalsConfigCard()}
                        {renderCarePlanCard()}
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'vitals' && (
                <div {...stylex.props(styles.layout)}>
                  <div {...stylex.props(styles.column)}>
                    {renderTrendChartCard()}

                    <section {...stylex.props(styles.card)}>
                      <div {...stylex.props(styles.cardHead)}>
                        <div>
                          <h2 {...stylex.props(styles.cardTitle)}>
                            {isPatient ? 'Chi tiết chỉ số sinh hiệu cá nhân' : 'Danh sách chỉ số lâm sàng đã ghi nhận'}
                          </h2>
                          <p {...stylex.props(styles.cardSub)}>
                            Hiển thị {visibleObservations.length} / {filteredObservations.length} kết quả đo được lưu trong hồ sơ
                          </p>
                        </div>
                      </div>

                      {visibleObservations.length === 0 ? (
                        <div {...stylex.props(styles.emptyBox)}>
                          Chưa có chỉ số sinh hiệu nào khớp từ khóa tìm kiếm.
                        </div>
                      ) : (
                        <div {...stylex.props(styles.timeline)}>
                          {visibleObservations.map((obs) => {
                            const badge = formatVietnamDateTime(obs.measuredAt)
                            return (
                              <TimelineItem
                                key={obs.id}
                                time={`${badge.day}/${badge.month.replace('Th ', '')} ${badge.time}`}
                                title={`${obs.label}: ${obs.value} ${obs.unit}`}
                                detail={
                                  isPatient
                                    ? `Hồ sơ ${obs.encounterCode} · Bác sĩ phụ trách: ${obs.practitionerName} · Ngày ${badge.fullDate}`
                                    : `Bệnh nhân: ${obs.patientName} · Hồ sơ ${obs.encounterCode} · ${obs.practitionerName}`
                                }
                                tag={`${obs.value} ${obs.unit}`}
                              />
                            )
                          })}
                        </div>
                      )}

                      <ExpandListFooter
                        total={filteredObservations.length}
                        limit={4}
                        expanded={showAllObservations}
                        noun="chỉ số sinh hiệu"
                        onToggle={() => setShowAllObservations((prev) => !prev)}
                      />
                    </section>
                  </div>

                  <div {...stylex.props(styles.column)}>
                    {!isPatient ? renderVitalsConfigCard() : renderMedicalSummaryCard()}
                    {renderCarePlanCard()}
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div {...stylex.props(styles.layout)}>
                  <div {...stylex.props(styles.column)}>
                    <section {...stylex.props(styles.card)}>
                      <div {...stylex.props(styles.cardHead)}>
                        <div>
                          <h2 {...stylex.props(styles.cardTitle)}>
                            {isPatient ? 'Lịch sử hoạt động tài khoản & hồ sơ' : 'Nhật ký nghiệp vụ lâm sàng & tiếp nhận'}
                          </h2>
                          <p {...stylex.props(styles.cardSub)}>
                            Hiển thị {visibleAuditEvents.length} / {filteredAuditEvents.length} bản ghi nhật ký gần nhất
                          </p>
                        </div>

                        <div {...stylex.props(styles.linkGroup)}>
                          {(['ALL', 'Điều trị lâm sàng', 'Điều phối tiếp nhận', 'Hệ thống'] as const).map((purpose) => (
                            <button
                              key={purpose}
                              type="button"
                              {...stylex.props(
                                styles.outlineButton,
                                activityFilter === purpose && styles.outlineButtonActive,
                              )}
                              onClick={() => setActivityFilter(purpose)}
                            >
                              {purpose === 'ALL' ? 'Tất cả' : purpose}
                            </button>
                          ))}
                        </div>
                      </div>

                      {visibleAuditEvents.length === 0 ? (
                        <div {...stylex.props(styles.emptyBox)}>
                          Chưa có sự kiện nào thuộc phân loại này.
                        </div>
                      ) : (
                        <div {...stylex.props(styles.timeline)}>
                          {visibleAuditEvents.map((ev) => {
                            const badge = formatVietnamDateTime(ev.occurredAt)
                            return (
                              <TimelineItem
                                key={ev.id}
                                time={`${badge.day}/${badge.month.replace('Th ', '')} ${badge.time}`}
                                title={ev.actionLabel}
                                detail={`Phân loại: ${ev.purpose} · Ghi nhận lúc ${badge.time} ngày ${badge.fullDate}`}
                                tag={ev.purpose}
                              />
                            )
                          })}
                        </div>
                      )}

                      <ExpandListFooter
                        total={filteredAuditEvents.length}
                        limit={4}
                        expanded={showAllAuditEvents}
                        noun="bản ghi nhật ký"
                        onToggle={() => setShowAllAuditEvents((prev) => !prev)}
                      />
                    </section>
                  </div>

                  <div {...stylex.props(styles.column)}>
                    {renderMedicalSummaryCard()}
                    {renderNoticeBanner()}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        <nav aria-label="Điều hướng nhanh" {...stylex.props(styles.mobileNav)}>
          {nav.slice(0, 4).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-current={activeTab === key ? 'page' : undefined}
              {...stylex.props(styles.mobileNavBtn, activeTab === key && styles.mobileNavBtnActive)}
              onClick={() => handleSelectTab(key)}
            >
              <Icon width={19} height={19} />
              {label}
            </button>
          ))}
        </nav>

        {data && (
          <BookingModal
            isOpen={isBookingModalOpen}
            isPatient={isPatient}
            tenantName={data.tenant.name}
            activePatient={data.activePatient}
            patients={data.patients}
            practitioners={data.practitioners}
            slots={data.slots}
            preselectedSlotId={preselectedSlotId}
            submitting={submitting}
            serverError={modalError}
            onClose={() => setIsBookingModalOpen(false)}
            onConfirm={async (payload) => {
              await runMutation(
                {
                  action: 'book_appointment',
                  ...payload,
                },
                'Đặt lịch khám thành công! Lịch hẹn đã được ghi nhận vào hệ thống.',
                { fromModal: true },
              )
            }}
          />
        )}

        {notice && (
          <div role="status" {...stylex.props(styles.noticeToast)}>
            <CheckCircleIcon width={16} />
            {notice}
          </div>
        )}
      </div>
    </LayoutContent>} />
  )
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: React.ReactNode }) {
  return (
    <article {...stylex.props(styles.statCard)}>
      <div {...stylex.props(styles.statTop)}>
        <span>{label}</span>
        <span {...stylex.props(styles.statIcon)}>{icon}</span>
      </div>
      <div {...stylex.props(styles.statNum)}>{value}</div>
      <div {...stylex.props(styles.statHint)}>{hint}</div>
    </article>
  )
}

function TimelineItem({ time, title, detail, tag }: { time: string; title: string; detail: string; tag: string }) {
  return (
    <div {...stylex.props(styles.timelineItem)}>
      <div {...stylex.props(styles.time)}>{time}</div>
      <div {...stylex.props(styles.timeLine)}>
        <span {...stylex.props(styles.timeDot)} />
      </div>
      <div {...stylex.props(styles.timelineInfo)}>
        <div {...stylex.props(styles.taskName)}>{title}</div>
        <div {...stylex.props(styles.taskSub)}>{detail}</div>
      </div>
      <span {...stylex.props(styles.taskTag)}>{tag}</span>
    </div>
  )
}

function Person({ name, specialty, initials, status }: { name: string; specialty: string; initials: string; status: string }) {
  return (
    <div {...stylex.props(styles.personRow)}>
      <div {...stylex.props(styles.personAvatar)}>{initials}</div>
      <div {...stylex.props(styles.personInfo)}>
        <div {...stylex.props(styles.personName)}>{name}</div>
        <div {...stylex.props(styles.personSub)}>{specialty}</div>
      </div>
      <span {...stylex.props(styles.personStatus)}>{status}</span>
    </div>
  )
}

function ExpandListFooter({
  total,
  limit,
  expanded,
  noun,
  onToggle,
}: {
  total: number
  limit: number
  expanded: boolean
  noun: string
  onToggle: () => void
}) {
  if (total <= limit) return null
  return (
    <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #e8efed' }}>
      <button type="button" {...stylex.props(styles.textButton)} onClick={onToggle}>
        {expanded ? 'Thu gọn danh sách' : `Xem toàn bộ ${total} ${noun}`}
        <ChevronRightIcon width={13} />
      </button>
    </div>
  )
}
