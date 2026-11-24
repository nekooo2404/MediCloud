import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from '@/app/_lib/session'
import { HealthDashboard, type NavKey } from '@/components/health-dashboard'

export const dynamic = 'force-dynamic'

const PATIENT_TABS: ReadonlySet<NavKey> = new Set([
  'overview',
  'appointments',
  'records',
  'vitals',
  'activity',
  'profile',
])

const STAFF_TABS: ReadonlySet<NavKey> = new Set([
  'overview',
  'appointments',
  'queue',
  'records',
  'vitals',
  'activity',
  'profile',
  'admin',
])

function resolveInitialTab(
  rawTab: string | string[] | undefined,
  portalRole: 'patient' | 'staff',
): NavKey {
  const candidate = Array.isArray(rawTab) ? rawTab[0] : rawTab
  const allowed = portalRole === 'staff' ? STAFF_TABS : PATIENT_TABS
  if (candidate && allowed.has(candidate as NavKey)) {
    return candidate as NavKey
  }
  return 'overview'
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const [cookieStore, headerList, resolvedParams] = await Promise.all([
    cookies(),
    headers(),
    searchParams,
  ])
  const session = verifySessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value)
  if (!session) {
    redirect('/login')
  }
  const host = headerList.get('host') ?? ''
  const envRole = process.env.NEXT_PUBLIC_PORTAL_ROLE
  const portalRole: 'patient' | 'staff' =
    envRole === 'staff' || host.includes(':3001') ? 'staff' : 'patient'
  const initialTab = resolveInitialTab(resolvedParams?.tab, portalRole)

  return <HealthDashboard portalRole={portalRole} initialTab={initialTab} />
}
