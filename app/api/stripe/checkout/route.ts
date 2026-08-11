import { auth } from '@clerk/nextjs/server'
import { getClerkUserSafe } from '@/lib/clerk/sessionUser'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import {
  comparePlanTier,
  isPaidPlanKey,
  TRIAL_DAYS,
  upgradeChargeMessage,
} from '@/lib/billing/trialPolicy'
import { ensureProfileForClerkUser } from '@/lib/profiles/ensureProfile'
import { getBillingProfileForClerkUser } from '@/lib/profiles/getBillingProfile'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { createServiceClient } from '@/lib/supabase/server'
import { linkExistingStripeSubscriptionForClerkUser } from '@/lib/billing/activateCheckoutSession'
import { syncExtraSeatQuantityForProfile } from '@/lib/billing/syncExtraSeatQuantity'
import {
  assertCheckoutPrice,
  formatStripeCheckoutError,
  resolveCheckoutAppUrl,
  resolveStripeCustomer,
} from '@/lib/stripe/billing'
import { getStripeClient } from '@/lib/stripe'
import { allPlanPriceIds, getPlanFromSubscription, planFromPriceId } from '@/lib/stripe/planFromPrice'

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
    const { plan, annual = false, confirmPlanChange = false } = await req.json()
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

    const appUrl = resolveCheckoutAppUrl(req)

    if (profile.stripe_customer_id) {
      await linkExistingStripeSubscriptionForClerkUser(userId, profile.stripe_customer_id)
    }

    const billingProfile = await getBillingProfileForClerkUser(supabase, userId, email)
    if (billingProfile?.stripe_subscription_id) {
      let existing: Stripe.Subscription | null = null
      try {
        existing = await stripe.subscriptions.retrieve(billingProfile.stripe_subscription_id)
      } catch {
        // Subscription no longer exists in Stripe — fall through to a fresh checkout.
      }

      if (existing && ['active', 'trialing', 'past_due'].includes(existing.status)) {
        const planPriceIds = allPlanPriceIds()
        const planItem = existing.items.data.find(item => planPriceIds.has(item.price.id))

        if (!planItem) {
          return NextResponse.json(
            { error: 'Your subscription needs manual review. Manage your plan from the billing portal.' },
            { status: 409 },
          )
        }

        if (planItem.price.id === priceId) {
          return NextResponse.json({
            url: `${appUrl}/foundation?plan=${encodeURIComponent(plan)}`,
          })
        }

        const currentPlan = getPlanFromSubscription(existing) ?? billingProfile.plan
        const direction = comparePlanTier(currentPlan, plan)

        if (existing.status === 'trialing' && direction === 'upgrade') {
          if (!isPaidPlanKey(plan)) {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
          }
          if (!confirmPlanChange) {
            return NextResponse.json(
              {
                requiresConfirmation: true,
                message: upgradeChargeMessage(plan, Boolean(annual)),
                plan,
                annual: Boolean(annual),
              },
              { status: 409 },
            )
          }
        }

        const updateParams: Stripe.SubscriptionUpdateParams = {
          items: [{ id: planItem.id, price: priceId }],
          proration_behavior: 'always_invoice',
          metadata: { ...existing.metadata, clerk_user_id: userId, plan },
        }

        if (existing.status === 'trialing' && direction === 'upgrade') {
          updateParams.trial_end = 'now'
        }

        await stripe.subscriptions.update(billingProfile.stripe_subscription_id, updateParams)

        await supabase
          .from('profiles')
          .update({ plan, status: 'active', updated_at: new Date().toISOString() })
          .eq('id', billingProfile.id)

        // Downgrade (or upgrade that changes included seats) must bill/remove
        // $15 extras so roster size cannot exceed the new plan unpaid.
        if (process.env.STRIPE_SEAT_PRICE_ID) {
          try {
            await syncExtraSeatQuantityForProfile({
              stripe,
              supabase,
              profileId: billingProfile.id,
              subscriptionId: billingProfile.stripe_subscription_id,
              plan,
            })
          } catch (err) {
            console.error('[stripe/checkout] seat sync after plan change failed:', err)
            return NextResponse.json(
              {
                error:
                  'Plan updated but team seat billing could not be synced. Contact support before inviting more members.',
              },
              { status: 500 },
            )
          }
        }

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

    const subscriptionData: Stripe.Checkout.SessionCreateParams['subscription_data'] = {
      metadata: { clerk_user_id: userId, plan },
      trial_period_days: TRIAL_DAYS,
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: userId,
      metadata: { clerk_user_id: userId, plan },
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/foundation?plan=${encodeURIComponent(plan)}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout-now?plan=${encodeURIComponent(plan)}${annual ? '&annual=true' : ''}`,
      subscription_data: subscriptionData,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout]', err)
    return NextResponse.json({ error: formatStripeCheckoutError(err) }, { status: 500 })
  }
}
