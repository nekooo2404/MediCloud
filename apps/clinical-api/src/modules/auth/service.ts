import {createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual} from 'node:crypto';
import type {MembershipRole, PrismaClient} from '@prisma/client';
import {setTransactionTenantContext} from '../../db/tenant-rls.js';

export class AuthServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface AuthenticatedAccountSession {
  sessionId?: string;
  subject: string;
  userId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  role: MembershipRole;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  patientId?: string;
  patientRef?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function registerPatientUser(
  prisma: PrismaClient,
  input: {
    fullName: string;
    email: string;
    password: string;
    tenantCode?: string;
  },
): Promise<{session: AuthenticatedAccountSession; emailVerificationToken: string}> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (fullName.length < 2 || fullName.length > 160) {
    throw new AuthServiceError(400, 'invalid_full_name', 'Họ và tên phải có từ 2 đến 160 ký tự.');
  }
  if (!EMAIL_RE.test(email) || email.length > 255) {
    throw new AuthServiceError(400, 'invalid_email', 'Địa chỉ email không hợp lệ.');
  }
  if (password.length < 12 || password.length > 128) {
    throw new AuthServiceError(400, 'invalid_password', 'Mật khẩu phải có ít nhất 12 ký tự.');
  }

  const existing = await prisma.user.findUnique({
    where: {email},
    select: {id: true},
  });
  if (existing) {
    throw new AuthServiceError(409, 'email_already_exists', 'Email này đã được đăng ký tài khoản.');
  }

  const tenant = input.tenantCode
    ? await prisma.tenant.findFirst({
        where: {code: input.tenantCode, status: 'ACTIVE'},
      })
    : await prisma.tenant.findFirst({
        where: {status: 'ACTIVE'},
        orderBy: {code: 'asc'},
      });

  if (!tenant) {
    throw new AuthServiceError(503, 'tenant_unavailable', 'Chưa có cơ sở y tế khả dụng để đăng ký.');
  }

  const subject = `user-${randomUUID()}`;
  const profileRef = `pat-${randomUUID().slice(0, 12)}`;
  const medicalRecordCode = `MC-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
  const passwordHash = hashPassword(password);
  const emailVerificationToken = randomBytes(24).toString('base64url');
  const emailVerificationTokenHash = hashOpaqueToken(emailVerificationToken);
  const sessionSecret = randomBytes(24).toString('base64url');

  const created = await prisma.$transaction(async (tx) => {
    await setTransactionTenantContext(tx, tenant.id);
    const user = await tx.user.create({
      data: {
        subject,
        email,
        passwordHash,
        displayName: fullName,
        emailVerificationTokenHash,
        status: 'ACTIVE',
      },
    });
    await tx.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: 'PATIENT',
      },
    });
    const patient = await tx.patient.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        profileRef,
        status: 'ACTIVE',
      },
    });
    await tx.patientProfile.create({
      data: {
        tenantId: tenant.id,
        patientId: patient.id,
        displayName: fullName,
        medicalRecordCode,
      },
    });
    const userSession = await tx.userSession.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        tokenHash: hashOpaqueToken(sessionSecret),
        role: 'PATIENT',
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return {user, patient, userSession};
  });

  return {
    emailVerificationToken,
    session: {
      sessionId: created.userSession.id,
      subject: created.user.subject,
      userId: created.user.id,
      email,
      emailVerified: false,
      displayName: fullName,
      role: 'PATIENT',
      tenantId: tenant.id,
      tenantCode: tenant.code,
      tenantName: tenant.name,
      patientId: created.patient.id,
      patientRef: created.patient.profileRef,
    },
  };
}

export async function authenticateUserByPassword(
  prisma: PrismaClient,
  input: {
    email: string;
    password: string;
  },
): Promise<AuthenticatedAccountSession> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!EMAIL_RE.test(email) || !password) {
    throw new AuthServiceError(400, 'invalid_credentials_format', 'Vui lòng nhập email và mật khẩu hợp lệ.');
  }

  const user = await prisma.user.findUnique({
    where: {email},
    include: {
      memberships: {
        where: {revokedAt: null},
        include: {tenant: true},
      },
      patients: {
        where: {status: 'ACTIVE'},
        include: {profile: true},
      },
    },
  });

  if (!user || user.status !== 'ACTIVE' || !verifyPassword(password, user.passwordHash)) {
    throw new AuthServiceError(401, 'invalid_credentials', 'Email hoặc mật khẩu không chính xác.');
  }

  const activeMembership =
    user.memberships.find((m) => m.tenant.status === 'ACTIVE' && ['PHYSICIAN', 'RECEPTIONIST', 'NURSE', 'AUDITOR'].includes(m.role)) ??
    user.memberships.find((m) => m.tenant.status === 'ACTIVE');

  if (!activeMembership) {
    throw new AuthServiceError(403, 'membership_required', 'Tài khoản chưa được cấp quyền truy cập cơ sở y tế.');
  }

  const patient = user.patients.find((p) => p.tenantId === activeMembership.tenantId) ?? user.patients[0];
  const displayName = patient?.profile?.displayName ?? user.displayName ?? email;
  const sessionSecret = randomBytes(24).toString('base64url');
  const userSession = await prisma.userSession.create({
    data: {
      userId: user.id,
      tenantId: activeMembership.tenantId,
      tokenHash: hashOpaqueToken(sessionSecret),
      role: activeMembership.role,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  return {
    sessionId: userSession.id,
    subject: user.subject,
    userId: user.id,
    email,
    emailVerified: Boolean(user.emailVerifiedAt),
    displayName,
    role: activeMembership.role,
    tenantId: activeMembership.tenantId,
    tenantCode: activeMembership.tenant.code,
    tenantName: activeMembership.tenant.name,
    patientId: patient?.id,
    patientRef: patient?.profileRef,
  };
}

export async function verifyEmailByToken(prisma: PrismaClient, rawToken: string): Promise<{verified: boolean; email: string}> {
  const token = rawToken.trim();
  if (!token) {
    throw new AuthServiceError(400, 'invalid_verification_token', 'Mã xác minh email không hợp lệ.');
  }
  const tokenHash = hashOpaqueToken(token);
  const user = await prisma.user.findFirst({
    where: {emailVerificationTokenHash: tokenHash, status: 'ACTIVE'},
    select: {id: true, email: true},
  });
  if (!user || !user.email) {
    throw new AuthServiceError(404, 'verification_token_not_found', 'Mã xác minh email không tồn tại hoặc đã được sử dụng.');
  }
  await prisma.user.update({
    where: {id: user.id},
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
    },
  });
  return {verified: true, email: user.email};
}

export async function requestPasswordReset(
  prisma: PrismaClient,
  rawEmail: string,
): Promise<{accepted: boolean; resetToken?: string}> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new AuthServiceError(400, 'invalid_email', 'Vui lòng nhập địa chỉ email hợp lệ.');
  }
  const user = await prisma.user.findUnique({
    where: {email},
    select: {id: true, status: true},
  });
  if (!user || user.status !== 'ACTIVE') {
    // Disclosure-safe response
    return {accepted: true};
  }
  const resetToken = randomBytes(24).toString('base64url');
  await prisma.user.update({
    where: {id: user.id},
    data: {
      passwordResetTokenHash: hashOpaqueToken(resetToken),
      passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });
  return {accepted: true, resetToken};
}

export async function resetPasswordByToken(
  prisma: PrismaClient,
  input: {token: string; newPassword: string},
): Promise<{reset: boolean}> {
  const token = input.token.trim();
  if (!token) {
    throw new AuthServiceError(400, 'invalid_reset_token', 'Mã đặt lại mật khẩu không hợp lệ.');
  }
  if (input.newPassword.length < 12 || input.newPassword.length > 128) {
    throw new AuthServiceError(400, 'invalid_password', 'Mật khẩu mới phải có ít nhất 12 ký tự.');
  }
  const tokenHash = hashOpaqueToken(token);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: {gt: new Date()},
      status: 'ACTIVE',
    },
    select: {id: true},
  });
  if (!user) {
    throw new AuthServiceError(400, 'reset_token_expired', 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
  }
  await prisma.$transaction([
    prisma.user.update({
      where: {id: user.id},
      data: {
        passwordHash: hashPassword(input.newPassword),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    }),
    prisma.userSession.updateMany({
      where: {userId: user.id, revokedAt: null},
      data: {revokedAt: new Date()},
    }),
  ]);
  return {reset: true};
}

export async function changeUserPassword(
  prisma: PrismaClient,
  input: {subject: string; currentPassword: string; newPassword: string; currentSessionId?: string},
): Promise<{changed: boolean}> {
  if (input.newPassword.length < 12 || input.newPassword.length > 128) {
    throw new AuthServiceError(400, 'invalid_password', 'Mật khẩu mới phải có ít nhất 12 ký tự.');
  }
  const user = await prisma.user.findUnique({
    where: {subject: input.subject},
    select: {id: true, passwordHash: true, status: true},
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new AuthServiceError(404, 'user_not_found', 'Không tìm thấy tài khoản.');
  }
  if (!verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new AuthServiceError(401, 'invalid_current_password', 'Mật khẩu hiện tại không chính xác.');
  }
  await prisma.$transaction([
    prisma.user.update({
      where: {id: user.id},
      data: {passwordHash: hashPassword(input.newPassword)},
    }),
    prisma.userSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(input.currentSessionId ? {id: {not: input.currentSessionId}} : {}),
      },
      data: {revokedAt: new Date()},
    }),
  ]);
  return {changed: true};
}

export async function isSessionActive(prisma: PrismaClient, sessionId: string): Promise<boolean> {
  const session = await prisma.userSession.findUnique({
    where: {id: sessionId},
    select: {revokedAt: true, expiresAt: true, user: {select: {status: true}}},
  });
  if (!session) return false;
  return session.revokedAt === null && session.expiresAt.getTime() > Date.now() && session.user.status === 'ACTIVE';
}

export async function revokeSession(prisma: PrismaClient, sessionId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: {id: sessionId, revokedAt: null},
    data: {revokedAt: new Date()},
  });
}
