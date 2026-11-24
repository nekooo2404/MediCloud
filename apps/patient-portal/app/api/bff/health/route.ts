import {NextResponse} from 'next/server';
import {
  assertClinicalApiConfigured,
  getUpstreamCircuitMetrics,
} from '../../../_lib/clinical-api-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const portalRole = process.env.NEXT_PUBLIC_PORTAL_ROLE === 'staff' ? 'staff' : 'patient';
  const circuitBreaker = getUpstreamCircuitMetrics();

  try {
    const {baseUrl} = assertClinicalApiConfigured(portalRole);
    const res = await fetch(new URL('/v1/health', baseUrl), {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    const upstream = await res.json();
    return NextResponse.json(
      {
        status: res.ok ? 'ok' : 'degraded',
        portalRole,
        circuitBreaker,
        upstream,
        timestamp: new Date().toISOString(),
      },
      {status: res.ok ? 200 : 503},
    );
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        portalRole,
        circuitBreaker,
        upstream: {status: 'unreachable'},
        timestamp: new Date().toISOString(),
      },
      {status: 503},
    );
  }
}
