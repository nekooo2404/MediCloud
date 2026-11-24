import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { PrismaClient } from '@prisma/client';
import {
  DashboardAccessError,
  type DashboardMutationInput,
  executeDashboardMutation,
  getDashboardData,
} from './clinical/dashboard-service.js';
import { createClinicalApiHandler } from './scheduling/http-adapter.js';
import { AuthenticationError } from './security/oidc-verifier.js';
import type { AuthenticatedPrincipal } from './security/types.js';

const prisma = new PrismaClient();

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
]);

const PRINCIPAL_DIRECTORY: Record<string, { role: 'patient' | 'staff'; principal: AuthenticatedPrincipal }> = {
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

function authenticateRequest(authHeader: string | undefined): {
  role: 'patient' | 'staff';
  principal: AuthenticatedPrincipal;
} {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid Authorization Bearer header');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const entry = PRINCIPAL_DIRECTORY[token];
  if (!entry) {
    throw new AuthenticationError('Unrecognized or expired service token');
  }
  return entry;
}

const clinicalHandler = createClinicalApiHandler({
  prisma,
  verifyAuthorizationHeader: async (header) => authenticateRequest(header).principal,
});

// Simple sliding window rate limiter per client IP (180 requests / minute)
const rateBuckets = new Map<string, { count: number; windowStart: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const current = rateBuckets.get(ip);
  if (!current || now - current.windowStart > 60_000) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  current.count += 1;
  return current.count <= 180;
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
    headers['access-control-allow-headers'] = 'content-type, authorization, x-correlation-id, idempotency-key';
  }
  return headers;
}

function sendJson(req: IncomingMessage, res: ServerResponse, status: number, payload: unknown, correlationId: string): void {
  res.writeHead(status, buildSecurityHeaders(req, correlationId));
  res.end(JSON.stringify(payload));
}

const server = createServer(async (req, res) => {
  const incomingCorr = Array.isArray(req.headers['x-correlation-id'])
    ? req.headers['x-correlation-id'][0]
    : req.headers['x-correlation-id'];
  const correlationId =
    incomingCorr && /^synthetic-[a-z0-9-]+$/.test(incomingCorr)
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
      const auth = authenticateRequest(authHeader);

      if (req.method === 'GET') {
        const data = await getDashboardData(prisma, {
          role: auth.role,
          actorSubject: auth.principal.subject,
        });
        sendJson(req, res, 200, { ...data, correlation_id: correlationId }, correlationId);
        return;
      }

      if (req.method === 'POST') {
        const body = (await readBodyJson(req)) as DashboardMutationInput;
        const result = await executeDashboardMutation(
          prisma,
          {
            role: auth.role,
            actorSubject: auth.principal.subject,
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
});

const port = Number(process.env.PORT ?? 4000);
server.listen(port, '127.0.0.1', () => {
  console.log(`[clinical-api] Listening on http://127.0.0.1:${port} (connected to PostgreSQL)`);
});

function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
