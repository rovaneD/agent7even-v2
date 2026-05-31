import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import DashboardShell from './DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  const supabase = createServiceClient()

  let profile = null
  let profileId = ''
  let notifications: {
    id: string
    title: string
    body: string
    type: string
    link: string | null
    read: boolean
    created_at: string
  }[] = []
  let initialSessions: { id: string; title: string | null; canvas_context: string | null; updated_at: string }[] = []
  let brandKitCompleted = 0
  let pendingApprovalsCount = 0

  if (userId) {
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

    if (p?.id) {
      profile = p
      profileId = p.id

      const [{ data: notifs }, { data: sessionRows }, { data: brandKitRows }, { count: approvalsCount }] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', p.id)
          .order('created_at', { ascending: false })
          .limit(20),

        supabase
          .from('maya_sessions')
          .select('id, title, canvas_context, updated_at')
          .eq('user_id', p.id)
          .order('updated_at', { ascending: false })
          .limit(20),

        supabase
          .from('brand_kit_sections')
          .select('completed')
          .eq('user_id', p.id),

        supabase
          .from('agent_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', p.id)
          .eq('requires_approval', true)
          .eq('status', 'complete')
          .is('approved_at', null)
          .is('rejected_at', null),

        logActivity(p.id, 'page_view'),
      ])

      notifications         = notifs ?? []
      initialSessions       = (sessionRows ?? []) as typeof initialSessions
      brandKitCompleted     = (brandKitRows ?? []).filter((r: { completed: boolean }) => r.completed).length
      pendingApprovalsCount = approvalsCount ?? 0
    }
  }

  return (
    <DashboardShell
      profile={profile}
      profileId={profileId}
      initialNotifications={notifications}
      initialSessions={initialSessions}
      foundationScore={(profile as { foundation_score?: number | null } | null)?.foundation_score ?? null}
      brandKitCompleted={brandKitCompleted}
      pendingApprovalsCount={pendingApprovalsCount}
      role={(profile as any)?.role ?? null}
      isAdmin={['admin', 'owner'].includes((profile as any)?.role ?? '')}
    >
      {children}
    </DashboardShell>
  )
}
