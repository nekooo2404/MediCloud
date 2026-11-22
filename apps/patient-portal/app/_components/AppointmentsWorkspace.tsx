'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Drawer } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { List, ListItem } from '@astryxdesign/core/List';
import { Section } from '@astryxdesign/core/Section';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import type {
  ActiveSession,
  ErrorEnvelope,
  PortalAppointmentSummary,
  PortalSimulationMode,
} from '../_lib/types';
import {
  UUID_PATTERN,
  appointmentStatusLabel,
  checkInStatusLabel,
  formatSlotDateTime,
} from './portal-utils';

const SAMPLE_OWN_UUID = '00000000-0000-4000-8000-000000000301';
const SAMPLE_CROSS_TENANT_UUID = '00000000-0000-4000-8000-000000000310';

interface AppointmentsWorkspaceProps {
  session: ActiveSession;
  simMode: PortalSimulationMode;
  selectedAppointmentId: string | null;
  refreshTrigger: number;
  onClearSelectedAppointmentId: () => void;
  onResetSimMode: () => void;
  onDegraded: (error: ErrorEnvelope['error']) => void;
  onClearDegraded: () => void;
}

export function AppointmentsWorkspace({
  session,
  simMode,
  selectedAppointmentId,
  refreshTrigger,
  onClearSelectedAppointmentId,
  onResetSimMode,
  onDegraded,
  onClearDegraded,
}: AppointmentsWorkspaceProps) {
  const isCompactViewport = useMediaQuery('(max-width: 767px)');

  const [appointments, setAppointments] = useState<PortalAppointmentSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<ErrorEnvelope['error'] | null>(null);

  const [lookupId, setLookupId] = useState('');
  const [lookupTouched, setLookupTouched] = useState(false);
  const [lookupSubmitted, setLookupSubmitted] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<ErrorEnvelope['error'] | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDetail, setDrawerDetail] = useState<PortalAppointmentSummary | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<ErrorEnvelope['error'] | null>(null);

  const lookupContainerRef = useRef<HTMLDivElement | null>(null);

  const loadAppointments = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await fetch('/api/bff/appointments', {
        headers: { 'x-medicloud-sim': simMode },
      });
      const payload = await response.json();
      if (!response.ok) {
        const err = (payload as ErrorEnvelope).error;
        setListError(err);
        if (response.status >= 500) onDegraded(err);
        setAppointments([]);
        return;
      }
      onClearDegraded();
      setAppointments((payload.data ?? []) as PortalAppointmentSummary[]);
    } catch {
      const err = {
        code: 'network_error',
        message: 'Không thể tải danh sách lịch hẹn.',
        correlation_id: 'synthetic-client-network',
      };
      setListError(err);
      onDegraded(err);
    } finally {
      setListLoading(false);
    }
  }, [simMode, onDegraded, onClearDegraded]);

  useEffect(() => {
    void loadAppointments();
  }, [session.personaId, refreshTrigger, loadAppointments]);

  const inspectAppointment = useCallback(
    async (appointmentId: string, fromForm = false) => {
      if (fromForm) {
        setLookupError(null);
        setLookupLoading(true);
      } else {
        setDrawerError(null);
        setDrawerLoading(true);
        setDrawerOpen(true);
      }

      try {
        const response = await fetch(`/api/bff/appointments/${encodeURIComponent(appointmentId)}`, {
          headers: { 'x-medicloud-sim': simMode },
        });
        const payload = await response.json();
        if (!response.ok) {
          const err = (payload as ErrorEnvelope).error;
          if (response.status >= 500) onDegraded(err);
          if (fromForm) {
            setLookupError(err);
          } else {
            setDrawerError(err);
            setDrawerDetail(null);
          }
          return;
        }
        onClearDegraded();
        const detail = payload as PortalAppointmentSummary;
        setDrawerDetail(detail);
        setDrawerError(null);
        setDrawerOpen(true);
      } catch {
        const err = {
          code: 'private_boundary_degraded',
          message: 'Không thể kết nối ranh giới lâm sàng để tra cứu lịch hẹn.',
          correlation_id: 'synthetic-client-network',
        };
        onDegraded(err);
        if (fromForm) setLookupError(err);
        else setDrawerError(err);
      } finally {
        setLookupLoading(false);
        setDrawerLoading(false);
      }
    },
    [simMode, onDegraded, onClearDegraded],
  );

  useEffect(() => {
    if (selectedAppointmentId) {
      void inspectAppointment(selectedAppointmentId, false);
      onClearSelectedAppointmentId();
    }
  }, [selectedAppointmentId, inspectAppointment, onClearSelectedAppointmentId]);

  const trimmedLookup = lookupId.trim();
  const lookupValid = UUID_PATTERN.test(trimmedLookup);
  const showLookupValidationError =
    (lookupTouched || lookupSubmitted) && trimmedLookup.length > 0 && !lookupValid
      ? true
      : lookupSubmitted && trimmedLookup.length === 0;

  async function handleLookupSubmit(event: FormEvent) {
    event.preventDefault();
    setLookupSubmitted(true);
    setLookupError(null);
    if (!lookupValid) {
      const inputEl = lookupContainerRef.current?.querySelector('input');
      inputEl?.focus();
      return;
    }
    await inspectAppointment(trimmedLookup, true);
  }

  const columns = [
    {
      key: 'starts_at',
      header: 'Thời gian khám',
      renderCell: (item: PortalAppointmentSummary) => (
        <Text weight="medium" hasTabularNumbers>
          {formatSlotDateTime(item.starts_at)}
        </Text>
      ),
    },
    {
      key: 'doctor',
      header: 'Bác sĩ & Chuyên khoa',
      renderCell: (item: PortalAppointmentSummary) => (
        <VStack gap={0.5}>
          <Text weight="medium">{item.doctor_name}</Text>
          <Text type="supporting" color="secondary">
            {item.specialty}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'status',
      header: 'Lịch hẹn',
      renderCell: (item: PortalAppointmentSummary) => {
        const meta = appointmentStatusLabel(item.status);
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'check_in',
      header: 'Tiếp nhận',
      renderCell: (item: PortalAppointmentSummary) => {
        const meta = checkInStatusLabel(item.check_in_status);
        return <Badge label={meta.label} variant={meta.variant} />;
      },
    },
    {
      key: 'actions',
      header: 'Chi tiết',
      renderCell: (item: PortalAppointmentSummary) => (
        <Button
          label={`Xem chi tiết lịch hẹn ${item.id.slice(-4)}`}
          variant="secondary"
          size="sm"
          onClick={() => void inspectAppointment(item.id, false)}
        >
          Xem chi tiết
        </Button>
      ),
    },
  ];

  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Heading level={1} textWrap="balance">
          Lịch hẹn của phiên hiện tại & tra cứu theo mã
        </Heading>
        <Text as="p" color="secondary" textWrap="pretty">
          Danh sách chỉ hiển thị lịch hẹn thuộc phạm vi quyền hạn của {session.displayName}. Tra cứu chéo cơ sở hoặc hồ sơ khác luôn trả về 404 an toàn theo chính sách T04.
        </Text>
      </VStack>

      <Section padding={4} variant="section">
        <VStack gap={4} data-portal-form-measure>
          <Heading level={2} id="lookup-form-heading">
            Tra cứu trực tiếp theo mã lịch hẹn (UUID)
          </Heading>
          <form
            aria-labelledby="lookup-form-heading"
            onSubmit={handleLookupSubmit}
            onBlurCapture={() => setLookupTouched(true)}
            noValidate
          >
            <VStack gap={3}>
              <VStack ref={lookupContainerRef}>
                <TextInput
                  label="Mã lịch hẹn (UUID)"
                  description="Định dạng 36 ký tự dạng 00000000-0000-4000-8000-000000000301"
                  placeholder="00000000-0000-4000-8000-000000000301"
                  value={lookupId}
                  htmlName="appointment_id"
                  isRequired
                  hasClear
                  hasAutoCorrect={false}
                  autoCapitalize="none"
                  hasSpellCheck={false}
                  onChange={(value) => {
                    setLookupId(value);
                    if (lookupError) setLookupError(null);
                  }}
                  status={
                    showLookupValidationError
                      ? {
                          type: 'error',
                          message:
                            trimmedLookup.length === 0
                              ? 'Vui lòng nhập mã lịch hẹn UUID.'
                              : 'Mã lịch hẹn chưa đúng định dạng UUID 36 ký tự.',
                        }
                      : undefined
                  }
                />
              </VStack>

              <HStack gap={2} wrap="wrap">
                <Button
                  label="Tra cứu lịch hẹn"
                  type="submit"
                  variant="primary"
                  icon={<Icon icon="search" />}
                  isLoading={lookupLoading}
                />
                <Button
                  label="Điền mẫu hợp lệ cơ sở A"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLookupId(SAMPLE_OWN_UUID);
                    setLookupTouched(false);
                    setLookupError(null);
                  }}
                />
                <Button
                  label="Thử tra cứu chéo cơ sở B (404)"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLookupId(SAMPLE_CROSS_TENANT_UUID);
                    setLookupTouched(false);
                    setLookupError(null);
                  }}
                />
              </HStack>

              {lookupError ? (
                <Banner
                  status="warning"
                  title="Kết quả kiểm tra từ máy chủ"
                  description={`${lookupError.message} (Mã lỗi: ${lookupError.code} | Mã đối chiếu: ${lookupError.correlation_id})`}
                />
              ) : null}
            </VStack>
          </form>
        </VStack>
      </Section>

      {listError ? (
        <Banner
          status="error"
          title="Không thể tải danh sách lịch hẹn"
          description={`${listError.message} (Mã đối chiếu: ${listError.correlation_id})`}
          endContent={
            <Button label="Thử tải lại lịch hẹn" variant="secondary" size="sm" onClick={() => void loadAppointments()}>
              Thử lại
            </Button>
          }
        />
      ) : null}

      {listLoading ? (
        <Section padding={4} variant="section">
          <VStack gap={3} aria-busy="true">
            <Heading level={2}>Đang tải danh sách lịch hẹn</Heading>
            <Skeleton height={44} index={0} />
            <Skeleton height={44} index={1} />
            <Skeleton height={44} index={2} />
          </VStack>
        </Section>
      ) : appointments.length === 0 ? (
        <Section padding={4} variant="section">
          <EmptyState
            title="Chưa có lịch hẹn nào trong phạm vi phiên này"
            description="Hãy đặt lịch mới ở mục Đặt lịch khám hoặc khôi phục dữ liệu chuẩn nếu đang mô phỏng danh sách trống."
            icon={<Icon icon="calendar" size="lg" color="secondary" />}
            actions={
              <HStack gap={3} wrap="wrap">
                {simMode !== 'normal' ? (
                  <Button label="Khôi phục dữ liệu chuẩn" variant="primary" onClick={onResetSimMode} />
                ) : null}
                <Button label="Tải lại danh sách" variant="secondary" onClick={() => void loadAppointments()} />
              </HStack>
            }
          />
        </Section>
      ) : (
        <Section padding={4} variant="section">
          <VStack gap={4}>
            <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
              <Heading level={2} id="appointments-list-heading">
                Danh sách lịch hẹn ({appointments.length})
              </Heading>
              <Button
                label="Làm mới danh sách lịch hẹn"
                variant="secondary"
                size="sm"
                onClick={() => void loadAppointments()}
              >
                Làm mới
              </Button>
            </HStack>

            {isCompactViewport ? (
              <List hasDividers>
                {appointments.map((item) => {
                  const apptMeta = appointmentStatusLabel(item.status);
                  const checkMeta = checkInStatusLabel(item.check_in_status);
                  return (
                    <ListItem
                      key={item.id}
                      label={
                        <HStack gap={2} vAlign="center" wrap="wrap">
                          <Text weight="semibold" hasTabularNumbers>
                            {formatSlotDateTime(item.starts_at)}
                          </Text>
                          <Badge label={apptMeta.label} variant={apptMeta.variant} />
                          <Badge label={checkMeta.label} variant={checkMeta.variant} />
                        </HStack>
                      }
                      description={
                        <Text type="supporting" color="secondary">
                          {item.doctor_name} | Mã: {item.id.slice(0, 8)}...
                        </Text>
                      }
                      endContent={
                        <Button
                          label={`Xem chi tiết lịch hẹn ${item.id.slice(-4)}`}
                          variant="secondary"
                          size="sm"
                          onClick={() => void inspectAppointment(item.id, false)}
                        >
                          Chi tiết
                        </Button>
                      }
                    />
                  );
                })}
              </List>
            ) : (
              <VStack data-table-scroll-region tabIndex={0} aria-labelledby="appointments-list-heading">
                <Table data={appointments} columns={columns} idKey="id" hasHover dividers="rows" />
              </VStack>
            )}
          </VStack>
        </Section>
      )}

      <Drawer
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        label="Chi tiết lịch hẹn"
        side="end"
        width={460}
        padding={5}
      >
        <VStack gap={4}>
          <HStack gap={2} hAlign="between" vAlign="center">
            <Heading level={2}>Chi tiết lịch hẹn</Heading>
            <Button
              label="Đóng ngăn chi tiết"
              variant="ghost"
              size="sm"
              icon={<Icon icon="close" />}
              isIconOnly
              onClick={() => setDrawerOpen(false)}
            />
          </HStack>

          {drawerLoading ? (
            <VStack gap={3} aria-busy="true">
              <Skeleton height={36} index={0} />
              <Skeleton height={36} index={1} />
              <Skeleton height={36} index={2} />
            </VStack>
          ) : drawerError ? (
            <Banner
              status="error"
              title="Không thể mở chi tiết lịch hẹn"
              description={`${drawerError.message} (Mã đối chiếu: ${drawerError.correlation_id})`}
            />
          ) : drawerDetail ? (
            <List hasDividers density="compact">
              <ListItem
                label={<Text weight="semibold">Mã lịch hẹn</Text>}
                description={<Text type="code">{drawerDetail.id}</Text>}
              />
              <ListItem
                label={<Text weight="semibold">Cơ sở (Tenant UUID)</Text>}
                description={<Text type="code">{drawerDetail.tenant_id}</Text>}
              />
              <ListItem
                label={<Text weight="semibold">Bác sĩ & Chuyên khoa</Text>}
                description={
                  <Text type="supporting">
                    {drawerDetail.doctor_name} ({drawerDetail.specialty})
                  </Text>
                }
              />
              <ListItem
                label={<Text weight="semibold">Thời gian khám</Text>}
                description={
                  <Text type="supporting" hasTabularNumbers>
                    {formatSlotDateTime(drawerDetail.starts_at)}
                  </Text>
                }
              />
              <ListItem
                label={<Text weight="semibold">Trạng thái đặt lịch</Text>}
                endContent={
                  <Badge
                    label={appointmentStatusLabel(drawerDetail.status).label}
                    variant={appointmentStatusLabel(drawerDetail.status).variant}
                  />
                }
              />
              <ListItem
                label={<Text weight="semibold">Trạng thái tiếp nhận</Text>}
                description={
                  drawerDetail.checked_in_at ? (
                    <Text type="supporting" hasTabularNumbers>
                      Tiếp nhận lúc: {formatSlotDateTime(drawerDetail.checked_in_at)}
                    </Text>
                  ) : undefined
                }
                endContent={
                  <Badge
                    label={checkInStatusLabel(drawerDetail.check_in_status).label}
                    variant={checkInStatusLabel(drawerDetail.check_in_status).variant}
                  />
                }
              />
              <ListItem
                label={<Text weight="semibold">Mã đối chiếu (Correlation ID)</Text>}
                description={<Text type="code">{drawerDetail.correlation_id}</Text>}
              />
            </List>
          ) : null}
        </VStack>
      </Drawer>
    </VStack>
  );
}
