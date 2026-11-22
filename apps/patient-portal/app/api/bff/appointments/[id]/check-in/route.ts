import { NextResponse } from 'next/server';
import { checkInAppointmentForPortal, parseSimulationMode } from '../../../../../_lib/bff-store';
import { logBffEvent } from '../../../../../_lib/redacted-log';
import { buildCorrelationId, readSessionFromRequest } from '../../../../../_lib/session';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  const session = readSessionFromRequest(request);
  const mode = process.env.CLINICAL_API_BASE_URL ? 'upstream' : 'synthetic';
  if (!session) {
    logBffEvent({ action: 'POST /api/bff/appointments/[id]/check-in', status: 401, correlationId, mode, reason: 'unauthorized' });
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Vui lòng đăng nhập phiên mẫu trước khi tiếp nhận.', correlation_id: correlationId } },
      { status: 401, headers: { 'x-correlation-id': correlationId } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logBffEvent({ action: 'POST /api/bff/appointments/[id]/check-in', status: 400, correlationId, mode, reason: 'invalid_json' });
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Nội dung yêu cầu phải là JSON hợp lệ.', correlation_id: correlationId } },
      { status: 400, headers: { 'x-correlation-id': correlationId } },
    );
  }

  const { id } = await context.params;
  const sim = parseSimulationMode(request.headers.get('x-medicloud-sim'));
  const result = await checkInAppointmentForPortal(session, id, body, correlationId, sim);
  logBffEvent({ action: 'POST /api/bff/appointments/[id]/check-in', status: result.status, correlationId, mode: result.mode, reason: result.reason });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { 'x-correlation-id': correlationId, ...(result.headers ?? {}) },
  });
}
