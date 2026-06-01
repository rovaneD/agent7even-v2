import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import BillingClient from './BillingClient'
import Stripe from 'stripe'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import type { CreditsUsageData, BreakdownItem } from '@/components/billing/CreditsUsage'

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
  let creditsUsage: CreditsUsageData | null = null

  const PLAN_ALLOCATION: Record<string, number> = {
    starter: 100, growth: 350, proagent: 1000,
  }

  if (profile?.id) {
    const { data: balRow } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', profile.id)
      .order('updated_at', { ascending: false })
      .limit(1)
    creditBalance = balRow?.[0]?.balance ?? 0

    // ── Credits usage data ──────────────────────────────────────────────────
    // Find the most recent allocation entry to anchor "this month"
    const { data: allocRows } = await supabase
      .from('credit_ledger')
      .select('credits, created_at')
      .eq('user_id', profile.id)
      .eq('type', 'allocation')
      .order('created_at', { ascending: false })
      .limit(1)

    const lastAlloc = allocRows?.[0]
    const monthlyAllocation = lastAlloc?.credits
      ?? (profile.plan ? (PLAN_ALLOCATION[profile.plan] ?? 0) : 0)

    // Use start of current month as fallback if no allocation entry yet
    const now = new Date()
    const periodStart = lastAlloc?.created_at
      ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

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

    // Debits since last allocation
    const { data: debitRows } = await supabase
      .from('credit_ledger')
      .select('credits, description')
      .eq('user_id', profile.id)
      .eq('type', 'debit')
      .gte('created_at', periodStart)

    const debits = debitRows ?? []
    const monthlyUsed = debits.reduce((s, r) => s + Math.abs(r.credits ?? 0), 0)

    // Categorise debits
    function categorise(desc: string | null): string {
      if (!desc) return 'Agent runs'
      if (desc.startsWith('Maya chat')) return 'Maya chat'
      if (desc.startsWith('Campaign generation')) return 'Campaign generation'
      if (desc.startsWith('Brand Kit')) return 'Brand Kit'
      return 'Agent runs'
    }

    const COLORS: Record<string, string> = {
      'Maya chat':            '#3B82F6',
      'Campaign generation':  '#8B5CF6',
      'Brand Kit':            '#10B981',
      'Agent runs':           '#F59E0B',
    }

    const grouped: Record<string, number> = {}
    for (const row of debits) {
      const cat = categorise(row.description ?? null)
      grouped[cat] = (grouped[cat] ?? 0) + Math.abs(row.credits ?? 0)
    }

    const breakdown: BreakdownItem[] = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([label, credits]) => ({ label, credits, color: COLORS[label] ?? '#64748B' }))

    const monthlyRemaining = Math.max(0, monthlyAllocation - monthlyUsed)
    const topupBalance = creditBalance - monthlyRemaining

    creditsUsage = {
      monthlyAllocation,
      monthlyUsed,
      monthlyRemaining,
      topupBalance:   Math.max(0, topupBalance),
      totalAvailable: creditBalance,
      resetDate,
      breakdown,
    }
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
      creditsUsage={creditsUsage}
    />
  )
}
