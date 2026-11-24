import {NextResponse} from 'next/server';
import {listSlotsForPortal, parseSimulationMode} from '../../../_lib/bff-store';
import {logBffEvent} from '../../../_lib/redacted-log';
import {buildCorrelationId, getSyntheticPersona, readSessionFromRequest} from '../../../_lib/session';
import type {ActiveSession} from '../../../_lib/types';

export async function GET(request: Request) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  const existingSession = readSessionFromRequest(request);
  const mode = process.env.CLINICAL_API_BASE_URL ? 'upstream' : 'synthetic';
  const tenantHeader = request.headers.get('x-tenant-id') ?? undefined;

  let activeSession: ActiveSession;
  if (!existingSession) {
    // Allow un-cookied dev preview ONLY in non-test, non-production environments (matching /api/bff/workspace/*).
    if (process.env.NODE_ENV === 'test' || process.env.MEDICLOUD_ENV === 'production') {
      logBffEvent({action: 'GET /api/bff/slots', status: 401, correlationId, mode, reason: 'unauthorized'});
      return NextResponse.json(
        {
          error: {
            code: 'unauthorized',
            message: 'Vui lòng đăng nhập phiên mẫu trước khi xem khung giờ.',
            correlation_id: correlationId,
          },
        },
        {status: 401, headers: {'x-correlation-id': correlationId}},
      );
    }
    const host = request.headers.get('host') ?? '';
    const isStaff = process.env.NEXT_PUBLIC_PORTAL_ROLE === 'staff' || host.includes(':3001');
    if (isStaff) {
      activeSession = {
        personaId: 'receptionist-hospital-a',
        subject: 'synthetic-subject-4',
        tenantId: tenantHeader ?? '00000000-0000-4000-8000-000000000001',
        tenantCode: tenantHeader ?? 'synthetic-hospital-a',
        tenantName: 'MediCloud Clinic A (Hà Nội)',
        role: 'RECEPTIONIST',
        displayName: 'Nhân viên y tế',
      };
    } else {
      const p = getSyntheticPersona('patient-hospital-a')!;
      activeSession = {
        personaId: p.id,
        subject: p.subject,
        tenantId: tenantHeader ?? p.tenantId,
        tenantCode: tenantHeader ?? p.tenantCode,
        tenantName: p.tenantName,
        role: p.role,
        patientId: p.patientId,
        patientRef: p.patientRef,
        displayName: p.displayName,
      };
    }
  } else {
    activeSession = tenantHeader
      ? {...existingSession, tenantId: tenantHeader, tenantCode: tenantHeader}
      : existingSession;
  }

  const url = new URL(request.url);
  const doctorId = url.searchParams.get('doctor_id');
  const sim = parseSimulationMode(request.headers.get('x-medicloud-sim'));
  const result = await listSlotsForPortal(activeSession, doctorId, correlationId, sim);
  logBffEvent({action: 'GET /api/bff/slots', status: result.status, correlationId, mode: result.mode, reason: result.reason});
  return NextResponse.json(result.body, {
    status: result.status,
    headers: {'x-correlation-id': correlationId, ...(result.headers ?? {})},
  });
}
