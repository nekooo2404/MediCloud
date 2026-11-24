import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getBackendBaseUrl(): string {
  return process.env.CLINICAL_API_BASE_URL || 'http://127.0.0.1:4000';
}

function resolvePortalRole(request: Request): 'patient' | 'staff' {
  const envRole = process.env.NEXT_PUBLIC_PORTAL_ROLE;
  if (envRole === 'staff') return 'staff';
  if (envRole === 'patient') return 'patient';
  const host = request.headers.get('host') ?? '';
  return host.includes(':3001') ? 'staff' : 'patient';
}

function resolveServiceBearerToken(role: 'patient' | 'staff'): string {
  return role === 'staff' ? 'synthetic-bff-staff' : 'synthetic-bff-patient';
}

function buildCorrelationId(request: Request): string {
  const incoming = request.headers.get('x-correlation-id');
  if (incoming && /^synthetic-[a-z0-9-]+$/.test(incoming)) {
    return incoming;
  }
  return `synthetic-bff-${randomUUID().slice(0, 12)}`;
}

export async function GET(request: Request) {
  const role = resolvePortalRole(request);
  const correlationId = buildCorrelationId(request);
  const backendUrl = new URL('/v1/dashboard', getBackendBaseUrl());
  backendUrl.searchParams.set('role', role);

  try {
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${resolveServiceBearerToken(role)}`,
        'x-correlation-id': correlationId,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    const payload = await response.json();
    return NextResponse.json(payload, {
      status: response.status,
      headers: {
        'x-correlation-id': correlationId,
        'cache-control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'backend_unreachable',
          message: 'Dịch vụ lâm sàng tạm thời gián đoạn. Vui lòng thử lại sau giây lát.',
          correlation_id: correlationId,
        },
      },
      {
        status: 503,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  }
}

export async function POST(request: Request) {
  const role = resolvePortalRole(request);
  const correlationId = buildCorrelationId(request);
  const backendUrl = new URL('/v1/dashboard', getBackendBaseUrl());

  try {
    const body = await request.json();
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${resolveServiceBearerToken(role)}`,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    const payload = await response.json();
    return NextResponse.json(payload, {
      status: response.status,
      headers: {
        'x-correlation-id': correlationId,
        'cache-control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'backend_mutation_failed',
          message: 'Không thể hoàn tất thao tác do gián đoạn kết nối tới máy chủ lâm sàng.',
          correlation_id: correlationId,
        },
      },
      {
        status: 503,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  }
}
