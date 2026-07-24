import type Stripe from 'stripe'
import { allocateTrialCredits, grantPaidPlanAllowanceAfterTrial } from '@/lib/billing/trialCredits'
import { isPaidPlanKey, TRIAL_MEDIA_CREDITS } from '@/lib/billing/trialPolicy'
import type { PaidPlan } from '@/lib/plans'
import { PLAN_CREDITS } from '@/lib/credits'
import { createNotification } from '@/lib/createNotification'
import { getBillingProfileForClerkUser } from '@/lib/profiles/getBillingProfile'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { getPlanFromSubscription } from '@/lib/stripe/planFromPrice'
import { getStripeClient } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'

function resolveSubscriptionPlan(subscription: Stripe.Subscription): PaidPlan | null {
  const fromPrice = getPlanFromSubscription(subscription)
  if (fromPrice) return fromPrice
  const metaPlan = subscription.metadata?.plan
  return isPaidPlanKey(metaPlan) ? metaPlan : null
}

export type ActivateCheckoutResult =
  | { ok: true; plan: string; profileId: string; alreadyActive: boolean }
  | { ok: false; reason: string }

/** Idempotent — safe when webhook already ran or client polls after success redirect. */
export async function activateSubscriptionFromCheckoutSession(
  sessionId: string,
  expectedClerkUserId: string,
): Promise<ActivateCheckoutResult> {
  const stripe = getStripeClient()
  if (!stripe) return { ok: false, reason: 'billing_not_configured' }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  })

  if (session.mode !== 'subscription') {
    return { ok: false, reason: 'not_subscription_checkout' }
  }

  const subscriptionRef = session.subscription
  const subscriptionId =
    typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id

  if (!subscriptionId || !customerId) {
    return { ok: false, reason: 'incomplete_session' }
  }

  const subscription =
    typeof subscriptionRef === 'object' && subscriptionRef
      ? subscriptionRef
      : await stripe.subscriptions.retrieve(subscriptionId)

  const plan = resolveSubscriptionPlan(subscription)
  if (!plan) return { ok: false, reason: 'unknown_plan' }

  const supabase = createServiceClient()
  const profile = await resolveClerkProfile(
    supabase,
    expectedClerkUserId,
    'id, stripe_customer_id, stripe_subscription_id',
    session.customer_details?.email,
  )
  if (!profile) return { ok: false, reason: 'profile_not_found' }

  const metadataClerkUserId =
    subscription.metadata?.clerk_user_id ??
    session.metadata?.clerk_user_id

  const customerMatchesProfile =
    Boolean(profile.stripe_customer_id) && profile.stripe_customer_id === customerId

  if (metadataClerkUserId && metadataClerkUserId !== expectedClerkUserId) {
    return { ok: false, reason: 'session_user_mismatch' }
  }
  if (!metadataClerkUserId && !customerMatchesProfile && profile.stripe_customer_id) {
    return { ok: false, reason: 'session_user_mismatch' }
  }

  const alreadyLinked = profile.stripe_subscription_id === subscriptionId

  const { error } = await supabase
    .from('profiles')
    .update({
      plan,
      status: 'active',
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)

  if (error) {
    console.error('[activateCheckoutSession] profile update failed', error)
    return { ok: false, reason: 'profile_update_failed' }
  }

  if (!alreadyLinked) {
    await supabase
      .from('agent_schedules')
      .update({ is_active: true })
      .eq('user_id', profile.id)
      .eq('is_active', false)

    const { data: existingTrialCredit } = await supabase
      .from('credit_ledger')
      .select('id')
      .eq('user_id', profile.id)
      .eq('type', 'allocation')
      .ilike('description', '%Trial allocation%')
      .limit(1)
      .maybeSingle()

    if (!existingTrialCredit) {
      const isTrialing = subscription.status === 'trialing'
      const creditsGranted = isTrialing
        ? await allocateTrialCredits(profile.id)
        : await grantPaidPlanAllowanceAfterTrial(profile.id, plan)

      await createNotification({
        userId: profile.id,
        title: 'Welcome to Agent7even!',
        body: creditsGranted != null
          ? isTrialing
            ? `Your ${plan} trial is active with ${TRIAL_MEDIA_CREDITS} media credits to explore.`
            : `Your ${plan} plan is active with ${PLAN_CREDITS[plan]} credits ready to use.`
          : `Your ${plan} plan is now active. You have full access to your dashboard.`,
        type: 'plan_activated',
        link: '/foundation',
        sendEmail: false,
      })
    }
  }

  return { ok: true, plan, profileId: profile.id, alreadyActive: alreadyLinked }
}

export async function linkExistingStripeSubscriptionForClerkUser(
  clerkUserId: string,
  customerId: string,
): Promise<ActivateCheckoutResult | null> {
  const stripe = getStripeClient()
  if (!stripe) return null

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  })

  const live = subs.data.find(s =>
    ['trialing', 'active', 'past_due'].includes(s.status),
  )
  if (!live) return null

  const plan = resolveSubscriptionPlan(live)
  if (!plan) return null

  const supabase = createServiceClient()
  const profile = await resolveClerkProfile(supabase, clerkUserId, 'id, stripe_subscription_id')
  if (!profile) return null

  const alreadyLinked = profile.stripe_subscription_id === live.id

  await supabase
    .from('profiles')
    .update({
      plan,
      status: 'active',
      stripe_customer_id: customerId,
      stripe_subscription_id: live.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)

  if (!alreadyLinked && live.status === 'trialing') {
    const { data: existingTrialCredit } = await supabase
      .from('credit_ledger')
      .select('id')
      .eq('user_id', profile.id)
      .eq('type', 'allocation')
      .ilike('description', '%Trial allocation%')
      .limit(1)
      .maybeSingle()
    if (!existingTrialCredit) {
      await allocateTrialCredits(profile.id)
    }
  }

  return { ok: true, plan, profileId: profile.id, alreadyActive: alreadyLinked }
}

/** Pull subscription from Stripe when webhook/session sync lagged (common in local dev). */
export async function recoverPaidSubscriptionForClerkUser(
  clerkUserId: string,
  email?: string | null,
): Promise<ActivateCheckoutResult | null> {
  const stripe = getStripeClient()
  if (!stripe) return null

  const supabase = createServiceClient()
  const billing = await getBillingProfileForClerkUser(supabase, clerkUserId, email)

  if (billing?.stripe_customer_id) {
    const linked = await linkExistingStripeSubscriptionForClerkUser(
      clerkUserId,
      billing.stripe_customer_id,
    )
    if (linked?.ok) return linked
  }

  const normalizedEmail = email?.trim()
  if (!normalizedEmail) return null

  const customers = await stripe.customers.list({ email: normalizedEmail, limit: 10 })
  for (const customer of customers.data) {
    const metaClerk = customer.metadata?.clerk_user_id
    if (metaClerk && metaClerk !== clerkUserId) continue

    const profile = await resolveClerkProfile(
      supabase,
      clerkUserId,
      'id, stripe_customer_id, stripe_subscription_id',
      normalizedEmail,
    )
    if (profile && profile.stripe_customer_id !== customer.id) {
      await supabase
        .from('profiles')
        .update({
          stripe_customer_id: customer.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
    }

    const linked = await linkExistingStripeSubscriptionForClerkUser(clerkUserId, customer.id)
    if (linked?.ok) return linked

    const sessions = await stripe.checkout.sessions.list({
      customer: customer.id,
      limit: 5,
    })
    const completed = sessions.data.find(
      s => s.status === 'complete' && s.mode === 'subscription' && s.subscription,
    )
    if (completed?.id) {
      const activated = await activateSubscriptionFromCheckoutSession(completed.id, clerkUserId)
      if (activated.ok) return activated
    }
  }

  return null
}
