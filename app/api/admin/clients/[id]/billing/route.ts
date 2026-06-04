import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe'

async function getAdminProfile(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
  return data
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminProfile(userId)
  if (!admin || !['admin', 'owner'].includes(admin.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('id', id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ invoices: [], subscription: null })
  }

  try {
    const stripe = getStripeClient()
    if (!stripe) return NextResponse.json({ invoices: [], subscription: null })

    const [invoiceList, subList] = await Promise.all([
      stripe.invoices.list({ customer: profile.stripe_customer_id, limit: 10 }),
      profile.stripe_subscription_id
        ? stripe.subscriptions.retrieve(profile.stripe_subscription_id)
        : null,
    ])

    return NextResponse.json({
      invoices: invoiceList.data.map(inv => ({
        id: inv.id,
        number: inv.number ?? null,
        amount_paid: inv.amount_paid,
        status: inv.status ?? null,
        created: inv.created,
        hosted_invoice_url: inv.hosted_invoice_url ?? null,
      })),
      subscription: subList
        ? {
            status: subList.status,
            current_period_end: (subList as any).current_period_end ?? null,
          }
        : null,
    })
  } catch (err) {
    console.error('Stripe billing fetch failed:', err)
    return NextResponse.json({ invoices: [], subscription: null })
  }
}
