import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import AIToolkitClient from './AIToolkitClient'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import { getToolkitPlanLimits } from '@/lib/ai/toolkitPlanLimits'

export default async function AIToolkitPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, plan, stripe_subscription_id, billing_exempt')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) redirect('/dashboard')

  const teamPerms = await getTeamPermissions(profile.id)
  if (!hasPermission(teamPerms, 'ai_toolkit')) redirect('/dashboard')

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
      .eq('user_id', profile.id),
    supabase
      .from('brand_documents')
      .select('type, title')
      .eq('user_id', profile.id),
    getToolkitPlanLimits(supabase, profile),
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
      plan={profile.plan ?? null}
      toolkitLimits={toolkitLimits}
      companyName={profile.company_name ?? ''}
      hasBrandKit={hasBrandKit}
      brandKitComplete={brandKitComplete}
    />
  )
}
