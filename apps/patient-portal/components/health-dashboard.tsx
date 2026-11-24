'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useCallback, useMemo, useState} from 'react';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {
  Bars3Icon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  HeartIcon,
  HomeIcon,
  PlusIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {AppointmentsPanel} from '@/features/appointments/appointments-panel';
import {AuditPanel} from '@/features/audit/audit-panel';
import {OverviewPanel} from '@/features/overview/overview-panel';
import {StaffQueuePanel} from '@/features/queue/staff-queue-panel';
import {RecordsPanel} from '@/features/records/records-panel';
import {VitalsPanel} from '@/features/vitals/vitals-panel';
import {useWorkspaceData} from '@/hooks/use-workspace-data';
import {
  type AppointmentItem,
  WorkspaceClientError,
  type WorkspaceResource,
} from '@/lib/api/workspace-client';
import {MC_COLORS} from '@/lib/design-tokens';

const LazyBookingWizardModal = dynamic(
  () => import('@/features/appointments/booking/booking-wizard-modal').then((mod) => mod.BookingWizardModal),
  {ssr: false},
);

export type NavKey = 'overview' | 'appointments' | 'queue' | 'records' | 'vitals' | 'activity' | 'audit';

interface HealthDashboardProps {
  portalRole?: 'patient' | 'staff';
  role?: 'patient' | 'staff';
  initialTab?: NavKey;
}

export function HealthDashboard({portalRole, role, initialTab = 'overview'}: HealthDashboardProps) {
  const effectiveRole = portalRole ?? role ?? 'patient';
  const normalizedInitial: NavKey = initialTab === 'activity' ? 'audit' : initialTab;
  const [activeTab, setActiveTabState] = useState<NavKey>(normalizedInitial);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingModalState, setBookingModalState] = useState<{
    open: boolean;
    mode: 'create' | 'reschedule';
    target: AppointmentItem | null;
  }>({open: false, mode: 'create', target: null});
  const [modalError, setModalError] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const setActiveTab = useCallback((nextTab: NavKey) => {
    const canonical = nextTab === 'activity' ? 'audit' : nextTab;
    setActiveTabState(canonical);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', canonical === 'audit' ? 'activity' : canonical);
      window.history.replaceState(window.history.state, '', url);
    }
  }, []);

  const activeResource: WorkspaceResource = activeTab === 'activity' ? 'audit' : activeTab;
  const {
    tenantCode,
    switchTenant,
    slices,
    filters,
    updateFilter,
    loadMore,
    loadingMap,
    error,
    setError,
    mutatingKey,
    runMutation,
  } = useWorkspaceData(effectiveRole, activeResource);

  const navItems = useMemo(
    () => [
      {key: 'overview' as const, label: 'Tổng quan', icon: HomeIcon},
      ...(effectiveRole === 'staff'
        ? [{key: 'queue' as const, label: 'Hàng đợi phòng khám', icon: ClipboardDocumentListIcon}]
        : []),
      {
        key: 'appointments' as const,
        label: effectiveRole === 'staff' ? 'Lịch hẹn cơ sở' : 'Lịch hẹn của tôi',
        icon: CalendarDaysIcon,
      },
      {key: 'records' as const, label: 'Hồ sơ & Kết quả', icon: DocumentTextIcon},
      {key: 'vitals' as const, label: 'Chỉ số sinh hiệu', icon: HeartIcon},
      {
        key: 'audit' as const,
        label: effectiveRole === 'staff' ? 'Nhật ký kiểm toán' : 'Nhật ký hoạt động',
        icon: ShieldCheckIcon,
      },
    ],
    [effectiveRole],
  );

  const overview = slices.overview;
  const apptFilters = filters.appointments ?? {};

  async function handleAction(key: string, body: Record<string, unknown>, successMsg?: string) {
    setError(null);
    setBannerNotice(null);
    const result = await runMutation(key, body);
    if (successMsg) setBannerNotice(successMsg);
    return result;
  }

  return (
    <Layout>
      <LayoutContent>
        <section className="mc-workspace-grid">
          <aside
            className="mc-sidebar"
            aria-label="Điều hướng chính MediCloud"
            style={{
              backgroundColor: '#ffffff',
              borderRight: `1px solid ${MC_COLORS.mintBorder}`,
              padding: '18px 14px',
              display: 'grid',
              gap: '16px',
              alignContent: 'start',
            }}
          >
            <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px'}}>
              <Link href="/" style={{display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: MC_COLORS.textInk}}>
                <span
                  aria-hidden="true"
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    backgroundColor: MC_COLORS.brandPrimary,
                    color: '#ffffff',
                    display: 'inline-grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: '16px',
                  }}
                >
                  +
                </span>
                <span style={{display: 'grid', gap: '1px'}}>
                  <strong style={{fontSize: '16px', fontWeight: 700}}>MediCloud</strong>
                  <span style={{fontSize: '12px', color: MC_COLORS.textSubtle}}>
                    {effectiveRole === 'staff' ? 'Cổng nhân viên y tế' : 'Cổng bệnh nhân'}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                className="mc-mobile-menu-btn"
                aria-label="Đóng hoặc mở menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((v) => !v)}
                style={{
                  border: `1px solid ${MC_COLORS.mintBorder}`,
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  padding: '6px',
                  color: MC_COLORS.textInk,
                  cursor: 'pointer',
                  display: 'inline-grid',
                  placeItems: 'center',
                }}
              >
                {mobileMenuOpen ? <XMarkIcon style={{width: 18, height: 18}} /> : <Bars3Icon style={{width: 18, height: 18}} />}
              </button>
            </header>

            {overview && overview.availableTenants.length > 1 && (
              <label style={{display: 'grid', gap: '4px'}}>
                <span style={{fontSize: '12px', fontWeight: 700, color: MC_COLORS.textMuted}}>Cơ sở y tế</span>
                <select
                  className="medicloud-select"
                  aria-label="Chọn cơ sở y tế"
                  value={tenantCode ?? overview.tenant.code}
                  onChange={(e) => switchTenant(e.target.value)}
                >
                  {overview.availableTenants.map((t) => (
                    <option key={t.id} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <nav
              className="mc-sidebar-nav"
              data-open={mobileMenuOpen ? 'true' : 'false'}
              aria-label="Danh mục chức năng"
              style={{display: 'grid', gap: '4px'}}
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      setActiveTab(item.key);
                      setMobileMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '14px',
                      fontWeight: active ? 700 : 600,
                      cursor: 'pointer',
                      backgroundColor: active ? MC_COLORS.mintWash : 'transparent',
                      color: active ? MC_COLORS.brandInk : MC_COLORS.textInk,
                    }}
                  >
                    <Icon style={{width: 18, height: 18, flexShrink: 0}} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <footer style={{borderTop: `1px solid ${MC_COLORS.mintBorder}`, paddingTop: '12px', display: 'grid', gap: '8px'}}>
              <Link
                href="/login"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: MC_COLORS.brandInk,
                  textDecoration: 'none',
                }}
              >
                Tài khoản & Đăng nhập →
              </Link>
              <span style={{fontSize: '12px', color: MC_COLORS.textSubtle}}>
                Dữ liệu giả lập P0 · Bảo mật đa tầng
              </span>
            </footer>
          </aside>

          <main style={{padding: '20px', minWidth: 0, display: 'grid', gap: '18px', alignContent: 'start'}}>
            <header
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: '#ffffff',
                border: `1px solid ${MC_COLORS.mintBorder}`,
                borderRadius: '14px',
                padding: '14px 18px',
              }}
            >
              <section style={{display: 'grid', gap: '2px'}}>
                <h1 style={{margin: 0, fontSize: '20px', fontWeight: 700, color: MC_COLORS.textInk}}>
                  {navItems.find((i) => i.key === activeTab)?.label ?? 'Tổng quan'}
                </h1>
                <span style={{fontSize: '13px', color: MC_COLORS.textMuted}}>
                  {overview?.tenant.name ?? 'Đang kết nối cơ sở y tế...'}
                </span>
              </section>

              <button
                type="button"
                disabled={!overview}
                onClick={() => {
                  setModalError(null);
                  setBookingModalState({open: true, mode: 'create', target: null});
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: `1px solid ${MC_COLORS.brandPrimary}`,
                  backgroundColor: MC_COLORS.brandPrimary,
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: overview ? 'pointer' : 'not-allowed',
                }}
              >
                <PlusIcon style={{width: 17, height: 17}} />
                <span>Đặt lịch khám mới</span>
              </button>
            </header>

            {error && (
              <section
                role="alert"
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: MC_COLORS.dangerBg,
                  color: MC_COLORS.dangerText,
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {error}
              </section>
            )}

            {bannerNotice && (
              <section
                role="status"
                aria-live="polite"
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: MC_COLORS.mintWash,
                  color: MC_COLORS.brandInk,
                  border: `1px solid ${MC_COLORS.mintBorder}`,
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {bannerNotice}
              </section>
            )}

            {!overview && loadingMap.overview ? (
              <section style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '24px 0'}}>
                <progress className="loading-spinner" aria-label="Đang tải không gian làm việc MediCloud" />
                <span style={{fontSize: '14px', color: MC_COLORS.textMuted}}>Đang tải dữ liệu không gian làm việc...</span>
              </section>
            ) : (
              <>
                {activeTab === 'overview' && overview && (
                  <OverviewPanel
                    role={effectiveRole}
                    overview={overview}
                    onOpenBooking={() => {
                      setModalError(null);
                      setBookingModalState({open: true, mode: 'create', target: null});
                    }}
                    onNavigate={(tab) => setActiveTab(tab)}
                  />
                )}

                {activeTab === 'appointments' && (
                  <AppointmentsPanel
                    role={effectiveRole}
                    items={slices.appointments?.data ?? []}
                    nextCursor={slices.appointments?.nextCursor ?? null}
                    loading={Boolean(loadingMap.appointments)}
                    mutatingKey={mutatingKey}
                    activeStatus={apptFilters.status ?? 'ALL'}
                    searchQuery={apptFilters.q ?? ''}
                    sortBy={(apptFilters.sort as 'startsAt' | 'status') ?? 'startsAt'}
                    sortDir={apptFilters.dir ?? 'desc'}
                    onFilterChange={(patch) => updateFilter('appointments', patch)}
                    onLoadMore={() => loadMore('appointments')}
                    onOpenNewBooking={() => {
                      setModalError(null);
                      setBookingModalState({open: true, mode: 'create', target: null});
                    }}
                    onOpenReschedule={(appt) => {
                      setModalError(null);
                      setBookingModalState({open: true, mode: 'reschedule', target: appt});
                    }}
                    onMutate={(k, b) => handleAction(k, b, 'Đã cập nhật lịch hẹn thành công.')}
                  />
                )}

                {activeTab === 'queue' && effectiveRole === 'staff' && (
                  <StaffQueuePanel
                    tickets={slices.queue?.data ?? []}
                    practitioners={overview?.practitioners ?? []}
                    activePractitionerId={overview?.activePractitioner?.id}
                    loading={Boolean(loadingMap.queue)}
                    mutatingKey={mutatingKey}
                    onMutate={(k, b) => handleAction(k, b, 'Đã cập nhật tiến trình lâm sàng.')}
                  />
                )}

                {activeTab === 'records' && (
                  <RecordsPanel
                    role={effectiveRole}
                    encounters={slices.records?.data ?? []}
                    nextCursor={slices.records?.nextCursor ?? null}
                    loading={Boolean(loadingMap.records)}
                    mutatingKey={mutatingKey}
                    activeStatus={filters.records?.status ?? 'ALL'}
                    onFilterChange={(patch) => updateFilter('records', patch)}
                    onLoadMore={() => loadMore('records')}
                    onMutate={(k, b) => handleAction(k, b, 'Đã xác nhận hoàn tất ca khám.')}
                  />
                )}

                {activeTab === 'vitals' && (
                  <VitalsPanel
                    role={effectiveRole}
                    items={slices.vitals?.data ?? []}
                    nextCursor={slices.vitals?.nextCursor ?? null}
                    loading={Boolean(loadingMap.vitals)}
                    onLoadMore={() => loadMore('vitals')}
                  />
                )}

                {activeTab === 'audit' && (
                  <AuditPanel
                    role={effectiveRole}
                    items={slices.audit?.data ?? []}
                    nextCursor={slices.audit?.nextCursor ?? null}
                    loading={Boolean(loadingMap.audit)}
                    onLoadMore={() => loadMore('audit')}
                  />
                )}
              </>
            )}
          </main>
        </section>

        {bookingModalState.open && overview && (
          <LazyBookingWizardModal
            isOpen={bookingModalState.open}
            mode={bookingModalState.mode}
            rescheduleTarget={bookingModalState.target}
            role={effectiveRole}
            tenantName={overview.tenant.name}
            tenantCode={overview.tenant.code}
            patients={overview.patients ?? (overview.activePatient ? [overview.activePatient] : [])}
            defaultPatientId={overview.activePatient?.id}
            specialties={overview.specialties}
            practitioners={overview.practitioners}
            isSubmitting={Boolean(mutatingKey)}
            errorMessage={modalError}
            onClose={() => setBookingModalState({open: false, mode: 'create', target: null})}
            onSubmitBooking={async (payload) => {
              setModalError(null);
              try {
                await handleAction(
                  payload.idempotencyKey,
                  payload,
                  payload.action === 'reschedule_appointment'
                    ? 'Đổi lịch hẹn thành công!'
                    : 'Đặt lịch khám mới thành công!',
                );
                setBookingModalState({open: false, mode: 'create', target: null});
              } catch (err) {
                setModalError(
                  err instanceof WorkspaceClientError
                    ? err.message
                    : 'Không thể lưu lịch hẹn. Vui lòng thử khung giờ khác.',
                );
              }
            }}
          />
        )}
      </LayoutContent>
    </Layout>
  );
}
