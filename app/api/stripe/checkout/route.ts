import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { ensureProfileForClerkUser } from '@/lib/profiles/ensureProfile'
import { createServiceClient } from '@/lib/supabase/server'
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

    const user = await currentUser()
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

    let customerId = profile.stripe_customer_id ?? undefined

    if (!customerId) {
      if (!email) {
        return NextResponse.json(
          { error: 'No email on file for checkout. Add an email to your account and try again.' },
          { status: 400 },
        )
      }

      const customer = await stripe.customers.create({
        email,
        name: fullName ?? undefined,
        metadata: { clerk_user_id: userId },
      })
      customerId = customer.id

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.id)
    }

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
    const message =
      err instanceof Error && err.message ? err.message : 'Could not start checkout. Please try again.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
