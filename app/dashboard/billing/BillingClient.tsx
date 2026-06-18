'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildBillingMayaContext } from '@/lib/maya/summaries/workspaceContext'
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
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [billingAnnual, setBillingAnnual] = useState(false)

  const currentPlan = plan ? PLANS[plan as keyof typeof PLANS] : null
  const upgradeTo = plan ? (UPGRADE_PATHS[plan] ?? []) : ['starter', 'growth', 'proagent']
  const PlanIcon = currentPlan?.icon ?? Zap

  const mayaContext = useMemo(
    () =>
      buildBillingMayaContext({
        currentPlan,
        status,
        subscriptionId,
        invoices,
        formatAmount: (cents) => formatAmount(cents ?? 0),
        formatDate: (unix) => formatDate(unix ?? 0),
      }),
    [currentPlan, status, subscriptionId, invoices],
  )
  useMayaContext(mayaContext)

  async function handleUpgrade(targetPlan: string) {
    setUpgradeLoading(targetPlan)
    setUpgradeError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetPlan, annual: billingAnnual }),
      })

      let data: { url?: string; error?: string } = {}
      try {
        data = await res.json()
      } catch {
        setUpgradeError('Unexpected server response. Please try again.')
        return
      }

      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }

      setUpgradeError(data.error ?? 'Could not start checkout. Please try again.')
    } catch {
      setUpgradeError('Could not reach the server. Please check your connection and try again.')
    } finally {
      setUpgradeLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-8 sm:px-8">

      <div className="rounded-2xl border border-gray-100 bg-white p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Billing</p>
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-text">Plan and credits</h1>
            <p className="mt-2 text-sm text-text-sec">Manage your subscription, credit balance, and invoices.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">Current plan</p>
              <p className="mt-1 text-lg font-semibold text-text">{currentPlan?.name ?? 'No plan'}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">Credits</p>
              <p className="mt-1 text-lg font-semibold text-brand-primary">{creditBalance}</p>
            </div>
          </div>
        </div>
      </div>

      {topupStatus === 'success' && (
        <div className="flex items-start gap-3 bg-status-success/10 border border-status-success/20 rounded-2xl px-4 py-3">
          <CheckCircle2 size={15} className="text-status-success mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-status-success">Credits added successfully</p>
            <p className="text-xs text-status-success mt-0.5">Your new credits are available immediately.</p>
          </div>
        </div>
      )}

      {topupStatus === 'cancelled' && (
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
          <p className="text-sm text-text-sec">Purchase cancelled. No charge was made.</p>
        </div>
      )}

      {status === 'paused' && (
        <div className="flex items-start gap-3 bg-status-danger/10 border border-status-danger/20 rounded-2xl px-4 py-3">
          <AlertCircle size={15} className="text-status-danger mt-0.5 flex-shrink-0" />
          <p className="text-sm text-status-danger">
            <span className="font-semibold">Payment failed.</span>{' '}
            Your account is paused. Please update your payment method to restore access.
            {portalUrl && (
              <a href={portalUrl} className="ml-2 underline font-medium">Update now →</a>
            )}
          </p>
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-text-soft uppercase tracking-wide mb-2">Current plan</p>
            {currentPlan ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                  <PlanIcon size={17} className="text-brand-primary" />
                </div>
                <div>
                  <h2 className="text-[17px] font-semibold text-text">{currentPlan.name}</h2>
                  <p className="text-sm text-text-sec">${currentPlan.monthlyPrice}/mo</p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-[17px] font-semibold text-text">No active plan</h2>
                <p className="text-sm text-text-sec">Choose a plan to unlock the full platform</p>
              </div>
            )}
          </div>

          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            status === 'active'
              ? 'bg-status-success/10 text-status-success'
              : status === 'paused'
              ? 'bg-status-danger/10 text-status-danger'
              : 'bg-surface-muted text-text-sec'
          }`}>
            {status === 'active' ? 'Active' : status === 'paused' ? 'Payment failed' : 'Inactive'}
          </span>
        </div>

        {currentPlan && (
          <div className="mb-6">
            <p className="text-xs text-text-sec mb-3">{currentPlan.highlight}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {currentPlan.features.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check size={9} className="text-brand-primary" />
                  </div>
                  <span className="text-sm text-text-sec">{f}</span>
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
            className="inline-flex items-center gap-2 text-[15px] font-medium text-text hover:text-brand-primary bg-surface-muted hover:bg-bg-soft border border-border hover:border-brand-primary/30 px-4 py-2.5 rounded-xl transition-colors"
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
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[17px] font-semibold text-text">
                {currentPlan ? 'Upgrade your plan' : 'Choose a plan'}
              </h3>
              <p className="text-sm text-text-sec mt-0.5">
                {currentPlan ? 'Unlock more features and capacity' : 'Get started with Agent7even'}
              </p>
            </div>

            <div className="flex items-center gap-2 bg-surface-muted rounded-xl p-1">
              <button
                onClick={() => setBillingAnnual(false)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                  !billingAnnual ? 'bg-surface text-text shadow-sm' : 'text-text-soft'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingAnnual(true)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                  billingAnnual ? 'bg-surface text-text shadow-sm' : 'text-text-soft'
                }`}
              >
                Annual <span className="text-brand-primary font-semibold">−2mo</span>
              </button>
            </div>
          </div>

          {upgradeError && (
            <div className="flex items-start gap-2 mb-4 rounded-xl border border-status-danger/20 bg-status-danger/5 px-4 py-3">
              <AlertCircle size={14} className="text-status-danger mt-0.5 flex-shrink-0" />
              <p className="text-sm text-status-danger">{upgradeError}</p>
            </div>
          )}

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
                  className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 transition-all hover:border-brand-primary/30"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={15} className="text-brand-primary" />
                    <span className="text-sm font-semibold text-text">{p.name}</span>
                    {p.trial && (
                      <span className="ml-auto text-[10px] font-semibold text-status-success bg-status-success/10 px-2 py-0.5 rounded-full">
                        3-day trial
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <p className="text-2xl font-semibold text-text mb-0.5">
                    ${price}<span className="text-sm font-normal text-text-soft">/mo</span>
                  </p>
                  {billingAnnual ? (
                    <p className="text-xs text-text-soft mb-3">${p.annualPrice}/yr. Two months free.</p>
                  ) : (
                    <div className="mb-3" />
                  )}

                  {/* Feature highlight line */}
                  <p className="text-[11px] font-semibold text-text-soft uppercase tracking-wide mb-2">{p.highlight}</p>

                  {/* Feature list */}
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <div className="w-3.5 h-3.5 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check size={8} className="text-brand-primary" />
                        </div>
                        <span className="text-xs text-text-sec leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleUpgrade(planKey)}
                    disabled={upgradeLoading === planKey}
                    className="w-full py-2.5 rounded-xl text-[15px] font-semibold bg-brand-primary text-white hover:bg-[#2563EB] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <h3 className="text-[17px] font-semibold text-text mb-5">Invoice history</h3>
          <div className="divide-y divide-border">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-text">{inv.number ?? 'Invoice'}</p>
                  <p className="text-xs text-text-soft">{formatDate(inv.created)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-text">
                    {formatAmount(inv.amount_paid)}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    inv.status === 'paid'
                      ? 'bg-status-success/10 text-status-success'
                      : 'bg-surface-muted text-text-sec'
                  }`}>
                    {inv.status ?? 'unknown'}
                  </span>
                  {inv.hosted_invoice_url && (
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-soft hover:text-brand-primary transition-colors"
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
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <h3 className="text-[17px] font-semibold text-text mb-2">Invoice history</h3>
          <p className="text-sm text-text-sec">No invoices yet. They&#39;ll appear here after your first billing cycle.</p>
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
