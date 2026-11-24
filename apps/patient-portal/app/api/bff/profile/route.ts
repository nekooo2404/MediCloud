import {NextResponse} from 'next/server';
import {callClinicalApi} from '../../../_lib/clinical-api-client';
import {buildCorrelationId, readSessionFromRequest} from '../../../_lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  const session = readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      {error: {code: 'unauthorized', message: 'Vui lòng đăng nhập.', correlation_id: correlationId}},
      {status: 401, headers: {'x-correlation-id': correlationId}},
    );
  }
  const result = await callClinicalApi('/v1/profile', {
    method: 'GET',
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
  if (!session) {
    return NextResponse.json(
      {error: {code: 'unauthorized', message: 'Vui lòng đăng nhập.', correlation_id: correlationId}},
      {status: 401, headers: {'x-correlation-id': correlationId}},
    );
  }
  const body = await request.text();
  const result = await callClinicalApi('/v1/profile', {
    method: 'POST',
    body,
    session,
    correlationId,
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: {'x-correlation-id': correlationId, 'cache-control': 'no-store'},
  });
}
