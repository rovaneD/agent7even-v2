import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { getStripeClient } from '@/lib/stripe'
import {
  enrichRevenueCharges,
  isPlatformRevenueCharge,
  isStripeTestMode,
} from '@/lib/stripeRevenue'
import { TrendingUp, Users, DollarSign, ArrowUpRight, AlertTriangle } from 'lucide-react'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'
import { buildAdminRevenueMayaContext } from '@/lib/maya/summaries/adminContext'

const PLAN_PRICES: Record<string, number> = {
  starter: 49,
  growth: 89,
  proagent: 149,
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function planBadge(plan: string | null) {
  const map: Record<string, string> = {
    starter: 'bg-gray-100 text-gray-600',
    growth: 'bg-[#2D3748]/10 text-[#64748B]',
    proagent: 'bg-[#0d0d0d] text-white',
  }
  const key = plan ?? ''
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${map[key] ?? 'bg-gray-50 text-gray-400'}`}>
      {plan ?? 'No plan'}
    </span>
  )
}

export default async function AdminRevenuePage() {
  await requireAdmin()

  const supabase = createServiceClient()

  const { data: clients } = await supabase
    .from('profiles')
    .select('id, full_name, company_name, email, plan, status, stripe_customer_id, stripe_subscription_id, created_at')
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  const activeClients = clients?.filter(c => c.status === 'active' && c.plan) ?? []
  const pausedClients = clients?.filter(c => c.status === 'paused') ?? []

  const mrr = activeClients.reduce((sum, c) => {
    return sum + (PLAN_PRICES[c.plan ?? ''] ?? 0)
  }, 0)

  const planCounts = activeClients.reduce<Record<string, number>>((acc, c) => {
    const plan = c.plan ?? 'unknown'
    acc[plan] = (acc[plan] ?? 0) + 1
    return acc
  }, {})

  const knownCustomerIds = new Set(
    (clients ?? []).map(c => c.stripe_customer_id).filter((id): id is string => Boolean(id))
  )
  const profileByCustomerId = new Map(
    (clients ?? [])
      .filter(c => c.stripe_customer_id)
      .map(c => [c.stripe_customer_id!, {
        full_name: c.full_name,
        company_name: c.company_name,
        email: c.email,
        plan: c.plan,
      }])
  )

  let recentCharges: ReturnType<typeof enrichRevenueCharges> = []
  let excludedChargeCount = 0
  const stripeTestMode = isStripeTestMode()
  try {
    const stripe = getStripeClient()
    if (stripe) {
      const charges = await stripe.charges.list({ limit: 50 })
      const paid = charges.data.filter(c => c.paid && !c.refunded)
      excludedChargeCount = paid.filter(c => !isPlatformRevenueCharge(c, knownCustomerIds)).length
      const platformCharges = paid
        .filter(c => isPlatformRevenueCharge(c, knownCustomerIds))
        .slice(0, 20)
      recentCharges = enrichRevenueCharges(platformCharges, profileByCustomerId)
    }
  } catch (err) {
    console.error('Stripe charges fetch error:', err)
  }

  const totalFromCharges = recentCharges.reduce((sum, c) => sum + c.amount, 0)

  const statCards = [
    {
      label: 'Monthly Recurring Revenue',
      value: `$${mrr.toLocaleString()}`,
      sub: `${activeClients.length} active subscription${activeClients.length !== 1 ? 's' : ''}`,
      icon: TrendingUp,
      accent: true,
    },
    {
      label: 'Active clients',
      value: `${activeClients.length}`,
      sub: `${pausedClients.length} paused`,
      icon: Users,
      accent: false,
    },
    {
      label: 'Annual run rate',
      value: `$${(mrr * 12).toLocaleString()}`,
      sub: 'Based on current MRR',
      icon: ArrowUpRight,
      accent: false,
    },
    {
      label: 'Recent SaaS charges',
      value: formatCurrency(totalFromCharges),
      sub: `${recentCharges.length} platform payment${recentCharges.length !== 1 ? 's' : ''}`,
      icon: DollarSign,
      accent: false,
    },
  ]

  const mayaPayload = buildAdminRevenueMayaContext({
    mrr,
    activeCount: activeClients.length,
    pausedCount: pausedClients.length,
    planCounts,
    recentChargesTotal: formatCurrency(totalFromCharges),
    recentChargesCount: recentCharges.length,
    activeSubscribers: activeClients.length > 0
      ? activeClients.map(c => `${c.company_name ?? c.full_name ?? c.email} (${c.plan})`).join(', ')
      : 'No active subscribers',
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <CanvasContextDispatcher payload={mayaPayload} />

      {/* Header */}
      <div>
        <h1 className="text-[26px] font-semibold text-[#2D3748]">Revenue</h1>
        <p className="text-sm text-gray-400 mt-0.5">Subscription overview and payment history</p>
      </div>

      {(stripeTestMode || excludedChargeCount > 0) && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900">
            {stripeTestMode && (
              <p className="font-medium">Stripe test mode — figures are from sandbox charges, not live revenue.</p>
            )}
            {excludedChargeCount > 0 && (
              <p className={stripeTestMode ? 'mt-1 text-amber-800' : ''}>
                {excludedChargeCount} charge{excludedChargeCount !== 1 ? 's' : ''} hidden
                {' '}(unlinked customers, legacy $7,500 packages, or Stripe CLI tests).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`rounded-2xl border p-5 ${
              card.accent ? 'bg-[#2D3748] border-[#3B82F6]' : 'bg-white border-gray-100'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium uppercase tracking-wide ${
                  card.accent ? 'text-white/70' : 'text-gray-400'
                }`}>
                  {card.label}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  card.accent ? 'bg-white/20' : 'bg-gray-50'
                }`}>
                  <Icon size={15} className={card.accent ? 'text-white' : 'text-gray-400'} />
                </div>
              </div>
              <p className={`text-2xl font-semibold ${card.accent ? 'text-white' : 'text-gray-900'}`}>
                {card.value}
              </p>
              <p className={`text-xs mt-1 ${card.accent ? 'text-white/60' : 'text-gray-400'}`}>
                {card.sub}
              </p>
            </div>
          )
        })}
      </div>

      {/* Plan breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-5">Plan breakdown</h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {(['starter', 'growth', 'proagent'] as const).map(plan => {
            const count = planCounts[plan] ?? 0
            const revenue = count * (PLAN_PRICES[plan] ?? 0)
            const pct = activeClients.length > 0 ? Math.round((count / activeClients.length) * 100) : 0
            return (
              <div key={plan} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  {planBadge(plan)}
                  <span className="text-xs text-gray-400">{pct}%</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">{count}</p>
                <p className="text-xs text-gray-400 mt-0.5">${revenue}/mo</p>
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2D3748] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Active subscriber list */}
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Active subscribers
        </h3>
        {activeClients.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No active subscribers yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {activeClients.map(client => (
              <div key={client.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {client.company_name ?? client.full_name ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400">{client.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  {planBadge(client.plan)}
                  <span className="text-sm font-semibold text-gray-700">
                    ${PLAN_PRICES[client.plan ?? ''] ?? 0}/mo
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent charges from Stripe */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Recent SaaS charges</h2>
        <p className="text-xs text-gray-400 mb-5">
          Subscription, seat, and credit top-ups from linked platform customers only
        </p>
        {recentCharges.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No platform charges found</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentCharges.map(charge => (
              <div key={charge.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{charge.label}</p>
                  <p className="text-xs text-gray-400">
                    {charge.email ?? '—'} · {formatDate(charge.created)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {charge.plan && planBadge(charge.plan)}
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Paid
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(charge.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paused clients */}
      {pausedClients.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-5">
            Paused / payment failed ({pausedClients.length})
          </h2>
          <div className="divide-y divide-gray-50">
            {pausedClients.map(client => (
              <div key={client.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {client.company_name ?? client.full_name ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400">{client.email}</p>
                </div>
                <span className="text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                  Payment failed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
