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
  let initialMessages: unknown[] = []
  let initialMode: string | null = null

  if (userId) {
    const { data: p } = await supabase
      .from('profiles')
      .select(`
        id, company_name, full_name, business_type, plan, role,
        website_url, instagram_handle, ideal_customer,
        sell_locations, marketing_budget, competitors,
        top_goals, marketing_challenge, content_comfort,
        foundation_complete, foundation_score
      `)
      .eq('clerk_user_id', userId)
      .single()

    if (p?.id) {
      profile = p
      profileId = p.id

      const [{ data: notifs }, { data: session }] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', p.id)
          .order('created_at', { ascending: false })
          .limit(20),

        supabase
          .from('chat_sessions')
          .select('messages, mode')
          .eq('user_id', p.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single(),

        logActivity(p.id, 'page_view'),
      ])

      notifications     = notifs    ?? []
      initialMessages   = (session?.messages as unknown[]) ?? []
      initialMode       = session?.mode ?? null
    }
  }

  return (
    <DashboardShell
      profile={profile}
      profileId={profileId}
      initialNotifications={notifications}
      initialMessages={initialMessages}
      initialMode={initialMode}
      foundationScore={(profile as { foundation_score?: number | null } | null)?.foundation_score ?? null}
      role={(profile as any)?.role ?? null}
    >
      {children}
    </DashboardShell>
  )
}
