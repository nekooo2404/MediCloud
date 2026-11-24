import { NextResponse } from 'next/server';
import { callClinicalApi } from '../../../_lib/clinical-api-client';
import { logBffEvent } from '../../../_lib/redacted-log';
import {
  buildClearSessionCookieHeader,
  buildCorrelationId,
  buildSetSessionCookieHeader,
  createAccountSessionCookieValue,
  createSessionCookieValue,
  getSyntheticPersona,
  readSessionFromRequest,
  SYNTHETIC_PERSONAS,
} from '../../../_lib/session';
import type { ActiveSession } from '../../../_lib/types';

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
      ...(process.env.NODE_ENV === 'test'
        ? {
            personas: SYNTHETIC_PERSONAS.map(({ id, displayName, tenantName, role, summary }) => ({
              id,
              displayName,
              tenantName,
              role,
              summary,
            })),
          }
        : {}),
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

  if (record.action === 'login' || record.action === 'signup') {
    const endpoint = record.action === 'signup' ? '/v1/auth/signup' : '/v1/auth/login';
    const upstream = await callClinicalApi<{ session: ActiveSession; correlation_id: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        fullName: typeof record.fullName === 'string' ? record.fullName : '',
        email: typeof record.email === 'string' ? record.email : '',
        password: typeof record.password === 'string' ? record.password : '',
        tenantCode: typeof record.tenantCode === 'string' ? record.tenantCode : undefined,
      }),
      correlationId,
    });

    if (upstream.status !== 200 || !('session' in upstream.body)) {
      logBffEvent({
        action: `POST /api/bff/session (${record.action})`,
        status: upstream.status,
        correlationId,
        mode: 'upstream',
        reason: upstream.reason,
      });
      return NextResponse.json(upstream.body, {
        status: upstream.status,
        headers: { 'x-correlation-id': correlationId },
      });
    }

    const session = upstream.body.session;
    const cookieValue = createAccountSessionCookieValue(session);

    logBffEvent({
      action: `POST /api/bff/session (${record.action})`,
      status: 200,
      correlationId,
      mode: 'upstream',
      reason: 'session_created',
    });

    return NextResponse.json(
      {
        authenticated: true,
        session,
        ...('emailVerificationToken' in upstream.body && upstream.body.emailVerificationToken
          ? { emailVerificationToken: upstream.body.emailVerificationToken }
          : {}),
        correlation_id: correlationId,
      },
      {
        status: 200,
        headers: {
          'set-cookie': buildSetSessionCookieHeader(cookieValue, request),
          'x-correlation-id': correlationId,
        },
      },
    );
  }

  if (
    record.action === 'forgot_password' ||
    record.action === 'reset_password' ||
    record.action === 'verify_email' ||
    record.action === 'change_password'
  ) {
    const endpointMap: Record<string, string> = {
      forgot_password: '/v1/auth/forgot-password',
      reset_password: '/v1/auth/reset-password',
      verify_email: '/v1/auth/verify-email',
      change_password: '/v1/auth/change-password',
    };
    const activeSession = record.action === 'change_password' ? readSessionFromRequest(request) : null;
    if (record.action === 'change_password' && !activeSession) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Vui lòng đăng nhập.', correlation_id: correlationId } },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    const upstream = await callClinicalApi(endpointMap[record.action]!, {
      method: 'POST',
      body: JSON.stringify({
        email: typeof record.email === 'string' ? record.email : '',
        token: typeof record.token === 'string' ? record.token : '',
        currentPassword: typeof record.currentPassword === 'string' ? record.currentPassword : '',
        newPassword: typeof record.newPassword === 'string' ? record.newPassword : '',
        currentSessionId: activeSession?.sessionId,
      }),
      session: activeSession,
      correlationId,
    });
    return NextResponse.json(upstream.body, {
      status: upstream.status,
      headers: { 'x-correlation-id': correlationId },
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    return NextResponse.json(
      { error: { code: 'auth_action_required', message: 'Vui lòng đăng nhập bằng email và mật khẩu.', correlation_id: correlationId } },
      { status: 400, headers: { 'x-correlation-id': correlationId } },
    );
  }

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
      { error: { code: 'unknown_persona', message: 'Tài khoản không tồn tại.', correlation_id: correlationId } },
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
  const session = readSessionFromRequest(request);
  if (session?.sessionId && process.env.CLINICAL_API_BASE_URL) {
    await callClinicalApi('/v1/auth/session/revoke', {
      method: 'POST',
      body: JSON.stringify({ sessionId: session.sessionId }),
      session,
      correlationId,
    }).catch(() => undefined);
  }
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
