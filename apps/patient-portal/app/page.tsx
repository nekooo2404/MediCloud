import { headers } from 'next/headers'
import { HealthDashboard, type NavKey } from '@/components/health-dashboard'

export const dynamic = 'force-dynamic'

const PATIENT_TABS: ReadonlySet<NavKey> = new Set([
  'overview',
  'appointments',
  'records',
  'vitals',
  'activity',
])

const STAFF_TABS: ReadonlySet<NavKey> = new Set([
  'overview',
  'appointments',
  'queue',
  'records',
  'vitals',
  'activity',
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
  const [headerList, resolvedParams] = await Promise.all([headers(), searchParams])
  const host = headerList.get('host') ?? ''
  const envRole = process.env.NEXT_PUBLIC_PORTAL_ROLE
  const portalRole: 'patient' | 'staff' =
    envRole === 'staff' || host.includes(':3001') ? 'staff' : 'patient'
  const initialTab = resolveInitialTab(resolvedParams?.tab, portalRole)

  return <HealthDashboard portalRole={portalRole} initialTab={initialTab} />
}
