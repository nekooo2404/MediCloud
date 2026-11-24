import {NextResponse} from 'next/server';

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length <= 16_384) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const directive =
        typeof parsed['violated-directive'] === 'string'
          ? parsed['violated-directive'].slice(0, 80)
          : 'unknown';
      console.warn(JSON.stringify({event: 'csp.violation_report', directive}));
    }
  } catch {
    // Ignore malformed report payloads
  }
  return new NextResponse(null, {status: 204});
}
