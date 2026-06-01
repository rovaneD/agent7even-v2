'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, ExternalLink, Zap, TrendingUp, Star, AlertCircle, CheckCircle2 } from 'lucide-react'
import CreditTopUp from '@/components/billing/CreditTopUp'
import CreditsUsage from '@/components/billing/CreditsUsage'
import type { CreditsUsageData } from '@/components/billing/CreditsUsage'

interface Invoice {
  id: string
  number: string | null
  amount_paid: number
  created: number
  hosted_invoice_url: string | null
  status: string | null
}

interface Props {
  plan: string | null
  status: string | null
  subscriptionId: string | null
  invoices: Invoice[]
  portalUrl?: string | null
  creditBalance?: number
  creditsUsage?: CreditsUsageData | null
}

const PLANS = {
  starter: {
    name: 'Starter',
    icon: Zap,
    monthlyPrice: 49,
    annualPrice: 490,
    trial: true,
    highlight: 'Maya chat · Foundation · Brand Kit',
    features: [
      '3 active campaigns',
      '100 credits / month',
      'All 9 agents',
      'Morning digest',
      'Basic analytics',
      '1 service request',
      '1 team seat',
      'Email support',
    ],
  },
  growth: {
    name: 'Growth',
    icon: TrendingUp,
    monthlyPrice: 89,
    annualPrice: 890,
    trial: false,
    highlight: 'Everything in Starter, plus:',
    features: [
      'Unlimited campaigns',
      '350 credits / month',
      'Full analytics',
      '3 service requests',
      '3 team seats',
      'Priority support',
      '10% add-on discount',
      'Early access to new features',
    ],
  },
  proagent: {
    name: 'ProAgent',
    icon: Star,
    monthlyPrice: 149,
    annualPrice: 1490,
    trial: false,
    highlight: 'Everything in Growth, plus:',
    features: [
      '1,000 credits / month',
      'Unlimited service requests',
      '5 team seats (+$15/mo extra)',
      'Dedicated support',
      '15% add-on discount',
      'Quarterly strategy review',
      'White-glove onboarding',
      'First access to beta features',
    ],
  },
}

const UPGRADE_PATHS: Record<string, string[]> = {
  starter: ['growth', 'proagent'],
  growth: ['proagent'],
  proagent: [],
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatAmount(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function BillingInner({ plan, status, subscriptionId, invoices, portalUrl, creditBalance = 0, creditsUsage }: Props) {
  const searchParams   = useSearchParams()
  const topupStatus    = searchParams.get('topup')
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null)
  const [billingAnnual, setBillingAnnual] = useState(false)

  const currentPlan = plan ? PLANS[plan as keyof typeof PLANS] : null
  const upgradeTo = plan ? (UPGRADE_PATHS[plan] ?? []) : ['starter', 'growth', 'proagent']
  const PlanIcon = currentPlan?.icon ?? Zap

  useEffect(() => {
    const invoiceLines = invoices.slice(0, 5).map(inv =>
      `- ${inv.number ?? 'Invoice'}: ${formatAmount(inv.amount_paid)} (${inv.status ?? 'unknown'}) — ${formatDate(inv.created)}`
    ).join('\n')
    const context = `BILLING PAGE
Current plan: ${currentPlan ? `${currentPlan.name} ($${currentPlan.monthlyPrice}/mo)` : 'No active plan'}
Subscription status: ${status ?? 'none'}
Subscription ID: ${subscriptionId ?? 'none'}
Recent invoices (${invoices.length} total):
${invoiceLines || '- No invoices yet'}
The user can view their current plan, upgrade to a higher tier, and access the Stripe billing portal.`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpgrade(targetPlan: string) {
    setUpgradeLoading(targetPlan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetPlan, annual: billingAnnual }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Upgrade error:', err)
    } finally {
      setUpgradeLoading(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your plan and payment history</p>
      </div>

      {topupStatus === 'success' && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Credits added successfully</p>
            <p className="text-xs text-emerald-600 mt-0.5">Your new credits are available immediately.</p>
          </div>
        </div>
      )}

      {topupStatus === 'cancelled' && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
          <p className="text-sm text-gray-500">Purchase cancelled — no charge was made.</p>
        </div>
      )}

      {status === 'paused' && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">Payment failed.</span>{' '}
            Your account is paused. Please update your payment method to restore access.
            {portalUrl && (
              <a href={portalUrl} className="ml-2 underline font-medium">Update now →</a>
            )}
          </p>
        </div>
      )}

      {/* Current plan */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Current plan</p>
            {currentPlan ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2D3748]/10 flex items-center justify-center">
                  <PlanIcon size={17} className="text-[#3B82F6]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{currentPlan.name}</h2>
                  <p className="text-sm text-gray-400">${currentPlan.monthlyPrice}/mo</p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-semibold text-gray-900">No active plan</h2>
                <p className="text-sm text-gray-400">Choose a plan to unlock the full platform</p>
              </div>
            )}
          </div>

          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            status === 'active'
              ? 'bg-emerald-50 text-emerald-700'
              : status === 'paused'
              ? 'bg-red-50 text-red-600'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {status === 'active' ? 'Active' : status === 'paused' ? 'Payment failed' : 'Inactive'}
          </span>
        </div>

        {currentPlan && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 mb-3">{currentPlan.highlight}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {currentPlan.features.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#2D3748]/10 flex items-center justify-center flex-shrink-0">
                    <Check size={9} className="text-[#3B82F6]" />
                  </div>
                  <span className="text-sm text-gray-600">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {subscriptionId && portalUrl && (
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-4 py-2.5 rounded-xl transition-colors"
          >
            Manage billing &amp; invoices
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Credits & Usage */}
      {creditsUsage && <CreditsUsage data={creditsUsage} />}

      {/* Credit top-up */}
      <CreditTopUp currentBalance={creditBalance} />

      {/* Upgrade section */}
      {upgradeTo.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {currentPlan ? 'Upgrade your plan' : 'Choose a plan'}
              </h3>
              <p className="text-sm text-gray-400 mt-0.5">
                {currentPlan ? 'Unlock more features and capacity' : 'Get started with Agent7even'}
              </p>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
              <button
                onClick={() => setBillingAnnual(false)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                  !billingAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingAnnual(true)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                  billingAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                }`}
              >
                Annual <span className="text-[#3B82F6] font-semibold">−2mo</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {upgradeTo.map((planKey) => {
              const p = PLANS[planKey as keyof typeof PLANS]
              if (!p) return null
              const Icon = p.icon
              const price = billingAnnual
                ? Math.round((p.monthlyPrice * 10) / 12)
                : p.monthlyPrice

              return (
                <div
                  key={planKey}
                  className="border border-gray-100 rounded-xl p-5 hover:border-[#3B82F6]/30 transition-colors flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={15} className="text-[#3B82F6]" />
                    <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                    {p.trial && (
                      <span className="ml-auto text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        3-day trial
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <p className="text-2xl font-semibold text-gray-900 mb-0.5">
                    ${price}<span className="text-sm font-normal text-gray-400">/mo</span>
                  </p>
                  {billingAnnual ? (
                    <p className="text-xs text-gray-400 mb-3">${p.annualPrice}/yr — 2 months free</p>
                  ) : (
                    <div className="mb-3" />
                  )}

                  {/* Feature highlight line */}
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">{p.highlight}</p>

                  {/* Feature list */}
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#2D3748]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check size={8} className="text-[#3B82F6]" />
                        </div>
                        <span className="text-xs text-gray-500 leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleUpgrade(planKey)}
                    disabled={upgradeLoading === planKey}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#2D3748] text-white hover:bg-[#1a2535] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {upgradeLoading === planKey ? 'Redirecting…' : `Upgrade to ${p.name}`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Invoice history */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-5">Invoice history</h3>
          <div className="divide-y divide-gray-50">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{inv.number ?? 'Invoice'}</p>
                  <p className="text-xs text-gray-400">{formatDate(inv.created)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-900">
                    {formatAmount(inv.amount_paid)}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    inv.status === 'paid'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {inv.status ?? 'unknown'}
                  </span>
                  {inv.hosted_invoice_url && (
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {invoices.length === 0 && currentPlan && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Invoice history</h3>
          <p className="text-sm text-gray-400">No invoices yet — they&#39;ll appear here after your first billing cycle.</p>
        </div>
      )}

    </div>
  )
}

export default function BillingClient(props: Props) {
  return (
    <Suspense>
      <BillingInner {...props} />
    </Suspense>
  )
}
