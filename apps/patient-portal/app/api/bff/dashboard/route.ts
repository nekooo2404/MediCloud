import {NextResponse} from 'next/server';
import {callClinicalApi} from '../../../_lib/clinical-api-client';
import {buildCorrelationId, readSessionFromRequest} from '../../../_lib/session';

export const dynamic = 'force-dynamic';

function resolvePortalRole(request: Request): 'patient' | 'staff' {
  const envRole = process.env.NEXT_PUBLIC_PORTAL_ROLE;
  if (envRole === 'staff') return 'staff';
  if (envRole === 'patient') return 'patient';
  const host = request.headers.get('host') ?? '';
  return host.includes(':3001') ? 'staff' : 'patient';
}

export async function GET(request: Request) {
  const role = resolvePortalRole(request);
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  const session = readSessionFromRequest(request);
  const reqUrl = new URL(request.url);
  const tenantCode =
    request.headers.get('x-tenant-id') ?? reqUrl.searchParams.get('tenantCode') ?? undefined;

  const targetPath = tenantCode
    ? `/v1/dashboard?tenantCode=${encodeURIComponent(tenantCode)}`
    : '/v1/dashboard';

  const result = await callClinicalApi(targetPath, {
    method: 'GET',
    role,
    session,
    tenantCode,
    correlationId,
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      'x-correlation-id': correlationId,
      'cache-control': 'no-store, max-age=0',
    },
  });
}

export async function POST(request: Request) {
  const role = resolvePortalRole(request);
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  const session = readSessionFromRequest(request);
  const tenantCode = request.headers.get('x-tenant-id') ?? undefined;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_json',
          message: 'Dữ liệu gửi lên không phải JSON hợp lệ.',
          correlation_id: correlationId,
        },
      },
      {status: 400, headers: {'x-correlation-id': correlationId}},
    );
  }

  const effectiveTenant =
    tenantCode ??
    (body && typeof body === 'object' && typeof (body as {tenantCode?: unknown}).tenantCode === 'string'
      ? ((body as {tenantCode: string}).tenantCode)
      : undefined);

  const result = await callClinicalApi('/v1/dashboard', {
    method: 'POST',
    body: JSON.stringify(body),
    role,
    session,
    tenantCode: effectiveTenant,
    correlationId,
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      'x-correlation-id': correlationId,
      'cache-control': 'no-store, max-age=0',
    },
  });
}
