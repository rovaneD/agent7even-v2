import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import BillingClient from './BillingClient'
import { getStripeClient } from '@/lib/stripe'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import type { CreditsUsageData, BreakdownItem, CreditActivityItem } from '@/components/billing/CreditsUsage'
import { PLAN_CREDITS } from '@/lib/credits'
import { getBillingProfileForClerkUser } from '@/lib/profiles/getBillingProfile'

export default async function BillingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const profile = await getBillingProfileForClerkUser(supabase, userId, email)

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
  let creditsUsage: CreditsUsageData | null = null

  if (profile?.id) {
    const { data: balRow } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', profile.id)
      .order('updated_at', { ascending: false })
      .limit(1)
    creditBalance = balRow?.[0]?.balance ?? 0

    // ── Credits usage data ──────────────────────────────────────────────────
    // Most recent allocation sets the monthly credit pool size
    const { data: allocRows } = await supabase
      .from('credit_ledger')
      .select('credits, created_at')
      .eq('user_id', profile.id)
      .eq('type', 'allocation')
      .order('created_at', { ascending: false })
      .limit(1)

    const lastAlloc = allocRows?.[0]
    const monthlyAllocation = lastAlloc?.credits
      ?? (profile.plan ? (PLAN_CREDITS[profile.plan] ?? 0) : 0)

    // Usage always counts from calendar month start — not allocation timestamp
    // (mid-month backfills/activations must not hide earlier usage this month)
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // Reset date = 1st of next month
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const resetDate = nextReset.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    // Topups since last allocation
    const { data: topupRows } = await supabase
      .from('credit_ledger')
      .select('credits')
      .eq('user_id', profile.id)
      .eq('type', 'topup')
      .gte('created_at', periodStart)

    const topupSinceAlloc = (topupRows ?? []).reduce((s, r) => s + (r.credits ?? 0), 0)

    // Debits/usage since last allocation (ledger uses type "usage"; legacy rows may use "debit")
    const { data: debitRows } = await supabase
      .from('credit_ledger')
      .select('credits, description, type, created_at')
      .eq('user_id', profile.id)
      .in('type', ['usage', 'debit'])
      .gte('created_at', periodStart)

    const debits = debitRows ?? []
    const grossDebits = debits.reduce((s, r) => s + Math.abs(r.credits ?? 0), 0)

    const { data: refundRows } = await supabase
      .from('credit_ledger')
      .select('credits')
      .eq('user_id', profile.id)
      .eq('type', 'refund')
      .gte('created_at', periodStart)

    const refundTotal = (refundRows ?? []).reduce((s, r) => s + (r.credits ?? 0), 0)
    const monthlyUsed = Math.max(0, grossDebits - refundTotal)

    // Categorise debits
    function categorise(desc: string | null): string {
      if (!desc) return 'Agent runs'
      if (desc.startsWith('Maya chat')) return 'Maya chat'
      if (desc.startsWith('Campaign generation')) return 'Campaign generation'
      if (desc.startsWith('Brand Kit')) return 'Brand Kit'
      if (desc.startsWith('agent_run')) return 'Agent runs'
      if (desc.includes('publish')) return 'Publishing'
      return 'Agent runs'
    }

    const COLORS: Record<string, string> = {
      'Maya chat':            '#3B82F6',
      'Campaign generation':  '#F5349B',
      'Brand Kit':            '#10B981',
      'Agent runs':           '#FCA509',
    }

    const grouped: Record<string, number> = {}
    for (const row of debits) {
      const cat = categorise(row.description ?? null)
      grouped[cat] = (grouped[cat] ?? 0) + Math.abs(row.credits ?? 0)
    }

    const breakdown: BreakdownItem[] = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([label, credits]) => ({ label, credits, color: COLORS[label] ?? '#9BA1AE' }))

    const monthlyRemaining = Math.max(0, monthlyAllocation - monthlyUsed)
    const planSpendable = Math.min(monthlyRemaining, creditBalance)
    const topupBalance = Math.max(0, creditBalance - planSpendable)

    const { data: activityRows } = await supabase
      .from('credit_ledger')
      .select('credits, description, type, created_at')
      .eq('user_id', profile.id)
      .in('type', ['usage', 'debit', 'refund', 'topup', 'allocation'])
      .order('created_at', { ascending: false })
      .limit(12)

    const recentActivity: CreditActivityItem[] = (activityRows ?? []).map(row => ({
      description: row.description ?? row.type ?? 'Credit change',
      credits: row.credits ?? 0,
      type: row.type ?? 'usage',
      createdAt: row.created_at ?? new Date().toISOString(),
    }))

    creditsUsage = {
      monthlyAllocation,
      monthlyUsed,
      monthlyRemaining,
      planSpendable,
      topupBalance:   Math.max(0, topupBalance),
      totalAvailable: creditBalance,
      resetDate,
      breakdown,
      recentActivity,
    }
  }

  if (profile?.stripe_customer_id && !profile.billing_exempt) {
    try {
      const stripe = getStripeClient()
      if (!stripe) throw new Error('Missing STRIPE_SECRET_KEY')

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
      billingExempt={profile?.billing_exempt ?? false}
      subscriptionId={profile?.stripe_subscription_id ?? null}
      invoices={invoices}
      portalUrl={portalUrl}
      creditBalance={creditBalance}
      creditsUsage={creditsUsage}
    />
  )
}
