import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { allocatePlanCredits } from '@/lib/credits'
import { isPaidPlan, type PaidPlan } from '@/lib/plans'
import { getStripeClient } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'

async function getAdminProfile(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
  return data
}

function getPlanFromPriceId(priceId: string): PaidPlan | null {
  const map: Record<string, PaidPlan> = {
    [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID!]: 'starter',
    [process.env.STRIPE_STARTER_ANNUAL_PRICE_ID!]: 'starter',
    [process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID!]: 'growth',
    [process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID!]: 'growth',
    [process.env.STRIPE_PROAGENT_MONTHLY_PRICE_ID!]: 'proagent',
    [process.env.STRIPE_PROAGENT_ANNUAL_PRICE_ID!]: 'proagent',
  }
  return map[priceId] ?? null
}

async function getStripeBackedProfileState(subscriptionId: string | null) {
  if (!subscriptionId) return null
  const stripe = getStripeClient()
  if (!stripe) return null

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const plan = getPlanFromPriceId(subscription.items.data[0]?.price.id)
    if (!plan) return null

    if (subscription.status === 'active' || subscription.status === 'trialing') {
      return { plan, status: 'active' }
    }

    if (
      subscription.status === 'past_due' ||
      subscription.status === 'paused' ||
      subscription.status === 'unpaid'
    ) {
      return { plan, status: 'paused' }
    }
  } catch (err) {
    console.warn('[admin/comp-access] could not restore Stripe state:', err)
  }

  return null
}

type Body = {
  action: 'grant' | 'revoke'
  tier?: PaidPlan
  allocateCredits?: boolean
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminProfile(userId)
  if (!admin || !['admin', 'owner'].includes(admin.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json()) as Body
  const supabase = createServiceClient()

  if (body.action === 'grant') {
    const tier = body.tier ?? 'proagent'
    if (!isPaidPlan(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        billing_exempt: true,
        plan: tier,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, plan, status, billing_exempt')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let creditsGranted: number | null = null
    if (body.allocateCredits !== false) {
      creditsGranted = await allocatePlanCredits(id, tier, {
        description: `Complimentary access — ${tier} plan`,
        preserveExistingBalance: true,
      })
    }

    return NextResponse.json({ profile, creditsGranted })
  }

  if (body.action === 'revoke') {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', id)
      .single()

    const stripeState = await getStripeBackedProfileState(existingProfile?.stripe_subscription_id ?? null)
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        billing_exempt: false,
        plan: stripeState?.plan ?? null,
        status: stripeState?.status ?? 'onboarding',
        stripe_subscription_id: stripeState ? existingProfile?.stripe_subscription_id ?? null : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, plan, status, billing_exempt')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ profile })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
