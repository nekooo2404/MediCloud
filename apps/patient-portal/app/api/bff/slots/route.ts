import { NextResponse } from 'next/server';
import { listSlotsForPortal, parseSimulationMode } from '../../../_lib/bff-store';
import { logBffEvent } from '../../../_lib/redacted-log';
import { buildCorrelationId, readSessionFromRequest } from '../../../_lib/session';

export async function GET(request: Request) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  const session = readSessionFromRequest(request);
  const mode = process.env.CLINICAL_API_BASE_URL ? 'upstream' : 'synthetic';
  if (!session) {
    logBffEvent({ action: 'GET /api/bff/slots', status: 401, correlationId, mode, reason: 'unauthorized' });
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Vui lòng đăng nhập phiên mẫu trước khi xem khung giờ.', correlation_id: correlationId } },
      { status: 401, headers: { 'x-correlation-id': correlationId } },
    );
  }

  const url = new URL(request.url);
  const doctorId = url.searchParams.get('doctor_id');
  const sim = parseSimulationMode(request.headers.get('x-medicloud-sim'));
  const result = await listSlotsForPortal(session, doctorId, correlationId, sim);
  logBffEvent({ action: 'GET /api/bff/slots', status: result.status, correlationId, mode: result.mode, reason: result.reason });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { 'x-correlation-id': correlationId, ...(result.headers ?? {}) },
  });
}
