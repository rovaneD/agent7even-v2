import type { SupabaseClient } from '@supabase/supabase-js'
import { TRIAL_TOOLKIT_RUNS } from '@/lib/billing/trialPolicy'
import { isProfileOnTrial } from '@/lib/billing/trialPolicy'

export { TRIAL_TOOLKIT_RUNS }
export { isProfileOnTrial, isProfileOnStarterTrial } from '@/lib/billing/trialPolicy'

export type ToolkitPlanLimits = {
  onTrial: boolean
  unlimited: boolean
  runsUsed: number
  runLimit: number
  runsRemaining: number
  starterMonthlyLimit: number
  totalRunsAllTime: number
}

export async function getStarterMonthlyLimit(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'starter_ai_limit')
    .single()
  return (data?.value as number) ?? 15
}

export async function getToolkitPlanLimits(
  supabase: SupabaseClient,
  profile: { id: string; plan: string | null; stripe_subscription_id: string | null },
): Promise<ToolkitPlanLimits> {
  const plan = profile.plan
  const onTrial = await isProfileOnTrial(profile)
  const unlimited = !onTrial && (plan === 'growth' || plan === 'proagent')

  const { count: totalRunsAllTime } = await supabase
    .from('ai_tool_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count: monthlyRuns } = await supabase
    .from('ai_tool_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .gte('created_at', startOfMonth.toISOString())

  const starterMonthlyLimit = await getStarterMonthlyLimit(supabase)

  if (onTrial) {
    const used = totalRunsAllTime ?? 0
    return {
      onTrial: true,
      unlimited: false,
      runsUsed: used,
      runLimit: TRIAL_TOOLKIT_RUNS,
      runsRemaining: Math.max(0, TRIAL_TOOLKIT_RUNS - used),
      starterMonthlyLimit,
      totalRunsAllTime: used,
    }
  }

  if (unlimited) {
    return {
      onTrial: false,
      unlimited: true,
      runsUsed: monthlyRuns ?? 0,
      runLimit: Infinity,
      runsRemaining: Infinity,
      starterMonthlyLimit,
      totalRunsAllTime: totalRunsAllTime ?? 0,
    }
  }

  const used = monthlyRuns ?? 0
  return {
    onTrial: false,
    unlimited: false,
    runsUsed: used,
    runLimit: plan === 'starter' ? starterMonthlyLimit : 0,
    runsRemaining: plan === 'starter' ? Math.max(0, starterMonthlyLimit - used) : 0,
    starterMonthlyLimit,
    totalRunsAllTime: totalRunsAllTime ?? 0,
  }
}
