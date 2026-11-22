'use client';

import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { Section } from '@astryxdesign/core/Section';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { SyntheticPersonaId } from '../_lib/types';

export interface PersonaOption {
  id: SyntheticPersonaId;
  displayName: string;
  tenantName: string;
  role: 'PATIENT' | 'RECEPTIONIST';
  summary: string;
}

interface SessionGateProps {
  personas: readonly PersonaOption[];
  isSigningIn: boolean;
  signingInPersonaId: SyntheticPersonaId | null;
  errorMessage: string | null;
  onSignIn: (personaId: SyntheticPersonaId) => void;
}

export function SessionGate({
  personas,
  isSigningIn,
  signingInPersonaId,
  errorMessage,
  onSignIn,
}: SessionGateProps) {
  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <Heading level={1} textWrap="balance">
          Đăng nhập phiên mẫu để bắt đầu đặt lịch và tiếp nhận
        </Heading>
        <Text as="p" color="secondary" textWrap="pretty">
          Phiên làm việc được xác thực qua cookie HttpOnly tại máy chủ BFF. Không lưu access token trên trình duyệt và mọi kiểm tra phân quyền do API lâm sàng quyết định.
        </Text>
      </VStack>

      {errorMessage ? (
        <Banner
          status="error"
          title="Không thể khởi tạo phiên mẫu"
          description={errorMessage}
        />
      ) : null}

      <Section padding={4} variant="section">
        <VStack gap={4}>
          <Heading level={2}>Chọn tài khoản mẫu P0</Heading>
          <List hasDividers>
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
                description={
                  <Text type="supporting" color="secondary">
                    {persona.tenantName}: {persona.summary}
                  </Text>
                }
                endContent={
                  <Button
                    label={`Đăng nhập ${persona.displayName}`}
                    variant={persona.id === 'patient-hospital-a' ? 'primary' : 'secondary'}
                    isLoading={isSigningIn && signingInPersonaId === persona.id}
                    isDisabled={isSigningIn && signingInPersonaId !== persona.id}
                    onClick={() => onSignIn(persona.id)}
                  >
                    Đăng nhập
                  </Button>
                }
              />
            ))}
          </List>
        </VStack>
      </Section>
    </VStack>
  );
}
