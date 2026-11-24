import {createHmac, randomUUID, timingSafeEqual} from 'node:crypto';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {PrismaClient} from '@prisma/client';
import {
  DashboardAccessError,
  executeDashboardMutation,
  getDashboardData,
} from './clinical/dashboard-service.js';
import {createClinicalApiHandler} from './scheduling/http-adapter.js';
import {AuthenticationError, createOidcVerifier} from './security/oidc-verifier.js';
import {redactedMutationLog} from './security/redacted-log.js';
import type {AuthenticatedPrincipal, Role} from './security/types.js';

const IS_PRODUCTION = process.env.MEDICLOUD_ENV === 'production';

if (IS_PRODUCTION) {
  for (const key of ['OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URL', 'BFF_ACTOR_SIGNING_SECRET']) {
    if (!process.env[key] || process.env[key]!.trim().length < 8) {
      throw new Error(`Fail-closed production config error: missing required env ${key}`);
    }
  }
}

const ACTOR_SIGNING_SECRET =
  process.env.BFF_ACTOR_SIGNING_SECRET ?? 'synthetic-dev-actor-signing-secret-do-not-use-in-prod';

const prisma = new PrismaClient();

const oidcVerifier =
  process.env.OIDC_ISSUER && process.env.OIDC_AUDIENCE && process.env.OIDC_JWKS_URL
    ? createOidcVerifier({
        issuer: process.env.OIDC_ISSUER,
        audience: process.env.OIDC_AUDIENCE,
        jwksUrl: process.env.OIDC_JWKS_URL,
        isActiveSubject: async (subject) => {
          const user = await prisma.user.findUnique({where: {subject}, select: {status: true}});
          return user?.status === 'ACTIVE';
        },
      })
    : null;

const ALLOWED_ORIGINS = new Set([
  'https://localhost:3000',
  'https://localhost:3001',
  'https://127.0.0.1:3000',
  'https://127.0.0.1:3001',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  ...(process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

const PRINCIPAL_DIRECTORY: Record<string, {role: 'patient' | 'staff'; principal: AuthenticatedPrincipal}> = {
  'synthetic-bff-patient': {
    role: 'patient',
    principal: {
      subject: 'synthetic-subject-1',
      issuer: 'https://keycloak.synthetic',
      audience: 'medicloud-api',
      roles: ['PATIENT'],
      tenantIds: ['00000000-0000-4000-8000-000000000001'],
      active: true,
    },
  },
  'synthetic-bff-staff': {
    role: 'staff',
    principal: {
      subject: 'synthetic-subject-4',
      issuer: 'https://keycloak.synthetic',
      audience: 'medicloud-api',
      roles: ['PHYSICIAN', 'RECEPTIONIST'],
      tenantIds: ['00000000-0000-4000-8000-000000000001'],
      active: true,
    },
  },
};

function verifySignedActorHeader(req?: IncomingMessage): {
  subject: string;
  portalRole: 'patient' | 'staff';
  tenantCode?: string;
} | null {
  if (!req) return null;
  const rawActor = Array.isArray(req.headers['x-medicloud-actor'])
    ? req.headers['x-medicloud-actor'][0]
    : req.headers['x-medicloud-actor'];
  const rawSig = Array.isArray(req.headers['x-medicloud-actor-sig'])
    ? req.headers['x-medicloud-actor-sig'][0]
    : req.headers['x-medicloud-actor-sig'];
  if (!rawActor && !rawSig) return null;
  if (!rawActor || !rawSig) {
    throw new AuthenticationError('Incomplete actor assertion signature');
  }
  const expectedSig = createHmac('sha256', ACTOR_SIGNING_SECRET).update(rawActor).digest('hex');
  const providedBuf = Buffer.from(rawSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    throw new AuthenticationError('Invalid actor assertion signature');
  }
  try {
    const parsed = JSON.parse(Buffer.from(rawActor, 'base64url').toString('utf8')) as {
      subject?: unknown;
      portalRole?: unknown;
      tenantCode?: unknown;
      issuedAt?: unknown;
    };
    if (
      typeof parsed.subject !== 'string' ||
      parsed.subject.length === 0 ||
      (parsed.portalRole !== 'patient' && parsed.portalRole !== 'staff') ||
      typeof parsed.issuedAt !== 'number' ||
      Math.abs(Date.now() - parsed.issuedAt) > 5 * 60 * 1000
    ) {
      throw new AuthenticationError('Expired or malformed actor assertion');
    }
    return {
      subject: parsed.subject,
      portalRole: parsed.portalRole,
      tenantCode: typeof parsed.tenantCode === 'string' && parsed.tenantCode.length > 0 ? parsed.tenantCode : undefined,
    };
  } catch (err) {
    if (err instanceof AuthenticationError) throw err;
    throw new AuthenticationError('Unparseable actor assertion');
  }
}

async function authenticateRequest(
  authHeader: string | undefined,
  req?: IncomingMessage,
): Promise<{
  role: 'patient' | 'staff';
  tenantCode?: string;
  principal: AuthenticatedPrincipal;
}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid Authorization Bearer header');
  }
  const signedActor = verifySignedActorHeader(req);
  const headerTenant = req
    ? Array.isArray(req.headers['x-tenant-id'])
      ? req.headers['x-tenant-id'][0]
      : req.headers['x-tenant-id']
    : undefined;

  if (IS_PRODUCTION) {
    if (!oidcVerifier) throw new AuthenticationError('OIDC verifier is not configured');
    const principal = await oidcVerifier(authHeader);
    const portalRole = signedActor?.portalRole ?? (principal.roles.some((r) => ['RECEPTIONIST', 'PHYSICIAN', 'NURSE', 'AUDITOR'].includes(r)) ? 'staff' : 'patient');
    return {
      role: portalRole,
      tenantCode: signedActor?.tenantCode ?? headerTenant,
      principal: signedActor ? {...principal, subject: signedActor.subject} : principal,
    };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const entry = PRINCIPAL_DIRECTORY[token];
  if (entry) {
    const portalRole = signedActor?.portalRole ?? entry.role;
    const effectiveRoles: readonly Role[] =
      portalRole === 'staff' ? ['PHYSICIAN', 'RECEPTIONIST', 'NURSE', 'AUDITOR'] : ['PATIENT', 'GUARDIAN'];
    return {
      role: portalRole,
      tenantCode: signedActor?.tenantCode ?? headerTenant,
      principal: {
        ...entry.principal,
        subject: signedActor?.subject ?? entry.principal.subject,
        roles: effectiveRoles,
      },
    };
  }

  if (oidcVerifier) {
    const principal = await oidcVerifier(authHeader);
    const portalRole = signedActor?.portalRole ?? 'patient';
    return {
      role: portalRole,
      tenantCode: signedActor?.tenantCode ?? headerTenant,
      principal: signedActor ? {...principal, subject: signedActor.subject} : principal,
    };
  }

  throw new AuthenticationError('Unrecognized or expired service token');
}

const clinicalHandler = createClinicalApiHandler({
  prisma,
  verifyAuthorizationHeader: async (header, req) => (await authenticateRequest(header, req)).principal,
});

const rateBuckets = new Map<string, {count: number; windowStart: number}>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const current = rateBuckets.get(ip);
  if (!current || now - current.windowStart > 60_000) {
    rateBuckets.set(ip, {count: 1, windowStart: now});
    return true;
  }
  current.count += 1;
  return current.count <= 300;
}

async function readBodyJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.from(chunk);
    totalBytes += buf.byteLength;
    if (totalBytes > 65_536) {
      throw new DashboardAccessError(400, 'payload_too_large', 'Kích thước dữ liệu gửi lên vượt giới hạn cho phép.');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function buildSecurityHeaders(req: IncomingMessage, correlationId: string): Record<string, string> {
  const origin = req.headers.origin;
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'cache-control': 'no-store, max-age=0',
    'x-correlation-id': correlationId,
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['vary'] = 'Origin';
    headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    headers['access-control-allow-headers'] = 'content-type, authorization, x-correlation-id, idempotency-key, x-tenant-id';
  }
  return headers;
}

function sendJson(req: IncomingMessage, res: ServerResponse, status: number, payload: unknown, correlationId: string): void {
  res.writeHead(status, buildSecurityHeaders(req, correlationId));
  res.end(JSON.stringify(payload));
}

export async function createClinicalApiRequestHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const incomingCorr = Array.isArray(req.headers['x-correlation-id'])
    ? req.headers['x-correlation-id'][0]
    : req.headers['x-correlation-id'];
  const correlationId =
    incomingCorr && /^(?:synthetic-[a-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(incomingCorr)
      ? incomingCorr
      : `synthetic-api-${randomUUID().slice(0, 12)}`;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, buildSecurityHeaders(req, correlationId));
    res.end();
    return;
  }

  const clientIp = req.socket.remoteAddress ?? '127.0.0.1';
  if (!checkRateLimit(clientIp)) {
    sendJson(
      req,
      res,
      429,
      {
        error: {
          code: 'rate_limit_exceeded',
          message: 'Quá nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau ít giây.',
          correlation_id: correlationId,
        },
      },
      correlationId,
    );
    return;
  }

  const url = new URL(req.url ?? '/', 'http://127.0.0.1:4000');

  if (req.method === 'GET' && url.pathname === '/v1/health') {
    try {
      const tenantCount = await prisma.tenant.count();
      sendJson(
        req,
        res,
        200,
        {
          status: 'ok',
          service: 'clinical-api',
          mode: IS_PRODUCTION ? 'production' : 'development',
          database: 'connected',
          tenants: tenantCount,
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        },
        correlationId,
      );
    } catch {
      sendJson(
        req,
        res,
        503,
        {
          status: 'error',
          service: 'clinical-api',
          database: 'disconnected',
          correlation_id: correlationId,
        },
        correlationId,
      );
    }
    return;
  }

  if (url.pathname === '/v1/dashboard') {
    try {
      const authHeader = Array.isArray(req.headers.authorization)
        ? req.headers.authorization[0]
        : req.headers.authorization;
      const auth = await authenticateRequest(authHeader, req);
      const queryTenant = url.searchParams.get('tenantCode') ?? auth.tenantCode;

      if (req.method === 'GET') {
        const data = await getDashboardData(prisma, {
          role: auth.role,
          actorSubject: auth.principal.subject,
          tenantCode: queryTenant ?? undefined,
        });
        sendJson(req, res, 200, {...data, correlation_id: correlationId}, correlationId);
        return;
      }

      if (req.method === 'POST') {
        const body = await readBodyJson(req);
        const result = await executeDashboardMutation(
          prisma,
          {
            role: auth.role,
            actorSubject: auth.principal.subject,
            tenantCode: queryTenant ?? undefined,
            correlationId,
          },
          body,
        );
        sendJson(req, res, 200, result, correlationId);
        return;
      }

      sendJson(
        req,
        res,
        405,
        {
          error: {
            code: 'method_not_allowed',
            message: 'Phương thức HTTP không được hỗ trợ.',
            correlation_id: correlationId,
          },
        },
        correlationId,
      );
      return;
    } catch (err) {
      if (err instanceof AuthenticationError) {
        sendJson(
          req,
          res,
          401,
          {
            error: {
              code: 'unauthorized',
              message: 'Phiên xác thực với máy chủ lâm sàng không hợp lệ.',
              correlation_id: correlationId,
            },
          },
          correlationId,
        );
        return;
      }
      if (err instanceof DashboardAccessError) {
        sendJson(
          req,
          res,
          err.status,
          {
            error: {
              code: err.code,
              message: err.message,
              correlation_id: correlationId,
            },
          },
          correlationId,
        );
        return;
      }
      console.warn(JSON.stringify(redactedMutationLog({action: 'dashboard.error', status: 500, correlationId, reason: 'internal_error'})));
      sendJson(
        req,
        res,
        500,
        {
          error: {
            code: 'internal_clinical_error',
            message: 'Hệ thống không thể xử lý yêu cầu lúc này. Vui lòng thử lại.',
            correlation_id: correlationId,
          },
        },
        correlationId,
      );
      return;
    }
  }

  await clinicalHandler(req, res);
}

const server = createServer(createClinicalApiRequestHandler);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';
server.listen(port, host, () => {
  console.log(`[clinical-api] Listening on http://${host}:${port} (mode=${IS_PRODUCTION ? 'production' : 'development'})`);
});

function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
