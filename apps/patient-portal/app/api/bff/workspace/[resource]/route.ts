import {NextResponse} from 'next/server';
import {callClinicalApi} from '../../../../_lib/clinical-api-client';
import {buildCorrelationId, readSessionFromRequest} from '../../../../_lib/session';

export const dynamic = 'force-dynamic';

const ALLOWED_RESOURCES = new Set(['overview', 'appointments', 'queue', 'records', 'vitals', 'audit']);

function resolvePortalRole(request: Request): 'patient' | 'staff' {
  const envRole = process.env.NEXT_PUBLIC_PORTAL_ROLE;
  if (envRole === 'staff') return 'staff';
  if (envRole === 'patient') return 'patient';
  const host = request.headers.get('host') ?? '';
  return host.includes(':3001') ? 'staff' : 'patient';
}

export async function GET(
  request: Request,
  context: {params: Promise<{resource: string}>},
) {
  const {resource} = await context.params;
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  if (!ALLOWED_RESOURCES.has(resource)) {
    return NextResponse.json(
      {
        error: {
          code: 'workspace_resource_not_found',
          message: 'Phân hệ dữ liệu không tồn tại.',
          correlation_id: correlationId,
        },
      },
      {status: 404, headers: {'x-correlation-id': correlationId}},
    );
  }

  const role = resolvePortalRole(request);
  const session = readSessionFromRequest(request);
  const incomingUrl = new URL(request.url);
  const tenantCode =
    request.headers.get('x-tenant-id') ?? incomingUrl.searchParams.get('tenantCode') ?? undefined;

  const qs = new URLSearchParams();
  for (const key of ['cursor', 'limit', 'status', 'q', 'from', 'to', 'sort', 'dir', 'patientId']) {
    const val = incomingUrl.searchParams.get(key);
    if (val !== null && val !== '') {
      qs.set(key, val);
    }
  }
  const querySuffix = qs.toString() ? `?${qs.toString()}` : '';
  const result = await callClinicalApi(`/v1/workspace/${encodeURIComponent(resource)}${querySuffix}`, {
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
