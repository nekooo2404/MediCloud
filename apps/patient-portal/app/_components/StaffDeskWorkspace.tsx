'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { List, ListItem } from '@astryxdesign/core/List';
import { Section } from '@astryxdesign/core/Section';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import type {
  ActiveSession,
  Appointment,
  ErrorEnvelope,
  PortalAppointmentSummary,
  PortalSimulationMode,
  SyntheticPersonaId,
} from '../_lib/types';
import {
  appointmentStatusLabel,
  checkInStatusLabel,
  formatSlotDateTime,
} from './portal-utils';

interface StaffDeskWorkspaceProps {
  session: ActiveSession;
  simMode: PortalSimulationMode;
  refreshTrigger: number;
  onSwitchPersona: (personaId: SyntheticPersonaId) => void;
  onResetSimMode: () => void;
  onDegraded: (error: ErrorEnvelope['error']) => void;
  onClearDegraded: () => void;
  onCheckInCompleted: () => void;
}

export function StaffDeskWorkspace({
  session,
  simMode,
  refreshTrigger,
  onSwitchPersona,
  onResetSimMode,
  onDegraded,
  onClearDegraded,
  onCheckInCompleted,
}: StaffDeskWorkspaceProps) {
  const isCompactViewport = useMediaQuery('(max-width: 767px)');

  const [appointments, setAppointments] = useState<PortalAppointmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending_checkin' | 'checked_in'>('all');
  const [listError, setListError] = useState<ErrorEnvelope['error'] | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<PortalAppointmentSummary | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [actionBanner, setActionBanner] = useState<{
    status: 'success' | 'error' | 'warning';
    title: string;
    description: string;
  } | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
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
        message: 'Không thể tải hàng đợi tiếp nhận.',
        correlation_id: 'synthetic-client-network',
      };
      setListError(err);
      onDegraded(err);
    } finally {
      setLoading(false);
    }
  }, [simMode, onDegraded, onClearDegraded]);

  useEffect(() => {
    void loadQueue();
  }, [session.personaId, refreshTrigger, loadQueue]);

  const filteredAppointments = useMemo(() => {
    if (filter === 'pending_checkin') {
      return appointments.filter(
        (item) => item.status === 'confirmed' && item.check_in_status === 'not_checked_in',
      );
    }
    if (filter === 'checked_in') {
      return appointments.filter((item) => item.check_in_status === 'checked_in');
    }
    return appointments;
  }, [appointments, filter]);

  async function executeCheckIn(appointmentId: string) {
    setCheckingIn(true);
    setActionBanner(null);
    try {
      const response = await fetch(`/api/bff/appointments/${encodeURIComponent(appointmentId)}/check-in`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-medicloud-sim': simMode,
        },
        body: JSON.stringify({ check_in_channel: 'desk' }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const err = (payload as ErrorEnvelope).error;
        if (response.status >= 500) onDegraded(err);
        setActionBanner({
          status: response.status === 403 ? 'warning' : 'error',
          title:
            response.status === 403
              ? 'Máy chủ từ chối thao tác tiếp nhận (403)'
              : 'Không thể hoàn tất tiếp nhận',
          description: `${err.message} (Mã lỗi: ${err.code} | Mã đối chiếu: ${err.correlation_id})`,
        });
        setConfirmTarget(null);
        return;
      }

      onClearDegraded();
      const updated = payload as Appointment;
      setConfirmTarget(null);
      setActionBanner({
        status: 'success',
        title: 'Đã tiếp nhận bệnh nhân tại quầy',
        description: `Mã lịch hẹn: ${updated.id} | Tiếp nhận lúc: ${formatSlotDateTime(updated.checked_in_at ?? '')} | Mã đối chiếu: ${updated.correlation_id}`,
      });
      onCheckInCompleted();
      await loadQueue();
    } catch {
      const err = {
        code: 'private_boundary_degraded',
        message: 'Mất kết nối trong lúc tiếp nhận tại quầy. Chưa có trạng thái nào thay đổi.',
        correlation_id: 'synthetic-client-network',
      };
      onDegraded(err);
      setActionBanner({
        status: 'error',
        title: 'Gián đoạn ranh giới lâm sàng',
        description: `${err.message} (Mã đối chiếu: ${err.correlation_id})`,
      });
      setConfirmTarget(null);
    } finally {
      setCheckingIn(false);
    }
  }

  const columns = [
    {
      key: 'starts_at',
      header: 'Giờ hẹn',
      renderCell: (item: PortalAppointmentSummary) => (
        <Text weight="medium" hasTabularNumbers>
          {formatSlotDateTime(item.starts_at)}
        </Text>
      ),
    },
    {
      key: 'patient',
      header: 'Hồ sơ & Bác sĩ',
      renderCell: (item: PortalAppointmentSummary) => (
        <VStack gap={0.5}>
          <Text weight="medium">{item.patient_ref}</Text>
          <Text type="supporting" color="secondary">
            {item.doctor_name} ({item.specialty})
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
      key: 'action',
      header: 'Thao tác quầy',
      renderCell: (item: PortalAppointmentSummary) => {
        const alreadyCheckedIn = item.check_in_status === 'checked_in';
        const invalidState = item.status !== 'confirmed';
        return (
          <Button
            label={`Tiếp nhận lịch hẹn ${item.id.slice(-4)}`}
            variant={alreadyCheckedIn ? 'secondary' : 'primary'}
            size="sm"
            isDisabled={session.role !== 'RECEPTIONIST' || invalidState}
            onClick={() => setConfirmTarget(item)}
          >
            {alreadyCheckedIn ? 'Kiểm tra lại (Idempotent)' : 'Tiếp nhận tại quầy'}
          </Button>
        );
      },
    },
  ];

  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Heading level={1} textWrap="balance">
          Quầy tiếp nhận bệnh nhân (Staff Check-In)
        </Heading>
        <Text as="p" color="secondary" textWrap="pretty">
          Chỉ tài khoản vai trò RECEPTIONIST trong cùng cơ sở mới được tiếp nhận lịch hẹn ở trạng thái đã xác nhận. Tiếp nhận lặp lại giữ nguyên tính bất biến an toàn.
        </Text>
      </VStack>

      {session.role !== 'RECEPTIONIST' ? (
        <Banner
          status="warning"
          title="Phiên hiện tại không có quyền lễ tân (Kiểm tra ranh giới Backend)"
          description="Ẩn nút trên giao diện chỉ để hỗ trợ sử dụng, không thay thế kiểm soát truy cập máy chủ. Bạn có thể chuyển sang tài khoản Lễ tân hoặc thử gọi trực tiếp để xác nhận máy chủ trả về mã 403."
          endContent={
            <HStack gap={2} wrap="wrap">
              <Button
                label="Chuyển sang Lễ tân Cơ sở A"
                variant="primary"
                size="sm"
                onClick={() => onSwitchPersona('receptionist-hospital-a')}
              />
              {appointments[0] ? (
                <Button
                  label="Thử gọi check-in để kiểm tra 403"
                  variant="secondary"
                  size="sm"
                  isLoading={checkingIn}
                  onClick={() => void executeCheckIn(appointments[0].id)}
                />
              ) : null}
            </HStack>
          }
        />
      ) : null}

      {actionBanner ? (
        <Banner
          status={actionBanner.status}
          title={actionBanner.title}
          description={actionBanner.description}
          isDismissable
          onDismiss={() => setActionBanner(null)}
        />
      ) : null}

      {listError ? (
        <Banner
          status="error"
          title="Không thể tải hàng đợi tiếp nhận"
          description={`${listError.message} (Mã đối chiếu: ${listError.correlation_id})`}
        />
      ) : null}

      <Section padding={4} variant="section">
        <VStack gap={4}>
          <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
            <Heading level={2} id="staff-queue-heading">
              Hàng đợi tiếp nhận tại {session.tenantName}
            </Heading>
            <SegmentedControl
              label="Lọc trạng thái tiếp nhận"
              value={filter}
              onChange={(val) => setFilter(val as 'all' | 'pending_checkin' | 'checked_in')}
            >
              <SegmentedControlItem value="all" label="Tất cả" />
              <SegmentedControlItem value="pending_checkin" label="Chờ tiếp nhận" />
              <SegmentedControlItem value="checked_in" label="Đã tiếp nhận" />
            </SegmentedControl>
          </HStack>

          {loading ? (
            <VStack gap={3} aria-busy="true">
              <Skeleton height={44} index={0} />
              <Skeleton height={44} index={1} />
              <Skeleton height={44} index={2} />
            </VStack>
          ) : filteredAppointments.length === 0 ? (
            <EmptyState
              title="Không có lịch hẹn phù hợp trong hàng đợi"
              description="Thử chuyển bộ lọc trạng thái hoặc khôi phục dữ liệu chuẩn."
              icon={<Icon icon="clock" size="lg" color="secondary" />}
              actions={
                simMode !== 'normal' ? (
                  <Button label="Khôi phục dữ liệu chuẩn" variant="primary" onClick={onResetSimMode} />
                ) : (
                  <Button label="Xem tất cả" variant="secondary" onClick={() => setFilter('all')} />
                )
              }
            />
          ) : isCompactViewport ? (
            <List hasDividers>
              {filteredAppointments.map((item) => {
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
                        {item.patient_ref} | {item.doctor_name}
                      </Text>
                    }
                    endContent={
                      <Button
                        label={`Tiếp nhận lịch hẹn ${item.id.slice(-4)}`}
                        variant={item.check_in_status === 'checked_in' ? 'secondary' : 'primary'}
                        size="sm"
                        isDisabled={session.role !== 'RECEPTIONIST' || item.status !== 'confirmed'}
                        onClick={() => setConfirmTarget(item)}
                      >
                        {item.check_in_status === 'checked_in' ? 'Kiểm tra' : 'Tiếp nhận'}
                      </Button>
                    }
                  />
                );
              })}
            </List>
          ) : (
            <VStack data-table-scroll-region tabIndex={0} aria-labelledby="staff-queue-heading">
              <Table
                data={filteredAppointments}
                columns={columns}
                idKey="id"
                hasHover
                dividers="rows"
              />
            </VStack>
          )}
        </VStack>
      </Section>

      <AlertDialog
        isOpen={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open && !checkingIn) setConfirmTarget(null);
        }}
        title="Xác nhận tiếp nhận tại quầy?"
        description={
          confirmTarget
            ? `Ghi nhận tiếp nhận cho hồ sơ ${confirmTarget.patient_ref} (khung giờ ${formatSlotDateTime(confirmTarget.starts_at)}) và tạo bản ghi kiểm toán.`
            : ''
        }
        actionLabel="Xác nhận tiếp nhận"
        cancelLabel="Đóng"
        actionVariant="primary"
        isActionLoading={checkingIn}
        onAction={() => {
          if (confirmTarget) {
            void executeCheckIn(confirmTarget.id);
          }
        }}
      />
    </VStack>
  );
}
