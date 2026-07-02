import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'
import { getPendingApprovalCount } from '@/lib/agents/pendingApprovals'
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
    const user = await currentUser()
    const email = user?.emailAddresses?.[0]?.emailAddress ?? null
    const p = await getDashboardProfileForClerkUser(supabase, userId, email)

    if (p?.id) {
      profile = p
      profileId = p.id

      const [{ data: notifs }, { data: sessionRows }, { data: brandKitRows }, approvalsCount] = await Promise.all([
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

        getPendingApprovalCount(supabase, p.id),

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
      foundationScore={profile?.foundation_score ?? null}
      brandKitCompleted={brandKitCompleted}
      pendingApprovalsCount={pendingApprovalsCount}
      role={profile?.role ?? null}
      isAdmin={['admin', 'owner'].includes(profile?.role ?? '')}
    >
      {children}
    </DashboardShell>
  )
}
