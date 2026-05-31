import { requireAdmin } from '@/lib/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import DashboardShell from '@/app/dashboard/DashboardShell'
import type { Profile } from '@/components/maya/MayChatPanel'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await requireAdmin()
  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select(`
      id, company_name, full_name, business_type, plan, role,
      website_url, instagram_handle, ideal_customer,
      sell_locations, marketing_budget, competitors,
      top_goals, marketing_challenge, content_comfort,
      foundation_complete, foundation_score
    `)
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  const p = profileRows?.[0] ?? null

  let notifications: { id: string; title: string; body: string; type: string; link: string | null; read: boolean; created_at: string }[] = []
  let initialSessions: { id: string; title: string | null; canvas_context: string | null; updated_at: string }[] = []

  if (p?.id) {
    const [{ data: notifs }, { data: sessionRows }] = await Promise.all([
      supabase.from('notifications').select('*').eq('user_id', p.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('maya_sessions').select('id, title, canvas_context, updated_at').eq('user_id', p.id).order('updated_at', { ascending: false }).limit(20),
      logActivity(p.id, 'page_view'),
    ])
    notifications   = notifs ?? []
    initialSessions = (sessionRows ?? []) as typeof initialSessions
  }

  return (
    <DashboardShell
      profile={p as Profile | null}
      profileId={p?.id ?? ''}
      initialNotifications={notifications}
      initialSessions={initialSessions}
      foundationScore={(p as any)?.foundation_score ?? null}
      role={(p as any)?.role ?? null}
      isAdmin={true}
    >
      {children}
    </DashboardShell>
  )
}
