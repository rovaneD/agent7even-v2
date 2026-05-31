import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { CREDIT_PACKAGES } from '@/lib/credits-packages'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia' as any,
})

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId } = await req.json()
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null
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
