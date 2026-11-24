import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {afterAll, describe, expect, it} from 'vitest';
import {
  authenticateUserByPassword,
  changeUserPassword,
  isSessionActive,
  registerPatientUser,
  requestPasswordReset,
  resetPasswordByToken,
  revokeSession,
  verifyEmailByToken,
} from '../apps/clinical-api/src/modules/auth/service.js';
import {
  createDepartmentForTenant,
  getPatientProfileView,
  provisionStaffAccount,
  updatePatientProfileView,
} from '../apps/clinical-api/src/modules/admin/service.js';
import {checkDistributedRateLimit, renderPrometheusMetrics} from '../apps/clinical-api/src/infra/rate-limiter.js';
import {
  HOST_SESSION_COOKIE_NAME,
  buildSetSessionCookieHeader,
} from '../apps/patient-portal/app/_lib/session';
import {DELETE as deletePortalSession} from '../apps/patient-portal/app/api/bff/session/route';
import {createClinicalApiRequestHandler} from '../apps/clinical-api/src/server.js';
import type {IncomingMessage, ServerResponse} from 'node:http';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe('Production-readiness Auth, Profile, Admin & Metrics', () => {
  it('checks in-memory distributed rate limit fallback and prometheus metrics output', async () => {
    const ip = `10.99.0.${Math.floor(Math.random() * 200) + 1}`;
    expect(await checkDistributedRateLimit(ip, 2, 60_000)).toBe(true);
    expect(await checkDistributedRateLimit(ip, 2, 60_000)).toBe(true);
    expect(await checkDistributedRateLimit(ip, 2, 60_000)).toBe(false);

    const metricsText = renderPrometheusMetrics();
    expect(metricsText).toContain('medicloud_process_uptime_seconds');
  });

  it('uses __Host- prefixed Secure cookie on HTTPS requests and sends Clear-Site-Data with cache on logout', async () => {
    const setCookie = buildSetSessionCookieHeader(
      'signed.token',
      new Request('https://medicloud.example/api/bff/session'),
    );
    expect(setCookie.startsWith(`${HOST_SESSION_COOKIE_NAME}=`)).toBe(true);
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toContain('Domain=');

    const logoutResponse = await deletePortalSession(
      new Request('https://medicloud.example/api/bff/session', {method: 'DELETE'}),
    );
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get('clear-site-data')).toBe('"cookies", "storage", "cache"');
  });

  it('rejects cross-site non-navigational Fetch Metadata requests and advertises Vary headers', async () => {
    let statusCode = 0;
    let headersSent: Record<string, string | string[] | number> = {};
    let bodyText = '';
    const listeners = new Map<string, Array<() => void>>();

    const mockReq = {
      method: 'POST',
      url: '/v1/auth/login',
      headers: {
        'sec-fetch-site': 'cross-site',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        origin: 'https://evil.example',
      },
      socket: {remoteAddress: '127.0.0.1'},
    } as unknown as IncomingMessage;

    const mockRes = {
      statusCode: 200,
      on(event: string, listener: () => void) {
        const list = listeners.get(event) ?? [];
        list.push(listener);
        listeners.set(event, list);
        return this;
      },
      setHeader(name: string, value: string) {
        headersSent[name.toLowerCase()] = value;
      },
      writeHead(code: number, hdrs: Record<string, string>) {
        statusCode = code;
        headersSent = {...headersSent, ...hdrs};
        return this;
      },
      end(chunk?: string) {
        bodyText = chunk ?? '';
        for (const listener of listeners.get('finish') ?? []) {
          listener();
        }
        return this;
      },
    } as unknown as ServerResponse;

    await createClinicalApiRequestHandler(mockReq, mockRes);
    expect(statusCode).toBe(403);
    expect(String(headersSent.vary)).toContain('Sec-Fetch-Site');
    expect(JSON.parse(bodyText).error.code).toBe('cross_site_request_forbidden');
  });
});

describe.skipIf(!hasDatabase)('PostgreSQL Real Auth, Session Revocation, Profile & Admin Provisioning', () => {
  const prisma = new PrismaClient();
  const createdEmails: string[] = [];

  afterAll(async () => {
    if (createdEmails.length > 0) {
      const users = await prisma.user.findMany({
        where: {email: {in: createdEmails}},
        select: {id: true},
      });
      const userIds = users.map((u) => u.id);
      if (userIds.length > 0) {
        const pracs = await prisma.practitioner.findMany({
          where: {userId: {in: userIds}},
          select: {id: true},
        });
        const pracIds = pracs.map((p) => p.id);
        await prisma.userSession.deleteMany({where: {userId: {in: userIds}}});
        if (pracIds.length > 0) {
          await prisma.schedule.deleteMany({where: {practitionerId: {in: pracIds}}});
        }
        await prisma.practitioner.deleteMany({where: {userId: {in: userIds}}});
        await prisma.patient.deleteMany({where: {userId: {in: userIds}}});
        await prisma.membership.deleteMany({where: {userId: {in: userIds}}});
        await prisma.user.deleteMany({where: {id: {in: userIds}}});
      }
    }
    await prisma.$disconnect();
  });

  it('registers, verifies email, logs in, resets password with session revocation, and updates profile', async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const email = `patient-${uniqueId}@example.test`;
    createdEmails.push(email);

    const reg = await registerPatientUser(prisma, {
      fullName: 'Trần Văn Bình',
      email,
      password: 'StrongPassword#2026!',
    });

    expect(reg.session.email).toBe(email);
    expect(reg.session.emailVerified).toBe(false);
    expect(reg.session.sessionId).toBeTruthy();
    expect(await isSessionActive(prisma, reg.session.sessionId!)).toBe(true);

    const verified = await verifyEmailByToken(prisma, reg.emailVerificationToken);
    expect(verified.verified).toBe(true);

    const loggedIn = await authenticateUserByPassword(prisma, {
      email,
      password: 'StrongPassword#2026!',
    });
    expect(loggedIn.emailVerified).toBe(true);
    expect(loggedIn.sessionId).toBeTruthy();

    await revokeSession(prisma, reg.session.sessionId!);
    expect(await isSessionActive(prisma, reg.session.sessionId!)).toBe(false);

    const principal = {
      subject: loggedIn.subject,
      issuer: 'https://medicloud.local',
      audience: 'medicloud-api',
      roles: ['PATIENT'] as const,
      tenantIds: [loggedIn.tenantId],
      active: true,
    };

    const updated = await updatePatientProfileView(prisma, principal, {
      bloodType: 'O+',
      allergies: ['Penicillin'],
      careTeamNotes: 'Khám định kỳ',
    });
    expect(updated.bloodType).toBe('O+');
    expect(updated.allergies).toEqual(['Penicillin']);

    const profileView = await getPatientProfileView(prisma, principal);
    expect(profileView.profile.bloodType).toBe('O+');

    await changeUserPassword(prisma, {
      subject: loggedIn.subject,
      currentPassword: 'StrongPassword#2026!',
      newPassword: 'UpdatedPassword#2026!',
    });

    const resetReq = await requestPasswordReset(prisma, email);
    expect(resetReq.accepted).toBe(true);
    expect(resetReq.resetToken).toBeTruthy();

    await resetPasswordByToken(prisma, {
      token: resetReq.resetToken!,
      newPassword: 'FinalResetPass#2026!',
    });

    // All previous sessions must be revoked after password reset
    expect(await isSessionActive(prisma, loggedIn.sessionId!)).toBe(false);

    const reAuth = await authenticateUserByPassword(prisma, {
      email,
      password: 'FinalResetPass#2026!',
    });
    expect(reAuth.subject).toBe(loggedIn.subject);
  });

  it('provisions staff physician and department in tenant', async () => {
    const staffEmail = `doctor-${randomUUID().slice(0, 8)}@example.test`;
    createdEmails.push(staffEmail);

    const staffPrincipal = {
      subject: 'synthetic-subject-4',
      issuer: 'https://keycloak.synthetic',
      audience: 'medicloud-api',
      roles: ['PHYSICIAN', 'RECEPTIONIST'] as const,
      tenantIds: ['00000000-0000-4000-8000-000000000001'],
      active: true,
    };

    const dept = await createDepartmentForTenant(prisma, staffPrincipal, {
      departmentName: `Khoa Thử Nghiệm ${randomUUID().slice(0, 4)}`,
    });
    expect(dept.department.id).toBeTruthy();

    const doctor = await provisionStaffAccount(prisma, staffPrincipal, {
      fullName: 'BS. Lê Văn Cường',
      email: staffEmail,
      password: 'DoctorPassword#2026!',
      role: 'PHYSICIAN',
      departmentId: dept.department.id,
      specialty: 'Nội tổng quát',
      roomLabel: 'Phòng 305',
    });
    expect(doctor.role).toBe('PHYSICIAN');
    expect(doctor.practitionerId).toBeTruthy();
  });
});
