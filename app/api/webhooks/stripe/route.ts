import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { allocatePlanCredits, PLAN_CREDITS } from '@/lib/credits'
import { createNotification } from '@/lib/createNotification'
import { getStripeClient, sanitizeSecretEnvValue } from '@/lib/stripe'
import { collectZernioProfileIds, disconnectAllZernioProfiles } from '@/lib/social/zernioProfileIds'

function getPlanFromPriceId(priceId: string): string | null {
  const map: Record<string, string> = {
    [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID!]: 'starter',
    [process.env.STRIPE_STARTER_ANNUAL_PRICE_ID!]: 'starter',
    [process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID!]: 'growth',
    [process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID!]: 'growth',
    [process.env.STRIPE_PROAGENT_MONTHLY_PRICE_ID!]: 'proagent',
    [process.env.STRIPE_PROAGENT_ANNUAL_PRICE_ID!]: 'proagent',
  }
  return map[priceId] ?? null
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
    const priceId = subscription.items.data[0]?.price.id
    const plan = getPlanFromPriceId(priceId)

    // clerk_user_id lives on subscription metadata (set via subscription_data.metadata at checkout)
    const clerkUserId =
      subscription.metadata?.clerk_user_id ??
      session.metadata?.clerk_user_id

    if (!clerkUserId || !plan) {
      console.error('Missing clerk_user_id or plan in checkout session', { clerkUserId, plan })
      return NextResponse.json({ received: true })
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        plan,
        status: 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', clerkUserId)

    if (error) {
      console.error('Supabase update error (checkout.session.completed):', error)
    } else {
      const { data: newProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('clerk_user_id', clerkUserId)
        .single()

      if (newProfile) {
        const creditsGranted = await allocatePlanCredits(newProfile.id, plan, {
          skipIfAllocated: true,
          description: `Plan activation — ${plan} plan`,
        })

        await createNotification({
          userId: newProfile.id,
          title: 'Welcome to Agent7even!',
          body: creditsGranted != null
            ? `Your ${plan} plan is active with ${PLAN_CREDITS[plan]} credits ready to use.`
            : `Your ${plan} plan is now active. You have full access to your dashboard.`,
          type: 'plan_activated',
          link: '/dashboard',
          sendEmail: false,
        })
      }
    }
  }

  // ── customer.subscription.updated ──────────────────────────────────────────
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription

    const clerkUserId = subscription.metadata?.clerk_user_id
    const priceId = subscription.items.data[0]?.price.id
    const plan = getPlanFromPriceId(priceId)

    if (!clerkUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('clerk_user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()

      if (profile?.clerk_user_id && plan) {
        await supabase
          .from('profiles')
          .update({ plan, status: 'active', updated_at: new Date().toISOString() })
          .eq('clerk_user_id', profile.clerk_user_id)
      }
      return NextResponse.json({ received: true })
    }

    if (plan) {
      const { error } = await supabase
        .from('profiles')
        .update({ plan, status: 'active', updated_at: new Date().toISOString() })
        .eq('clerk_user_id', clerkUserId)

      if (error) console.error('Supabase update error (subscription.updated):', error)
    }
  }

  // ── customer.subscription.deleted ──────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const clerkUserId = subscription.metadata?.clerk_user_id

    // Look up the profile to find and disconnect any Zernio accounts before clearing plan
    const profileQuery = clerkUserId
      ? supabase.from('profiles').select('id, zernio_profile_id, zernio_profile_ids, zernio_connected_platforms').eq('clerk_user_id', clerkUserId).single()
      : supabase.from('profiles').select('id, zernio_profile_id, zernio_profile_ids, zernio_connected_platforms').eq('stripe_subscription_id', subscription.id).single()

    const { data: cancelledProfile } = await profileQuery

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

    if (clerkUserId) {
      await supabase
        .from('profiles')
        .update({
          plan: null, status: 'churned', stripe_subscription_id: null,
          zernio_connected_platforms: [], zernio_profile_id: null, zernio_profile_ids: [],
          updated_at: new Date().toISOString(),
        })
        .eq('clerk_user_id', clerkUserId)
    } else {
      await supabase
        .from('profiles')
        .update({
          plan: null, status: 'churned', stripe_subscription_id: null,
          zernio_connected_platforms: [], zernio_profile_id: null, zernio_profile_ids: [],
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)
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
