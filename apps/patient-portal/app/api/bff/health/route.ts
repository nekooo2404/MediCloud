import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendBase = process.env.CLINICAL_API_BASE_URL || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(new URL('/v1/health', backendBase), {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    const upstream = await res.json();
    return NextResponse.json(
      {
        status: res.ok ? 'ok' : 'degraded',
        portalRole: process.env.NEXT_PUBLIC_PORTAL_ROLE || 'patient',
        upstream,
        timestamp: new Date().toISOString(),
      },
      { status: res.ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        portalRole: process.env.NEXT_PUBLIC_PORTAL_ROLE || 'patient',
        upstream: { status: 'unreachable' },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
