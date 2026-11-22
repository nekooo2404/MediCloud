import { cookies } from 'next/headers';
import { PortalApp } from './_components/PortalApp';
import {
  SESSION_COOKIE_NAME,
  SYNTHETIC_PERSONAS,
  verifySessionCookieValue,
} from './_lib/session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const initialSession = verifySessionCookieValue(rawCookie);

  const personas = SYNTHETIC_PERSONAS.map(({ id, displayName, tenantName, role, summary }) => ({
    id,
    displayName,
    tenantName,
    role,
    summary,
  }));

  return (
    <PortalApp
      initialSession={initialSession}
      personas={personas}
      upstreamConfigured={Boolean(process.env.CLINICAL_API_BASE_URL)}
    />
  );
}
