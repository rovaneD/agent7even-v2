import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
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
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, annual = false } = await req.json()
  const stripe = getStripeClient()
  if (!stripe) return NextResponse.json({ error: 'Billing is not configured' }, { status: 500 })

  if (!PRICE_IDS[plan]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const priceId = annual ? PRICE_IDS[plan].annual : PRICE_IDS[plan].monthly

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, stripe_customer_id')
    .eq('clerk_user_id', userId)
    .single()

  let customerId = profile?.stripe_customer_id ?? undefined

  if (!customerId && profile?.email) {
    const customer = await stripe.customers.create({
      email: profile.email,
      name: profile.full_name ?? undefined,
      metadata: { clerk_user_id: userId },
    })
    customerId = customer.id

    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('clerk_user_id', userId)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'

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
    cancel_url: `${appUrl}/pricing`,
    subscription_data: subscriptionData,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
