import {NextResponse} from 'next/server';
import {callClinicalApi} from '../../../_lib/clinical-api-client';
import {buildCorrelationId, readSessionFromRequest} from '../../../_lib/session';

export const dynamic = 'force-dynamic';

function isStaffPortal(request: Request): boolean {
  const envRole = process.env.NEXT_PUBLIC_PORTAL_ROLE;
  if (envRole === 'staff') return true;
  if (envRole === 'patient') return false;
  return (request.headers.get('host') ?? '').includes(':3001');
}

export async function GET(request: Request) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  const session = readSessionFromRequest(request);
  if (!session || !isStaffPortal(request)) {
    return NextResponse.json(
      {error: {code: 'forbidden', message: 'Yêu cầu quyền nhân viên y tế.', correlation_id: correlationId}},
      {status: session ? 403 : 401, headers: {'x-correlation-id': correlationId}},
    );
  }
  const result = await callClinicalApi('/v1/admin', {
    method: 'GET',
    role: 'staff',
    session,
    correlationId,
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: {'x-correlation-id': correlationId, 'cache-control': 'no-store'},
  });
}

export async function POST(request: Request) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  const session = readSessionFromRequest(request);
  if (!session || !isStaffPortal(request)) {
    return NextResponse.json(
      {error: {code: 'forbidden', message: 'Yêu cầu quyền nhân viên y tế.', correlation_id: correlationId}},
      {status: session ? 403 : 401, headers: {'x-correlation-id': correlationId}},
    );
  }
  const body = await request.text();
  const result = await callClinicalApi('/v1/admin', {
    method: 'POST',
    body,
    role: 'staff',
    session,
    correlationId,
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: {'x-correlation-id': correlationId, 'cache-control': 'no-store'},
  });
}
