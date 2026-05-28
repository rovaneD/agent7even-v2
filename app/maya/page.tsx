import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import MayaShell from './MayaShell'

const NEW_USER_PROMPT = `__SYSTEM_INIT__ User just completed onboarding. Generate your opening message based on what you know about their business. Reference their specific goals, budget, and biggest challenge. Keep it under 4 sentences. End with one specific question that moves them toward their first campaign.`

export default async function MayaPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; task?: string; campaignId?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const isNewUser = params?.new === 'true'
  const taskParam = params?.task ? decodeURIComponent(params.task) : undefined
  const campaignIdParam = params?.campaignId ?? null

  const supabase = createServiceClient()

  const [{ data: profile }, { count: pendingCount }] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        id, company_name, business_type, full_name, plan,
        website_url, instagram_handle, business_goals,
        ideal_customer, sell_locations, marketing_budget,
        competitors, top_goals, marketing_challenge, content_comfort,
        foundation_complete
      `)
      .eq('clerk_user_id', userId)
      .single(),

    supabase
      .from('agent_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('requires_approval', true)
      .eq('status', 'complete')
      .is('approved_at', null)
      .is('rejected_at', null),
  ])

  const { data: recentCampaign } = profile
    ? await supabase
        .from('campaigns')
        .select('id')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    : { data: null }

  // Only gate on foundation if the column exists and is explicitly false
  if (profile && profile.foundation_complete === false) redirect('/foundation')

  return (
    <MayaShell
      profile={profile}
      pendingApprovalCount={pendingCount ?? 0}
      initialPrompt={taskParam ?? (isNewUser ? NEW_USER_PROMPT : undefined)}
      activeCampaignId={campaignIdParam ?? recentCampaign?.id ?? null}
    />
  )
}
