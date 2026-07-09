import { auth } from '@clerk/nextjs/server'
import { getClerkUserSafe } from '@/lib/clerk/sessionUser'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { ensureProfileForClerkUser } from '@/lib/profiles/ensureProfile'
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

    let { data: profileRows } = await supabase
      .from('profiles')
      .select('id, email, full_name, stripe_customer_id')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!profileRows?.[0]) {
      await ensureProfileForClerkUser(supabase, userId, user)
      ;({ data: profileRows } = await supabase
        .from('profiles')
        .select('id, email, full_name, stripe_customer_id')
        .eq('clerk_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1))
    }

    const profile = profileRows?.[0] ?? null
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

    const customerId = await resolveStripeCustomer(stripe, {
      profileId: profile.id,
      storedCustomerId: profile.stripe_customer_id,
      email,
      fullName,
      clerkUserId: userId,
      supabase,
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.agent7even.ai'

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
