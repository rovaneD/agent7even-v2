import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { allocateTrialCredits } from '../../lib/billing/trialCredits'
import { TRIAL_DAYS, TRIAL_MEDIA_CREDITS } from '../../lib/billing/trialPolicy'

export const TRIAL_QA_PLANS = ['starter', 'growth', 'proagent'] as const
export type TrialQaPlan = (typeof TRIAL_QA_PLANS)[number]

export type TrialingProfileRow = {
  id: string
  plan: TrialQaPlan
  stripe_subscription_id: string
  balance: number | null
  subscription: Stripe.Subscription
}

function monthlyPriceId(plan: TrialQaPlan): string {
  const qaOverride = process.env[`STRIPE_QA_${plan.toUpperCase()}_MONTHLY_PRICE_ID`]?.trim()
  if (qaOverride) return qaOverride
  const map: Record<TrialQaPlan, string | undefined> = {
    starter: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    growth: process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID,
    proagent: process.env.STRIPE_PROAGENT_MONTHLY_PRICE_ID,
  }
  return map[plan]?.trim() ?? ''
}

function qaProfileIdEnv(plan: TrialQaPlan): string | undefined {
  return (
    process.env[`STRIPE_QA_${plan.toUpperCase()}_PROFILE_ID`]?.trim() ||
    (plan === 'starter' ? process.env.STRIPE_QA_PROFILE_ID?.trim() : undefined)
  )
}

export async function collectTrialingProfiles(
  supabase: SupabaseClient,
  stripe: Stripe,
): Promise<Map<TrialQaPlan, TrialingProfileRow>> {
  const byPlan = new Map<TrialQaPlan, TrialingProfileRow>()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, plan, stripe_subscription_id, status, email')
    .not('stripe_subscription_id', 'is', null)
    .in('plan', [...TRIAL_QA_PLANS])

  if (error) throw new Error(`profiles query: ${error.message}`)

  for (const row of profiles ?? []) {
    const plan = row.plan as TrialQaPlan
    if (!TRIAL_QA_PLANS.includes(plan)) continue
    if (byPlan.has(plan)) continue
    if (!row.stripe_subscription_id) continue

    let sub: Stripe.Subscription
    try {
      sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
    } catch {
      continue
    }
    if (sub.status !== 'trialing') continue

    const { data: bal } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', row.id)
      .maybeSingle()

    byPlan.set(plan, {
      id: row.id,
      plan,
      stripe_subscription_id: row.stripe_subscription_id,
      balance: bal?.balance ?? null,
      subscription: sub,
    })
  }

  return byPlan
}

async function pickProvisionProfile(
  supabase: SupabaseClient,
  plan: TrialQaPlan,
  reservedIds: Set<string>,
): Promise<string | null> {
  const fromEnv = qaProfileIdEnv(plan)
  if (fromEnv) return fromEnv

  const { data: rows } = await supabase
    .from('profiles')
    .select('id, stripe_subscription_id')
    .is('stripe_subscription_id', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const candidate = rows?.find(r => !reservedIds.has(r.id))
  return candidate?.id ?? null
}

export async function ensureTrialingProfileForPlan(
  supabase: SupabaseClient,
  stripe: Stripe,
  plan: TrialQaPlan,
  reservedProfileIds: Set<string>,
  qaTag: string,
): Promise<TrialingProfileRow | null> {
  const priceId = monthlyPriceId(plan)
  if (!priceId) {
    console.log(`  skip provision ${plan} — monthly price ID not configured`)
    return null
  }

  const profileId = await pickProvisionProfile(supabase, plan, reservedProfileIds)
  if (!profileId) {
    console.log(
      `  skip provision ${plan} — no QA profile (set STRIPE_QA_${plan.toUpperCase()}_PROFILE_ID or add profiles without stripe_subscription_id)`,
    )
    return null
  }

  reservedProfileIds.add(profileId)
  console.log(`\n  Provisioning trialing ${plan} on QA profile ${profileId.slice(0, 8)}…`)

  const { data: qaProfile } = await supabase
    .from('profiles')
    .select('id, stripe_customer_id, stripe_subscription_id, email')
    .eq('id', profileId)
    .maybeSingle()

  if (!qaProfile) return null

  if (qaProfile.stripe_subscription_id) {
    try {
      const existing = await stripe.subscriptions.retrieve(qaProfile.stripe_subscription_id)
      if (existing.status === 'trialing') {
        await stripe.subscriptions.cancel(qaProfile.stripe_subscription_id)
      }
    } catch {
      /* stale id */
    }
  }

  const customerId =
    qaProfile.stripe_customer_id ??
    (
      await stripe.customers.create({
        email: qaProfile.email ?? undefined,
        metadata: { qa_profile_id: qaProfile.id, qa: qaTag, plan },
      })
    ).id

  if (!qaProfile.stripe_customer_id) {
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', qaProfile.id)
  }

  const sub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: TRIAL_DAYS,
    metadata: { plan, qa: qaTag },
  })

  await supabase
    .from('profiles')
    .update({
      plan,
      status: 'active',
      stripe_subscription_id: sub.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', qaProfile.id)

  await allocateTrialCredits(qaProfile.id)

  const { data: balAfter } = await supabase
    .from('credit_balances')
    .select('balance')
    .eq('user_id', qaProfile.id)
    .maybeSingle()

  return {
    id: qaProfile.id,
    plan,
    stripe_subscription_id: sub.id,
    balance: balAfter?.balance ?? null,
    subscription: sub,
  }
}

/** Collect trialing rows per tier; provision any missing tier in test mode. */
export async function ensureTrialingForAllTiers(
  supabase: SupabaseClient,
  stripe: Stripe,
  qaTag: string,
): Promise<Map<TrialQaPlan, TrialingProfileRow>> {
  const byPlan = await collectTrialingProfiles(supabase, stripe)
  const reserved = new Set<string>([...byPlan.values()].map(r => r.id))

  for (const plan of TRIAL_QA_PLANS) {
    if (byPlan.has(plan)) continue
    const provisioned = await ensureTrialingProfileForPlan(
      supabase,
      stripe,
      plan,
      reserved,
      qaTag,
    )
    if (provisioned) byPlan.set(plan, provisioned)
  }

  return byPlan
}

export function trialLengthDays(sub: Stripe.Subscription): number | null {
  if (!sub.trial_end || !sub.trial_start) return null
  return Math.round((sub.trial_end - sub.trial_start) / 86400)
}

export { TRIAL_DAYS, TRIAL_MEDIA_CREDITS }
