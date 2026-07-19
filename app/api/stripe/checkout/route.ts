import { auth } from '@clerk/nextjs/server'
import { getClerkUserSafe } from '@/lib/clerk/sessionUser'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { ensureProfileForClerkUser } from '@/lib/profiles/ensureProfile'
import { getBillingProfileForClerkUser } from '@/lib/profiles/getBillingProfile'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { createServiceClient } from '@/lib/supabase/server'
import {
  assertCheckoutPrice,
  formatStripeCheckoutError,
  resolveStripeCustomer,
} from '@/lib/stripe/billing'
import { getStripeClient } from '@/lib/stripe'

const PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID!,
    annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID!,
  },
  growth: {
    monthly: process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID!,
    annual: process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID!,
  },
  proagent: {
    monthly: process.env.STRIPE_PROAGENT_MONTHLY_PRICE_ID!,
    annual: process.env.STRIPE_PROAGENT_ANNUAL_PRICE_ID!,
  },
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getClerkUserSafe()
    const { plan, annual = false } = await req.json()
    const stripe = getStripeClient()
    if (!stripe) return NextResponse.json({ error: 'Billing is not configured' }, { status: 500 })

    if (!PRICE_IDS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const priceId = annual ? PRICE_IDS[plan].annual : PRICE_IDS[plan].monthly
    if (!priceId) {
      return NextResponse.json({ error: 'Plan pricing is not configured' }, { status: 500 })
    }

    await assertCheckoutPrice(stripe, priceId, plan)

    const supabase = createServiceClient()

    // Canonical resolution — with duplicate rows, the newest one may not carry
    // the Stripe customer, and attaching a subscription to the wrong row is
    // exactly the duplicate-profile bug class eliminated on July 13.
    type CheckoutProfile = {
      id: string
      email: string | null
      full_name: string | null
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      plan: string | null
      created_at: string
    }
    const checkoutSelect = 'id, email, full_name, stripe_customer_id'

    let profile = await resolveClerkProfile<CheckoutProfile>(supabase, userId, checkoutSelect)
    if (!profile) {
      await ensureProfileForClerkUser(supabase, userId, user)
      profile = await resolveClerkProfile<CheckoutProfile>(supabase, userId, checkoutSelect)
    }
    if (!profile) {
      return NextResponse.json(
        { error: 'Account profile not found. Refresh the page and try again.' },
        { status: 404 },
      )
    }

    const email = profile.email ?? user?.emailAddresses?.[0]?.emailAddress ?? null
    const fullName =
      profile.full_name ??
      ([user?.firstName, user?.lastName].filter(Boolean).join(' ') || null)

    if (!email) {
      return NextResponse.json(
        { error: 'No email on file for checkout. Add an email to your account and try again.' },
        { status: 400 },
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.agent7even.ai'

    // Existing subscribers change plans in place — a fresh Checkout Session
    // here would create a second, parallel subscription (double billing).
    const billingProfile = await getBillingProfileForClerkUser(supabase, userId, email)
    if (billingProfile?.stripe_subscription_id) {
      let existing: Stripe.Subscription | null = null
      try {
        existing = await stripe.subscriptions.retrieve(billingProfile.stripe_subscription_id)
      } catch {
        // Subscription no longer exists in Stripe — fall through to a fresh checkout.
      }

      if (existing && ['active', 'trialing', 'past_due'].includes(existing.status)) {
        const planPriceIds = new Set(
          Object.values(PRICE_IDS).flatMap(p => [p.monthly, p.annual]).filter(Boolean),
        )
        const planItem = existing.items.data.find(item => planPriceIds.has(item.price.id))

        if (!planItem) {
          return NextResponse.json(
            { error: 'Your subscription needs manual review. Manage your plan from the billing portal.' },
            { status: 409 },
          )
        }

        if (planItem.price.id === priceId) {
          return NextResponse.json({ error: 'You are already on this plan.' }, { status: 400 })
        }

        const updatedSubscription = await stripe.subscriptions.update(billingProfile.stripe_subscription_id, {
          items: [{ id: planItem.id, price: priceId }],
          proration_behavior: 'always_invoice',
          // Trial is Starter-only: moving to a paid tier ends it and charges now.
          ...(existing.status === 'trialing' && plan !== 'starter' ? { trial_end: 'now' as const } : {}),
          metadata: { ...existing.metadata, clerk_user_id: userId, plan },
        })

        // Stripe's default update behavior returns past_due when the immediate
        // proration cannot be paid. Do not restore platform access until Stripe
        // confirms the subscription is active/trialing.
        const profileStatus =
          updatedSubscription.status === 'active' || updatedSubscription.status === 'trialing'
            ? 'active'
            : 'paused'

        await supabase
          .from('profiles')
          .update({ plan, status: profileStatus, updated_at: new Date().toISOString() })
          .eq('id', billingProfile.id)

        return NextResponse.json({ url: `${appUrl}/dashboard/billing?plan_changed=${plan}` })
      }
    }

    const customerId = await resolveStripeCustomer(stripe, {
      profileId: profile.id,
      storedCustomerId: profile.stripe_customer_id,
      email,
      fullName,
      clerkUserId: userId,
      supabase,
    })

    // Only Starter gets a 3-day trial — Growth and ProAgent charge immediately
    const subscriptionData: Stripe.Checkout.SessionCreateParams['subscription_data'] = {
      metadata: { clerk_user_id: userId, plan },
      ...(plan === 'starter' ? { trial_period_days: 3 } : {}),
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=true`,
      cancel_url: `${appUrl}/dashboard/billing`,
      subscription_data: subscriptionData,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout]', err)
    return NextResponse.json({ error: formatStripeCheckoutError(err) }, { status: 500 })
  }
}
