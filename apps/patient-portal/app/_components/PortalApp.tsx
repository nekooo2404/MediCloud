'use client';

import { useCallback, useState } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { List, ListItem } from '@astryxdesign/core/List';
import { Section } from '@astryxdesign/core/Section';
import { Selector } from '@astryxdesign/core/Selector';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Text } from '@astryxdesign/core/Text';
import { TopNav, TopNavHeading } from '@astryxdesign/core/TopNav';
import { VStack } from '@astryxdesign/core/VStack';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import type {
  ActiveSession,
  ErrorEnvelope,
  PortalSimulationMode,
  SyntheticPersonaId,
} from '../_lib/types';
import { AppointmentsWorkspace } from './AppointmentsWorkspace';
import { BookingWorkspace } from './BookingWorkspace';
import { usePortalThemeMode } from './PortalThemeProvider';
import { SessionGate, type PersonaOption } from './SessionGate';
import { StaffDeskWorkspace } from './StaffDeskWorkspace';

type PortalTab = 'booking' | 'appointments' | 'staff';

interface PortalAppProps {
  initialSession: ActiveSession | null;
  personas: readonly PersonaOption[];
  upstreamConfigured: boolean;
}

export function PortalApp({
  initialSession,
  personas,
  upstreamConfigured,
}: PortalAppProps) {
  const { mode, setMode } = usePortalThemeMode();
  const isCompactViewport = useMediaQuery('(max-width: 767px)');

  const [session, setSession] = useState<ActiveSession | null>(initialSession);
  const [activeTab, setActiveTab] = useState<PortalTab>('booking');
  const [simMode, setSimMode] = useState<PortalSimulationMode>('normal');

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signingPersonaId, setSigningPersonaId] = useState<SyntheticPersonaId | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [degradedError, setDegradedError] = useState<ErrorEnvelope['error'] | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleDegraded = useCallback((err: ErrorEnvelope['error']) => {
    setDegradedError(err);
  }, []);

  const handleClearDegraded = useCallback(() => {
    setDegradedError(null);
  }, []);

  const handleSignIn = useCallback(async (personaId: SyntheticPersonaId) => {
    setSigningIn(true);
    setSigningPersonaId(personaId);
    setAuthError(null);
    try {
      const response = await fetch('/api/bff/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ persona_id: personaId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const err = (payload as ErrorEnvelope).error;
        setAuthError(err?.message ?? 'Đăng nhập mẫu thất bại.');
        return;
      }
      setSession((payload.session ?? null) as ActiveSession | null);
      setSessionDialogOpen(false);
      setDegradedError(null);
      setRefreshTrigger((n) => n + 1);
    } catch {
      setAuthError('Không thể kết nối BFF để khởi tạo phiên.');
    } finally {
      setSigningIn(false);
      setSigningPersonaId(null);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await fetch('/api/bff/session', { method: 'DELETE' });
    setSession(null);
    setSessionDialogOpen(false);
    setDegradedError(null);
  }, []);

  const handleAppointmentCreated = useCallback(() => {
    setRefreshTrigger((n) => n + 1);
  }, []);

  const handleInspectAppointment = useCallback((appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setActiveTab('appointments');
  }, []);

  const cycleThemeMode = () => {
    if (mode === 'system') setMode('light');
    else if (mode === 'light') setMode('dark');
    else setMode('system');
  };

  const themeButtonLabel =
    mode === 'light' ? 'Sáng' : mode === 'dark' ? 'Tối' : 'Tự động';

  const bannerElement = degradedError ? (
    <Banner
      status="error"
      container="section"
      title="Cảnh báo AC-10: Gián đoạn kết nối ranh giới lâm sàng nội bộ"
      description={`${degradedError.message} Mã đối chiếu: ${degradedError.correlation_id}`}
      endContent={
        <Button
          label="Khôi phục và thử kết nối lại"
          variant="secondary"
          size="sm"
          onClick={() => {
            setSimMode('normal');
            setDegradedError(null);
            setRefreshTrigger((n) => n + 1);
          }}
        >
          Thử kết nối lại
        </Button>
      }
    />
  ) : undefined;

  return (
    <AppShell
      height="auto"
      variant="surface"
      banner={bannerElement}
      mobileNav={false}
      topNav={
        <TopNav
          label="Điều hướng chính MediCloud"
          heading={
            <TopNavHeading
              heading="MediCloud"
              subheading={
                isCompactViewport
                  ? undefined
                  : session
                    ? session.tenantName
                    : 'Cổng đặt lịch & tiếp nhận P0'
              }
            />
          }
          endContent={
            <HStack gap={2} vAlign="center" wrap="nowrap">
              <Button
                label={`Chế độ giao diện: ${themeButtonLabel}`}
                variant="ghost"
                size="sm"
                onClick={cycleThemeMode}
              >
                {themeButtonLabel}
              </Button>
              {session ? (
                <Button
                  label={`Tài khoản: ${session.displayName}`}
                  variant="secondary"
                  size="sm"
                  onClick={() => setSessionDialogOpen(true)}
                >
                  {isCompactViewport ? 'Tài khoản' : session.displayName}
                </Button>
              ) : null}
            </HStack>
          }
        />
      }
    >
      <VStack data-portal-frame gap={5}>
        {!session ? (
          <SessionGate
            personas={personas}
            isSigningIn={signingIn}
            signingInPersonaId={signingPersonaId}
            errorMessage={authError}
            onSignIn={(id) => void handleSignIn(id)}
          />
        ) : (
          <VStack gap={5}>
            <Section padding={3} variant="section">
              <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
                <TabList
                  value={activeTab}
                  onChange={(value) => setActiveTab(value as PortalTab)}
                >
                  <Tab value="booking" label="Đặt lịch khám" icon={<Icon icon="calendar" />} />
                  <Tab value="appointments" label="Lịch hẹn & Tra cứu" icon={<Icon icon="search" />} />
                  <Tab value="staff" label="Quầy tiếp nhận" icon={<Icon icon="clock" />} />
                </TabList>

                <HStack gap={3} vAlign="center" wrap="wrap">
                  <HStack gap={1.5} vAlign="center">
                    <StatusDot
                      variant={
                        degradedError || simMode === 'degraded'
                          ? 'error'
                          : simMode === 'slow'
                            ? 'warning'
                            : 'success'
                      }
                      label={
                        degradedError || simMode === 'degraded'
                          ? 'Kết nối nội bộ gián đoạn'
                          : 'Kết nối tổng hợp sẵn sàng'
                      }
                    />
                    <Text type="supporting" color="secondary">
                      {session.role === 'RECEPTIONIST' ? 'Vai trò: Lễ tân' : 'Vai trò: Bệnh nhân'}
                    </Text>
                  </HStack>

                  {!upstreamConfigured ? (
                    <Selector
                      label="Mô phỏng trạng thái P0"
                      isLabelHidden
                      size="sm"
                      width={isCompactViewport ? '100%' : 220}
                      value={simMode}
                      options={[
                        { value: 'normal', label: 'Trạng thái: Bình thường' },
                        { value: 'degraded', label: 'Mô phỏng AC-10: Gián đoạn 503' },
                        { value: 'empty', label: 'Mô phỏng: Danh sách trống' },
                        { value: 'slow', label: 'Mô phỏng: Tải chậm (Skeleton)' },
                      ]}
                      onChange={(nextValue) => {
                        const modeValue = (nextValue ?? 'normal') as PortalSimulationMode;
                        setSimMode(modeValue);
                        if (modeValue === 'normal') {
                          setDegradedError(null);
                        }
                        setRefreshTrigger((n) => n + 1);
                      }}
                    />
                  ) : null}
                </HStack>
              </HStack>
            </Section>

            {activeTab === 'booking' ? (
              <BookingWorkspace
                session={session}
                simMode={simMode}
                onResetSimMode={() => {
                  setSimMode('normal');
                  setDegradedError(null);
                }}
                onDegraded={handleDegraded}
                onClearDegraded={handleClearDegraded}
                onAppointmentCreated={handleAppointmentCreated}
                onInspectAppointment={handleInspectAppointment}
              />
            ) : activeTab === 'appointments' ? (
              <AppointmentsWorkspace
                session={session}
                simMode={simMode}
                selectedAppointmentId={selectedAppointmentId}
                refreshTrigger={refreshTrigger}
                onClearSelectedAppointmentId={() => setSelectedAppointmentId(null)}
                onResetSimMode={() => {
                  setSimMode('normal');
                  setDegradedError(null);
                }}
                onDegraded={handleDegraded}
                onClearDegraded={handleClearDegraded}
              />
            ) : (
              <StaffDeskWorkspace
                session={session}
                simMode={simMode}
                refreshTrigger={refreshTrigger}
                onSwitchPersona={(id) => void handleSignIn(id)}
                onResetSimMode={() => {
                  setSimMode('normal');
                  setDegradedError(null);
                }}
                onDegraded={handleDegraded}
                onClearDegraded={handleClearDegraded}
                onCheckInCompleted={() => setRefreshTrigger((n) => n + 1)}
              />
            )}
          </VStack>
        )}

        <Section padding={3} variant="transparent" dividers={['top']}>
          <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
            <Text type="supporting" color="secondary">
              {upstreamConfigured
                ? 'MediCloud P0: Kết nối Clinical API nội bộ qua BFF cookie HttpOnly (dữ liệu tổng hợp).'
                : 'MediCloud P0: Chế độ BFF tổng hợp cục bộ khớp hợp đồng OpenAPI P0; không chứa hồ sơ bệnh án thật.'}
            </Text>
            {session ? (
              <Button
                label="Đổi tài khoản mẫu"
                variant="ghost"
                size="sm"
                onClick={() => setSessionDialogOpen(true)}
              />
            ) : null}
          </HStack>
        </Section>
      </VStack>

      <Dialog
        isOpen={sessionDialogOpen}
        onOpenChange={setSessionDialogOpen}
        purpose="info"
        width={480}
        padding={5}
      >
        <DialogHeader
          title="Quản lý phiên làm việc mẫu"
          subtitle={session ? `${session.displayName} (${session.tenantName})` : undefined}
          onOpenChange={setSessionDialogOpen}
        />
        <VStack gap={4} paddingBlockStart={4}>
          <Heading level={3}>Chuyển đổi vai trò hoặc cơ sở (Tenant)</Heading>
          <List hasDividers density="compact">
            {personas.map((persona) => (
              <ListItem
                key={persona.id}
                label={
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Text weight="semibold">{persona.displayName}</Text>
                    <Badge
                      label={persona.role === 'RECEPTIONIST' ? 'Lễ tân' : 'Bệnh nhân'}
                      variant={persona.role === 'RECEPTIONIST' ? 'blue' : 'teal'}
                    />
                  </HStack>
                }
                description={<Text type="supporting">{persona.tenantName}</Text>}
                endContent={
                  <Button
                    label={`Chuyển sang ${persona.displayName}`}
                    variant={session?.personaId === persona.id ? 'secondary' : 'primary'}
                    size="sm"
                    isDisabled={session?.personaId === persona.id || signingIn}
                    isLoading={signingIn && signingPersonaId === persona.id}
                    onClick={() => void handleSignIn(persona.id)}
                  >
                    {session?.personaId === persona.id ? 'Đang dùng' : 'Chọn'}
                  </Button>
                }
              />
            ))}
          </List>
          <HStack gap={2} hAlign="between" wrap="wrap">
            <Button label="Đăng xuất phiên" variant="destructive" size="sm" onClick={() => void handleSignOut()} />
            <Button label="Đóng" variant="secondary" size="sm" onClick={() => setSessionDialogOpen(false)} />
          </HStack>
        </VStack>
      </Dialog>
    </AppShell>
  );
}
