import { NextResponse } from 'next/server';
import { logBffEvent } from '../../../_lib/redacted-log';
import {
  buildClearSessionCookieHeader,
  buildCorrelationId,
  buildSetSessionCookieHeader,
  createSessionCookieValue,
  getSyntheticPersona,
  readSessionFromRequest,
  SYNTHETIC_PERSONAS,
} from '../../../_lib/session';

export async function GET(request: Request) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  const session = readSessionFromRequest(request);
  logBffEvent({
    action: 'GET /api/bff/session',
    status: 200,
    correlationId,
    mode: process.env.CLINICAL_API_BASE_URL ? 'upstream' : 'synthetic',
    reason: session ? 'authenticated' : 'anonymous',
  });
  return NextResponse.json(
    {
      authenticated: Boolean(session),
      session,
      personas: SYNTHETIC_PERSONAS.map(({ id, displayName, tenantName, role, summary }) => ({
        id,
        displayName,
        tenantName,
        role,
        summary,
      })),
      upstream_configured: Boolean(process.env.CLINICAL_API_BASE_URL),
      correlation_id: correlationId,
    },
    { status: 200, headers: { 'x-correlation-id': correlationId } },
  );
}

export async function POST(request: Request) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  const mode = process.env.CLINICAL_API_BASE_URL ? 'upstream' : 'synthetic';
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Dữ liệu đăng nhập không phải JSON hợp lệ.', correlation_id: correlationId } },
      { status: 400, headers: { 'x-correlation-id': correlationId } },
    );
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Dữ liệu đăng nhập không hợp lệ.', correlation_id: correlationId } },
      { status: 400, headers: { 'x-correlation-id': correlationId } },
    );
  }
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => key !== 'persona_id')) {
    return NextResponse.json(
      { error: { code: 'unknown_field', message: 'Yêu cầu đăng nhập chứa trường không được phép.', correlation_id: correlationId } },
      { status: 400, headers: { 'x-correlation-id': correlationId } },
    );
  }
  const personaId = typeof record.persona_id === 'string' ? record.persona_id : '';
  const persona = getSyntheticPersona(personaId);
  if (!persona) {
    return NextResponse.json(
      { error: { code: 'unknown_persona', message: 'Tài khoản mẫu không tồn tại.', correlation_id: correlationId } },
      { status: 400, headers: { 'x-correlation-id': correlationId } },
    );
  }

  const cookieValue = createSessionCookieValue(persona.id);
  const session = {
    personaId: persona.id,
    subject: persona.subject,
    tenantId: persona.tenantId,
    tenantCode: persona.tenantCode,
    tenantName: persona.tenantName,
    role: persona.role,
    patientId: persona.patientId,
    patientRef: persona.patientRef,
    displayName: persona.displayName,
  };

  logBffEvent({
    action: 'POST /api/bff/session',
    status: 200,
    correlationId,
    mode,
    reason: 'session_created',
  });

  return NextResponse.json(
    { authenticated: true, session, correlation_id: correlationId },
    {
      status: 200,
      headers: {
        'set-cookie': buildSetSessionCookieHeader(cookieValue, request),
        'x-correlation-id': correlationId,
      },
    },
  );
}

export async function DELETE(request: Request) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id'));
  logBffEvent({
    action: 'DELETE /api/bff/session',
    status: 200,
    correlationId,
    mode: process.env.CLINICAL_API_BASE_URL ? 'upstream' : 'synthetic',
    reason: 'session_cleared',
  });
  return NextResponse.json(
    { authenticated: false, session: null, correlation_id: correlationId },
    {
      status: 200,
      headers: {
        'set-cookie': buildClearSessionCookieHeader(),
        'x-correlation-id': correlationId,
      },
    },
  );
}
