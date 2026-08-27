import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { createServiceClient } from '@/lib/supabase/server'
import { loadDashboardSession } from '@/lib/profiles/getDashboardWorkspaceContext'
import AIToolkitClient from './AIToolkitClient'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import { getToolkitPlanLimits } from '@/lib/ai/toolkitPlanLimits'

export default async function AIToolkitPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()
  const { profile, workspace } = await loadDashboardSession(supabase, userId, email)

  if (!profile) redirect('/dashboard')

  const teamPerms = await getTeamPermissions(profile.id)
  if (!hasPermission(teamPerms, 'ai_toolkit')) redirect('/dashboard')

  const dataUserId = workspace?.workspaceId ?? profile.id
  const workspaceProfile = workspace?.workspaceProfile ?? profile

  const [promptsResult, savedPromptsResult, usageStatsResult, brandDocsResult, toolkitLimits] = await Promise.all([
    supabase
      .from('prompt_library')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('saved_prompts')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_tool_usage')
      .select('time_saved_mins')
      .eq('user_id', dataUserId),
    supabase
      .from('brand_documents')
      .select('type, title')
      .eq('user_id', dataUserId),
    getToolkitPlanLimits(supabase, {
      id: dataUserId,
      plan: workspaceProfile.plan,
      stripe_subscription_id: workspaceProfile.stripe_subscription_id,
    }),
  ])

  const prompts = promptsResult.data ?? []
  const savedPrompts = savedPromptsResult.data ?? []
  const usageStats = usageStatsResult.data ?? []
  const brandDocs = brandDocsResult.data ?? []

  const totalTimeSaved = usageStats.reduce((a, u) => a + (u.time_saved_mins ?? 0), 0)
  const totalRuns = usageStats.length

  const hasBrandKit = brandDocs.length > 0
  const brandKitComplete = ['voice', 'story', 'persona', 'positioning'].every(
    type => brandDocs.some(d => d.type === type),
  )

  return (
    <AIToolkitClient
      prompts={prompts}
      savedPrompts={savedPrompts}
      totalTimeSaved={totalTimeSaved}
      totalRuns={totalRuns}
      plan={workspaceProfile.plan ?? null}
      toolkitLimits={toolkitLimits}
      companyName={workspaceProfile.company_name ?? ''}
      hasBrandKit={hasBrandKit}
      brandKitComplete={brandKitComplete}
    />
  )
}
