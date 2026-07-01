import type { SupabaseClient } from '@supabase/supabase-js'

/** Total AI Toolkit runs allowed during Starter free trial (not per month). */
export const TRIAL_TOOLKIT_LIMIT = 5

export type ToolkitPlanLimits = {
  onTrial: boolean
  unlimited: boolean
  /** Runs consumed toward the current limit window. */
  runsUsed: number
  /** Max runs in the current window (trial total or Starter monthly). */
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

export async function isProfileOnStarterTrial(
  profile: { plan: string | null; stripe_subscription_id: string | null },
): Promise<boolean> {
  if (profile.plan !== 'starter' || !profile.stripe_subscription_id) return false
  try {
    const { getStripeClient } = await import('@/lib/stripe')
    const stripe = getStripeClient()
    if (!stripe) return false
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
    return subscription.status === 'trialing'
  } catch {
    return false
  }
}

export async function getToolkitPlanLimits(
  supabase: SupabaseClient,
  profile: { id: string; plan: string | null; stripe_subscription_id: string | null },
): Promise<ToolkitPlanLimits> {
  const plan = profile.plan
  const unlimited = plan === 'growth' || plan === 'proagent'

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
  const onTrial = await isProfileOnStarterTrial(profile)

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

  if (onTrial) {
    const used = totalRunsAllTime ?? 0
    return {
      onTrial: true,
      unlimited: false,
      runsUsed: used,
      runLimit: TRIAL_TOOLKIT_LIMIT,
      runsRemaining: Math.max(0, TRIAL_TOOLKIT_LIMIT - used),
      starterMonthlyLimit,
      totalRunsAllTime: used,
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
