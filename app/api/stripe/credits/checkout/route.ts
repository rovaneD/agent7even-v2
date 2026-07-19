import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { CREDIT_PACKAGES } from '@/lib/credits-packages'
import { getStripeClient } from '@/lib/stripe'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId } = await req.json()
  const stripe = getStripeClient()
  if (!stripe) return NextResponse.json({ error: 'Billing is not configured' }, { status: 500 })

  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 })

  const supabase = createServiceClient()

  // Canonical resolution — with duplicate profiles the newest row is not
  // necessarily the one carrying the Stripe/billing data.
  const profile = await resolveClerkProfile<{
    id: string
    email: string | null
    full_name: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan: string | null
    created_at: string
  }>(supabase, userId, 'id, email, full_name')
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agent7even-v2.vercel.app'

  const session = await stripe.checkout.sessions.create({
    mode:                 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: pkg.priceId, quantity: 1 }],
    customer_email: profile.email ?? undefined,
    success_url: `${appUrl}/dashboard/billing?topup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/dashboard/billing?topup=cancelled`,
    metadata: {
      user_id:    profile.id,
      package_id: pkg.id,
      credits:    pkg.credits.toString(),
    },
  })

  await supabase.from('credit_topups').insert({
    user_id:           profile.id,
    stripe_session_id: session.id,
    credits:           pkg.credits,
    amount_usd:        pkg.priceUsd,
    status:            'pending',
  })

  return NextResponse.json({ url: session.url })
}
