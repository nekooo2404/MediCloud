'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { List, ListItem } from '@astryxdesign/core/List';
import { Section } from '@astryxdesign/core/Section';
import { Selector } from '@astryxdesign/core/Selector';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import type {
  ActiveSession,
  Appointment,
  DoctorSummary,
  ErrorEnvelope,
  PortalSimulationMode,
  Slot,
  Specialty,
} from '../_lib/types';
import { formatSlotDateTime, generateIdempotencyKey } from './portal-utils';

const IDEMPOTENCY_PATTERN = /^[\w-]{16,128}$/;

interface BookingWorkspaceProps {
  session: ActiveSession;
  simMode: PortalSimulationMode;
  onResetSimMode: () => void;
  onDegraded: (error: ErrorEnvelope['error']) => void;
  onClearDegraded: () => void;
  onAppointmentCreated: () => void;
  onInspectAppointment: (appointmentId: string) => void;
}

export function BookingWorkspace({
  session,
  simMode,
  onResetSimMode,
  onDegraded,
  onClearDegraded,
  onAppointmentCreated,
  onInspectAppointment,
}: BookingWorkspaceProps) {
  const isCompactViewport = useMediaQuery('(max-width: 767px)');

  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('ALL');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<ErrorEnvelope['error'] | null>(null);
  const [slotsError, setSlotsError] = useState<ErrorEnvelope['error'] | null>(null);

  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [idempotencyTouched, setIdempotencyTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<ErrorEnvelope['error'] | null>(null);
  const [lastBookedKey, setLastBookedKey] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ appointment: Appointment; replayed: boolean } | null>(null);

  const idempotencyContainerRef = useRef<HTMLDivElement | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const response = await fetch('/api/bff/catalog', {
        headers: { 'x-medicloud-sim': simMode },
      });
      const data = await response.json();
      if (!response.ok) {
        const err = (data as ErrorEnvelope).error;
        setCatalogError(err);
        if (response.status >= 500) onDegraded(err);
        setSpecialties([]);
        setDoctors([]);
        setSelectedDoctorId('');
        return;
      }
      onClearDegraded();
      const loadedSpecialties = (data.specialties ?? []) as Specialty[];
      const loadedDoctors = (data.doctors ?? []) as DoctorSummary[];
      setSpecialties(loadedSpecialties);
      setDoctors(loadedDoctors);
      setSelectedSpecialty('ALL');
      setSelectedDoctorId(loadedDoctors[0]?.id ?? '');
    } catch {
      const fallbackErr = {
        code: 'network_error',
        message: 'Không thể tải danh mục chuyên khoa và bác sĩ.',
        correlation_id: 'synthetic-client-network',
      };
      setCatalogError(fallbackErr);
      onDegraded(fallbackErr);
    } finally {
      setCatalogLoading(false);
    }
  }, [simMode, onDegraded, onClearDegraded]);

  useEffect(() => {
    if (simMode !== 'normal') {
      setReceipt(null);
    }
    void loadCatalog();
  }, [session.personaId, simMode, loadCatalog]);

  const filteredDoctors = useMemo(() => {
    if (selectedSpecialty === 'ALL') return doctors;
    return doctors.filter((doc) => doc.specialty === selectedSpecialty);
  }, [doctors, selectedSpecialty]);

  const activeDoctor = useMemo(
    () => filteredDoctors.find((doc) => doc.id === selectedDoctorId) ?? filteredDoctors[0] ?? null,
    [filteredDoctors, selectedDoctorId],
  );

  const loadSlots = useCallback(
    async (doctorId: string) => {
      if (!doctorId) {
        setSlots([]);
        return;
      }
      setSlotsLoading(true);
      setSlotsError(null);
      try {
        const response = await fetch(`/api/bff/slots?doctor_id=${encodeURIComponent(doctorId)}`, {
          headers: { 'x-medicloud-sim': simMode },
        });
        const data = await response.json();
        if (!response.ok) {
          const err = (data as ErrorEnvelope).error;
          setSlotsError(err);
          if (response.status >= 500) onDegraded(err);
          setSlots([]);
          return;
        }
        onClearDegraded();
        setSlots((data.data ?? []) as Slot[]);
      } catch {
        const fallbackErr = {
          code: 'network_error',
          message: 'Không thể tải danh sách khung giờ khám.',
          correlation_id: 'synthetic-client-network',
        };
        setSlotsError(fallbackErr);
        onDegraded(fallbackErr);
      } finally {
        setSlotsLoading(false);
      }
    },
    [simMode, onDegraded, onClearDegraded],
  );

  useEffect(() => {
    if (activeDoctor) {
      if (activeDoctor.id !== selectedDoctorId) {
        setSelectedDoctorId(activeDoctor.id);
      }
      void loadSlots(activeDoctor.id);
    } else {
      setSlots([]);
    }
  }, [activeDoctor, selectedDoctorId, loadSlots]);

  function openBookingDialog(slot: Slot) {
    setBookingSlot(slot);
    setIdempotencyKey(generateIdempotencyKey());
    setIdempotencyTouched(false);
    setSubmitAttempted(false);
    setBookingError(null);
  }

  const idempotencyValid = IDEMPOTENCY_PATTERN.test(idempotencyKey.trim());
  const showIdempotencyError = (idempotencyTouched || submitAttempted) && !idempotencyValid;

  async function handleConfirmBooking(event: FormEvent) {
    event.preventDefault();
    setSubmitAttempted(true);
    setBookingError(null);
    if (!bookingSlot) return;

    const trimmedKey = idempotencyKey.trim();
    if (!IDEMPOTENCY_PATTERN.test(trimmedKey)) {
      const inputEl = idempotencyContainerRef.current?.querySelector('input');
      inputEl?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/bff/appointments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': trimmedKey,
          'x-medicloud-sim': simMode,
        },
        body: JSON.stringify({
          slot_id: bookingSlot.id,
          idempotency_key: trimmedKey,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const err = (payload as ErrorEnvelope).error;
        setBookingError(err);
        if (response.status >= 500) {
          setReceipt(null);
          onDegraded(err);
        }
        return;
      }

      onClearDegraded();
      const replayed = response.headers.get('x-idempotent-replay') === 'true';
      const appointment = payload as Appointment;
      setLastBookedKey(trimmedKey);
      setReceipt({ appointment, replayed });
      setBookingSlot(null);
      onAppointmentCreated();
      if (activeDoctor) {
        void loadSlots(activeDoctor.id);
      }
    } catch {
      const fallbackErr = {
        code: 'private_boundary_degraded',
        message: 'Mất kết nối trong lúc đặt lịch. Chưa có lịch hẹn nào được xác nhận.',
        correlation_id: 'synthetic-client-network',
      };
      setReceipt(null);
      setBookingError(fallbackErr);
      onDegraded(fallbackErr);
    } finally {
      setIsSubmitting(false);
    }
  }

  const slotColumns = [
    {
      key: 'starts_at',
      header: 'Khung giờ khám',
      renderCell: (slot: Slot) => (
        <Text weight="medium" hasTabularNumbers>
          {formatSlotDateTime(slot.starts_at)}
        </Text>
      ),
    },
    {
      key: 'doctor',
      header: 'Bác sĩ & Chuyên khoa',
      renderCell: () => (
        <VStack gap={0.5}>
          <Text weight="medium">{activeDoctor?.display_name ?? 'Bác sĩ mẫu'}</Text>
          <Text type="supporting" color="secondary">
            {activeDoctor?.specialty ?? 'Chưa phân loại'}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'capacity',
      header: 'Chỗ trống',
      renderCell: (slot: Slot) => (
        <Text hasTabularNumbers>
          {slot.remaining} / {slot.capacity}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      renderCell: (slot: Slot) => (
        <Badge
          label={slot.remaining > 0 ? 'Còn chỗ' : 'Đã kín'}
          variant={slot.remaining > 0 ? 'green' : 'neutral'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      renderCell: (slot: Slot) => (
        <Button
          label={`Chọn đặt lịch ${formatSlotDateTime(slot.starts_at)}`}
          variant={slot.remaining > 0 ? 'primary' : 'secondary'}
          size="sm"
          isDisabled={slot.remaining === 0}
          onClick={() => openBookingDialog(slot)}
        >
          {slot.remaining > 0 ? 'Chọn đặt lịch' : 'Hết chỗ'}
        </Button>
      ),
    },
  ];

  const specialtyOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Tất cả chuyên khoa' },
      ...specialties.map((item) => ({ value: item.name, label: item.name })),
    ],
    [specialties],
  );

  const doctorOptions = useMemo(
    () =>
      filteredDoctors.map((doc) => ({
        value: doc.id,
        label: doc.display_name,
        description: doc.specialty,
      })),
    [filteredDoctors],
  );

  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Heading level={1} textWrap="balance">
          Đặt lịch khám bệnh nhân & tiếp nhận theo khung giờ
        </Heading>
        <Text as="p" color="secondary" textWrap="pretty">
          Chọn chuyên khoa và bác sĩ thuộc {session.tenantName}. Mọi lượt đặt lịch sử dụng khóa chống trùng lặp Idempotency-Key và giữ chỗ theo giao dịch cơ sở dữ liệu.
        </Text>
      </VStack>

      {receipt ? (
        <Banner
          status="success"
          title={
            receipt.replayed
              ? 'Kết quả phát lại an toàn theo Idempotency-Key (không tạo lịch hẹn trùng)'
              : 'Đặt lịch khám thành công'
          }
          description={`Mã lịch hẹn: ${receipt.appointment.id} | Mã đối chiếu: ${receipt.appointment.correlation_id}`}
          endContent={
            <Button
              label="Xem chi tiết lịch hẹn vừa đặt"
              variant="secondary"
              size="sm"
              onClick={() => onInspectAppointment(receipt.appointment.id)}
            >
              Xem chi tiết
            </Button>
          }
          isDismissable
          onDismiss={() => setReceipt(null)}
        />
      ) : null}

      {catalogError && !slotsError ? (
        <Banner
          status="error"
          title="Không tải được danh mục bác sĩ"
          description={`${catalogError.message} (Mã đối chiếu: ${catalogError.correlation_id})`}
          endContent={
            <Button label="Thử tải lại danh mục" variant="secondary" size="sm" onClick={() => void loadCatalog()}>
              Thử lại
            </Button>
          }
        />
      ) : null}

      <Section padding={4} variant="section">
        <search>
          <HStack gap={4} vAlign="end" wrap="wrap">
            <Selector
              label="Chuyên khoa"
              width={isCompactViewport ? '100%' : 240}
              value={selectedSpecialty}
              options={specialtyOptions}
              isDisabled={catalogLoading || specialties.length === 0}
              onChange={(nextValue) => {
                const chosen = nextValue ?? 'ALL';
                setSelectedSpecialty(chosen);
                const firstDoc = doctors.find((doc) => chosen === 'ALL' || doc.specialty === chosen);
                setSelectedDoctorId(firstDoc?.id ?? '');
              }}
            />
            <Selector
              label="Bác sĩ phụ trách"
              width={isCompactViewport ? '100%' : 280}
              value={activeDoctor?.id ?? null}
              options={doctorOptions}
              placeholder="Chọn bác sĩ..."
              emptyText="Không có bác sĩ phù hợp"
              isDisabled={catalogLoading || doctorOptions.length === 0}
              onChange={(nextValue) => {
                if (nextValue) setSelectedDoctorId(nextValue);
              }}
            />
            <Button
              label="Tải lại khung giờ"
              variant="secondary"
              icon={<Icon icon="calendar" />}
              isLoading={slotsLoading || catalogLoading}
              onClick={() => {
                if (activeDoctor) {
                  void loadSlots(activeDoctor.id);
                } else {
                  void loadCatalog();
                }
              }}
            />
          </HStack>
        </search>
      </Section>

      {slotsError ? (
        <Banner
          status="error"
          title="Không thể truy vấn khung giờ trống"
          description={`${slotsError.message} (Mã đối chiếu: ${slotsError.correlation_id})`}
          endContent={
            <Button
              label="Thử tải lại khung giờ"
              variant="secondary"
              size="sm"
              onClick={() => activeDoctor && void loadSlots(activeDoctor.id)}
            >
              Thử lại
            </Button>
          }
        />
      ) : null}

      {catalogLoading || slotsLoading ? (
        <Section padding={4} variant="section">
          <VStack gap={3} aria-busy="true">
            <Heading level={2}>Đang tải danh sách khung giờ</Heading>
            <Skeleton height={44} index={0} />
            <Skeleton height={44} index={1} />
            <Skeleton height={44} index={2} />
            <Skeleton height={44} index={3} />
          </VStack>
        </Section>
      ) : slots.length === 0 ? (
        <Section padding={4} variant="section">
          <EmptyState
            title="Hiện chưa có khung giờ khám khả dụng"
            description="Không tìm thấy khung giờ phù hợp với bộ lọc hoặc đang ở chế độ mô phỏng danh sách trống."
            icon={<Icon icon="calendar" size="lg" color="secondary" />}
            actions={
              <HStack gap={3} wrap="wrap">
                {simMode !== 'normal' ? (
                  <Button label="Khôi phục dữ liệu chuẩn" variant="primary" onClick={onResetSimMode} />
                ) : null}
                <Button
                  label="Tải lại danh mục"
                  variant="secondary"
                  onClick={() => {
                    setSelectedSpecialty('ALL');
                    void loadCatalog();
                  }}
                />
              </HStack>
            }
          />
        </Section>
      ) : (
        <Section padding={4} variant="section">
          <VStack gap={4}>
            <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
              <Heading level={2} id="slots-heading">
                Khung giờ khám của {activeDoctor?.display_name ?? 'bác sĩ'}
              </Heading>
              <Text type="supporting" color="secondary" hasTabularNumbers>
                Tổng cộng {slots.length} khung giờ
              </Text>
            </HStack>

            {isCompactViewport ? (
              <List hasDividers>
                {slots.map((slot) => (
                  <ListItem
                    key={slot.id}
                    label={
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Text weight="semibold" hasTabularNumbers>
                          {formatSlotDateTime(slot.starts_at)}
                        </Text>
                        <Badge
                          label={slot.remaining > 0 ? 'Còn chỗ' : 'Đã kín'}
                          variant={slot.remaining > 0 ? 'green' : 'neutral'}
                        />
                      </HStack>
                    }
                    description={
                      <Text type="supporting" color="secondary" hasTabularNumbers>
                        {activeDoctor?.specialty ?? ''} | Còn {slot.remaining} / {slot.capacity} chỗ
                      </Text>
                    }
                    endContent={
                      <Button
                        label={`Chọn đặt lịch ${formatSlotDateTime(slot.starts_at)}`}
                        variant={slot.remaining > 0 ? 'primary' : 'secondary'}
                        size="sm"
                        isDisabled={slot.remaining === 0}
                        onClick={() => openBookingDialog(slot)}
                      >
                        {slot.remaining > 0 ? 'Đặt lịch' : 'Hết chỗ'}
                      </Button>
                    }
                  />
                ))}
              </List>
            ) : (
              <VStack data-table-scroll-region tabIndex={0} aria-labelledby="slots-heading">
                <Table data={slots} columns={slotColumns} idKey="id" hasHover dividers="rows" />
              </VStack>
            )}
          </VStack>
        </Section>
      )}

      <Dialog
        isOpen={Boolean(bookingSlot)}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            setBookingSlot(null);
          }
        }}
        purpose="form"
        width={480}
        padding={5}
      >
        <DialogHeader
          title="Xác nhận đặt lịch khám"
          subtitle={bookingSlot ? formatSlotDateTime(bookingSlot.starts_at) : undefined}
          onOpenChange={(open) => {
            if (!open && !isSubmitting) setBookingSlot(null);
          }}
        />
        <form
          onSubmit={handleConfirmBooking}
          onBlurCapture={() => setIdempotencyTouched(true)}
          noValidate
        >
          <VStack gap={4} paddingBlockStart={4}>
            {bookingError ? (
              <Banner
                status="error"
                title={
                  bookingError.code === 'private_boundary_degraded'
                    ? 'Gián đoạn ranh giới lâm sàng: chưa đặt lịch'
                    : 'Không thể hoàn tất đặt lịch'
                }
                description={`${bookingError.message} (Mã đối chiếu: ${bookingError.correlation_id})`}
              />
            ) : null}

            <List hasDividers density="compact">
              <ListItem
                label={<Text weight="semibold">Cơ sở y tế (từ phiên xác thực)</Text>}
                description={<Text type="supporting">{session.tenantName}</Text>}
              />
              <ListItem
                label={<Text weight="semibold">Bác sĩ & Chuyên khoa</Text>}
                description={
                  <Text type="supporting">
                    {activeDoctor?.display_name ?? ''} ({activeDoctor?.specialty ?? ''})
                  </Text>
                }
              />
              <ListItem
                label={<Text weight="semibold">Khung giờ chọn</Text>}
                description={
                  <Text type="supporting" hasTabularNumbers>
                    {bookingSlot ? formatSlotDateTime(bookingSlot.starts_at) : ''}
                  </Text>
                }
              />
            </List>

            <VStack ref={idempotencyContainerRef} gap={2}>
              <TextInput
                label="Khóa chống trùng lặp (Idempotency-Key)"
                description="Từ 16 đến 128 ký tự (chữ, số, gạch nối). Giữ nguyên khóa cũ cho cùng khung giờ sẽ phát lại kết quả an toàn."
                value={idempotencyKey}
                htmlName="idempotency_key"
                isRequired
                hasAutoCorrect={false}
                autoCapitalize="none"
                hasSpellCheck={false}
                onChange={(val) => {
                  setIdempotencyKey(val);
                  if (bookingError) setBookingError(null);
                }}
                status={
                  showIdempotencyError
                    ? {
                        type: 'error',
                        message: 'Vui lòng nhập từ 16 đến 128 ký tự chữ, số hoặc dấu gạch nối.',
                      }
                    : undefined
                }
              />
              {lastBookedKey ? (
                <HStack gap={2} wrap="wrap">
                  <Button
                    label="Dùng lại khóa giao dịch vừa rồi"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIdempotencyKey(lastBookedKey);
                      setIdempotencyTouched(true);
                    }}
                  />
                  <Button
                    label="Tạo khóa mới"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIdempotencyKey(generateIdempotencyKey());
                      setIdempotencyTouched(false);
                    }}
                  />
                </HStack>
              ) : null}
            </VStack>

            <HStack gap={3} hAlign="end" wrap="wrap">
              <Button
                label="Hủy"
                variant="secondary"
                isDisabled={isSubmitting}
                onClick={() => setBookingSlot(null)}
              />
              <Button
                label="Xác nhận đặt lịch"
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
              />
            </HStack>
          </VStack>
        </form>
      </Dialog>
    </VStack>
  );
}
