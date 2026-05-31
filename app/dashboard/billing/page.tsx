import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import BillingClient from './BillingClient'
import Stripe from 'stripe'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export default async function BillingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, plan, status, stripe_customer_id, stripe_subscription_id')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null

  if (profile?.id) {
    const teamPerms = await getTeamPermissions(profile.id)
    if (!hasPermission(teamPerms, 'billing')) redirect('/dashboard')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'

  let invoices: {
    id: string
    number: string | null
    amount_paid: number
    status: string | null
    created: number
    hosted_invoice_url: string | null
  }[] = []

  let portalUrl: string | null = null
  let creditBalance = 0

  if (profile?.id) {
    const { data: balRow } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', profile.id)
      .order('updated_at', { ascending: false })
      .limit(1)
    creditBalance = balRow?.[0]?.balance ?? 0
  }

  if (profile?.stripe_customer_id) {
    try {
      const [invoiceList, portalSession] = await Promise.all([
        stripe.invoices.list({ customer: profile.stripe_customer_id, limit: 10 }),
        stripe.billingPortal.sessions.create({
          customer: profile.stripe_customer_id,
          return_url: `${appUrl}/dashboard/billing`,
        }),
      ])

      invoices = invoiceList.data.map((inv) => ({
        id: inv.id,
        number: inv.number ?? null,
        amount_paid: inv.amount_paid,
        status: inv.status ?? null,
        created: inv.created,
        hosted_invoice_url: inv.hosted_invoice_url ?? null,
      }))

      portalUrl = portalSession.url
    } catch (err) {
      console.error('Stripe fetch error:', err)
    }
  }

  return (
    <BillingClient
      plan={profile?.plan ?? null}
      status={profile?.status ?? null}
      subscriptionId={profile?.stripe_subscription_id ?? null}
      invoices={invoices}
      portalUrl={portalUrl}
      creditBalance={creditBalance}
    />
  )
}
