import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia' as any,
})

export async function POST(req: Request) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // ── Subscription lifecycle ─────────────────────────────────────────────────

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const clerkUserId  = subscription.metadata?.clerk_user_id
    const plan         = subscription.metadata?.plan

    if (clerkUserId && plan) {
      await supabase
        .from('profiles')
        .update({
          plan,
          status:                  subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : 'paused',
          stripe_subscription_id:  subscription.id,
        })
        .eq('clerk_user_id', clerkUserId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const clerkUserId  = subscription.metadata?.clerk_user_id
    if (clerkUserId) {
      await supabase
        .from('profiles')
        .update({ status: 'inactive', plan: null })
        .eq('clerk_user_id', clerkUserId)
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice   = event.data.object as Stripe.Invoice
    const customerId = invoice.customer as string
    if (customerId) {
      await supabase
        .from('profiles')
        .update({ status: 'paused' })
        .eq('stripe_customer_id', customerId)
    }
  }

  // ── Credit top-up ──────────────────────────────────────────────────────────

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.metadata?.credits && session.metadata?.user_id) {
      const credits = parseInt(session.metadata.credits, 10)
      const userId  = session.metadata.user_id
      const now     = new Date().toISOString()

      // 1. Mark topup row completed
      await supabase
        .from('credit_topups')
        .update({
          status:            'completed',
          stripe_payment_id: session.payment_intent as string ?? null,
          completed_at:      now,
        })
        .eq('stripe_session_id', session.id)

      // 2. Add credits to balance
      const { data: current } = await supabase
        .from('credit_balances')
        .select('balance')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)

      const prevBalance = current?.[0]?.balance ?? 0
      const newBalance  = prevBalance + credits

      await supabase
        .from('credit_balances')
        .upsert({ user_id: userId, balance: newBalance, updated_at: now })

      // 3. Log to credit ledger
      await supabase.from('credit_ledger').insert({
        user_id:       userId,
        type:          'topup',
        credits,
        balance_after: newBalance,
        description:   `Credit top-up — ${credits} credits ($${(session.amount_total ?? 0) / 100})`,
      })

      // 4. In-app notification
      await supabase.from('notifications').insert({
        user_id: userId,
        type:    'credit_topup',
        title:   `${credits} credits added`,
        body:    `Your credit top-up is complete. You now have ${newBalance} credits available.`,
        read:    false,
        link:    '/dashboard/billing',
      })
    }
  }

  return NextResponse.json({ received: true })
}
