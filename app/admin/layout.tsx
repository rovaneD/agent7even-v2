import { requireAdmin } from '@/lib/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'
import DashboardShell from '@/app/dashboard/DashboardShell'
import type { Profile } from '@/components/maya/MayChatPanel'
import { currentUser } from '@clerk/nextjs/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await requireAdmin()
  const supabase = createServiceClient()
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const p = await getDashboardProfileForClerkUser(supabase, userId, email)

  let notifications: { id: string; title: string; body: string; type: string; link: string | null; read: boolean; created_at: string }[] = []
  let initialSessions: { id: string; title: string | null; canvas_context: string | null; updated_at: string }[] = []
  let activeOrdersCount = 0

  if (p?.id) {
    const [{ data: notifs }, { data: sessionRows }, { count: orderCount }] = await Promise.all([
      supabase.from('notifications').select('*').eq('user_id', p.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('maya_sessions').select('id, title, canvas_context, updated_at').eq('user_id', p.id).order('updated_at', { ascending: false }).limit(20),
      supabase.from('orders').select('id', { count: 'exact', head: true }).not('status', 'in', '(approved,cancelled,completed)').neq('service_type', 'viral_hooks'),
      logActivity(p.id, 'page_view'),
    ])
    notifications   = notifs ?? []
    initialSessions = (sessionRows ?? []) as typeof initialSessions
    activeOrdersCount = orderCount ?? 0
  }

  return (
    <DashboardShell
      profile={p as Profile | null}
      profileId={p?.id ?? ''}
      initialNotifications={notifications}
      initialSessions={initialSessions}
      foundationScore={(p as any)?.foundation_score ?? null}
      activeOrdersCount={activeOrdersCount}
      role={(p as any)?.role ?? null}
      isAdmin={true}
    >
      {children}
    </DashboardShell>
  )
}
