import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import {
  isPaidPlanKey,
  TRIAL_MEDIA_CREDITS,
  trialEndingNotificationBody,
} from '@/lib/billing/trialPolicy'
import { allocateTrialCredits, grantPaidPlanAllowanceAfterTrial } from '@/lib/billing/trialCredits'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { PLAN_CREDITS } from '@/lib/credits'
import { createNotification } from '@/lib/createNotification'
import { getStripeClient, sanitizeSecretEnvValue } from '@/lib/stripe'
import { getPlanFromSubscription } from '@/lib/stripe/planFromPrice'
import { collectZernioProfileIds, disconnectAllZernioProfiles } from '@/lib/social/zernioProfileIds'

/**
 * Map Stripe's subscription status to the profile status field. Hardcoding
 * 'active' here would clear the paused flag for customers who are still
 * delinquent (past_due/unpaid) the next time any subscription field changes.
 */
function profileStatusFromSubscription(subscription: Stripe.Subscription): string | null {
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'paused'
    default:
      // canceled / incomplete states are handled by their own events.
      return null
  }
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  const webhookSecret = sanitizeSecretEnvValue(process.env.STRIPE_WEBHOOK_SECRET)

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe = getStripeClient()
  if (!stripe) return NextResponse.json({ error: 'Billing is not configured' }, { status: 500 })

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('Stripe webhook verification failed:', err)
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // ── checkout.session.completed ──────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // ── Credit top-up (mode: payment + credits in metadata) ────────────────
    if (session.mode === 'payment' && session.metadata?.credits && session.metadata?.user_id) {
      const credits  = parseInt(session.metadata.credits, 10)
      const userId   = session.metadata.user_id
      const now      = new Date().toISOString()

      await supabase
        .from('credit_topups')
        .update({
          status:            'completed',
          stripe_payment_id: session.payment_intent as string ?? null,
          completed_at:      now,
        })
        .eq('stripe_session_id', session.id)

      const { data: balRows } = await supabase
        .from('credit_balances')
        .select('balance')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)

      const prevBalance = balRows?.[0]?.balance ?? 0
      const newBalance  = prevBalance + credits

      await supabase
        .from('credit_balances')
        .upsert({ user_id: userId, balance: newBalance, updated_at: now })

      await supabase.from('credit_ledger').insert({
        user_id:       userId,
        type:          'topup',
        credits,
        balance_after: newBalance,
        description:   `Credit top-up — ${credits} credits ($${(session.amount_total ?? 0) / 100})`,
      })

      await createNotification({
        userId,
        title: `${credits} credits added`,
        body:  `Your credit top-up is complete. You now have ${newBalance} credits available.`,
        type:  'credit_topup',
        link:  '/dashboard/billing',
        sendEmail: false,
      })

      return NextResponse.json({ received: true })
    }

    // ── Subscription activation ─────────────────────────────────────────────
    if (session.mode !== 'subscription') return NextResponse.json({ received: true })

    const subscriptionId = session.subscription as string
    const customerId = session.customer as string

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const plan = getPlanFromSubscription(subscription)

    // clerk_user_id lives on subscription metadata (set via subscription_data.metadata at checkout)
    const clerkUserId =
      subscription.metadata?.clerk_user_id ??
      session.metadata?.clerk_user_id

    if (!clerkUserId || !plan) {
      console.error('Missing clerk_user_id or plan in checkout session', { clerkUserId, plan })
      return NextResponse.json({ received: true })
    }

    // Canonical row only — updating every clerk_user_id row would attach the
    // subscription to duplicate profiles.
    const newProfile = await resolveClerkProfile(
      supabase, clerkUserId, 'id', session.customer_details?.email,
    )

    const { error } = await supabase
      .from('profiles')
      .update({
        plan,
        status: 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq(newProfile ? 'id' : 'clerk_user_id', newProfile ? newProfile.id : clerkUserId)

    if (error) {
      console.error('Supabase update error (checkout.session.completed):', error)
    } else {
      if (newProfile) {
        // Reactivation: cancellation deactivates schedules, so a returning
        // subscriber needs them switched back on (there is no user-facing
        // pause yet, so is_active=false only ever means "was cancelled").
        await supabase
          .from('agent_schedules')
          .update({ is_active: true })
          .eq('user_id', newProfile.id)
          .eq('is_active', false)

        const isTrialing = subscription.status === 'trialing'
        const creditsGranted = isTrialing
          ? await allocateTrialCredits(newProfile.id)
          : await grantPaidPlanAllowanceAfterTrial(newProfile.id, plan)

        await createNotification({
          userId: newProfile.id,
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
  }

  // ── customer.subscription.updated ──────────────────────────────────────────
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const previous = event.data.previous_attributes as Partial<Stripe.Subscription> | undefined

    const clerkUserId = subscription.metadata?.clerk_user_id
    const plan = getPlanFromSubscription(subscription)
    const status = profileStatusFromSubscription(subscription)

    let profileId: string | undefined

    if (plan) {
      const update: Record<string, unknown> = { plan, updated_at: new Date().toISOString() }
      if (status) update.status = status

      const { data: linkedProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle()

      profileId = linkedProfile?.id

      if (linkedProfile?.id) {
        const { error } = await supabase.from('profiles').update(update).eq('id', linkedProfile.id)
        if (error) console.error('Supabase update error (subscription.updated):', error)
      } else if (clerkUserId) {
        const canonical = await resolveClerkProfile(supabase, clerkUserId, 'id')
        profileId = canonical?.id
        const { error } = await supabase
          .from('profiles')
          .update(update)
          .eq(canonical ? 'id' : 'clerk_user_id', canonical ? canonical.id : clerkUserId)
        if (error) console.error('Supabase update error (subscription.updated):', error)
      }
    }

    if (
      profileId &&
      plan &&
      previous?.status === 'trialing' &&
      subscription.status === 'active'
    ) {
      await grantPaidPlanAllowanceAfterTrial(profileId, plan)
    }
  }

  // ── customer.subscription.trial_will_end ────────────────────────────────────
  // Stripe fires ~3 days before trial end (or immediately for short trials).
  if (event.type === 'customer.subscription.trial_will_end') {
    const subscription = event.data.object as Stripe.Subscription
    const clerkUserId = subscription.metadata?.clerk_user_id

    const { data: linkedProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle()

    let profileId = linkedProfile?.id as string | undefined
    if (!profileId && clerkUserId) {
      const canonical = await resolveClerkProfile(supabase, clerkUserId, 'id')
      profileId = canonical?.id
    }

    if (profileId && subscription.trial_end) {
      const endsAt = new Date(subscription.trial_end * 1000)
      const endsLabel = endsAt.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
      })
      const planKey = getPlanFromSubscription(subscription)
      const body =
        planKey && isPaidPlanKey(planKey)
          ? trialEndingNotificationBody(planKey, endsLabel)
          : `Your trial ends on ${endsLabel}. Your card will be charged on day 8 unless you cancel from Billing first.`
      await createNotification({
        userId: profileId,
        title: 'Your free trial is ending soon',
        body,
        type: 'trial_ending',
        link: '/dashboard/billing',
        sendEmail: true,
        emailSubject: 'Your Agent7even trial ends soon',
      })
    }

    return NextResponse.json({ received: true })
  }

  // ── customer.subscription.deleted ──────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const clerkUserId = subscription.metadata?.clerk_user_id

    // Look up the profile to find and disconnect any Zernio accounts before clearing plan
    const cancelledProfile = clerkUserId
      ? await resolveClerkProfile<{
          id: string
          zernio_profile_id: string | null
          zernio_profile_ids: string[] | null
          zernio_connected_platforms: string[] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          plan: string | null
          created_at: string
        }>(supabase, clerkUserId, 'id, zernio_profile_id, zernio_profile_ids, zernio_connected_platforms')
      : (
          await supabase
            .from('profiles')
            .select('id, zernio_profile_id, zernio_profile_ids, zernio_connected_platforms')
            .eq('stripe_subscription_id', subscription.id)
            .single()
        ).data

    if (cancelledProfile) {
      const zernioProfileIds = collectZernioProfileIds(cancelledProfile)
      if (zernioProfileIds.length > 0) {
        const teardownResults = await disconnectAllZernioProfiles(zernioProfileIds)
        for (const { id, ok } of teardownResults) {
          if (ok) {
            console.log(`[stripe/webhook] Disconnected Zernio profile ${id} on subscription cancellation`)
          } else {
            console.warn(`[stripe/webhook] Failed to disconnect Zernio profile ${id} on subscription cancellation`)
          }
        }
      }
    }

    const churnUpdate = {
      plan: null, status: 'churned', stripe_subscription_id: null,
      zernio_connected_platforms: [], zernio_profile_id: null, zernio_profile_ids: [],
      updated_at: new Date().toISOString(),
    }
    if (cancelledProfile?.id) {
      await supabase.from('profiles').update(churnUpdate).eq('id', cancelledProfile.id)
    } else if (clerkUserId) {
      await supabase.from('profiles').update(churnUpdate).eq('clerk_user_id', clerkUserId)
    } else {
      await supabase.from('profiles').update(churnUpdate).eq('stripe_subscription_id', subscription.id)
    }

    // Stop autonomous agent runs — otherwise the hourly cron keeps burning
    // model spend for churned accounts.
    if (cancelledProfile?.id) {
      const { error: scheduleError } = await supabase
        .from('agent_schedules')
        .update({ is_active: false })
        .eq('user_id', cancelledProfile.id)
      if (scheduleError) {
        console.error('Failed to deactivate agent schedules on cancellation:', scheduleError)
      }
    }

    const notifyUserId = cancelledProfile?.id
    if (notifyUserId) {
      await createNotification({
        userId: notifyUserId,
        title: 'Subscription canceled',
        body: 'Your subscription has ended. Reactivate anytime from Billing to keep your agents running.',
        type: 'subscription_canceled',
        link: '/dashboard/billing',
        sendEmail: true,
        emailSubject: 'Your Agent7even subscription has ended',
      })
    }

    return NextResponse.json({ received: true })
  }

  // ── invoice.payment_failed ──────────────────────────────────────────────────
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    // In API 2026-04-22.dahlia, subscription moved to invoice.parent.subscription_details.subscription
    const parent = invoice.parent as { type?: string; subscription_details?: { subscription?: string } } | null
    const subscriptionId =
      parent?.type === 'subscription_details'
        ? (parent.subscription_details?.subscription as string | undefined)
        : undefined

    if (subscriptionId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

      await supabase
        .from('profiles')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscriptionId)

      if (profile?.id) {
        await createNotification({
          userId: profile.id,
          title: 'Payment failed',
          body: 'We could not process your latest payment. Update your billing details to avoid service interruption.',
          type: 'payment_failed',
          link: '/dashboard/billing',
          sendEmail: true,
          emailSubject: 'Action required — payment failed on Agent7even',
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}
