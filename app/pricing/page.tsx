'use client'

import { useState } from 'react'
import { Check, Zap, TrendingUp, Star, Plus, Minus } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

// ── FAQ data ───────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "What's a credit, and what uses them?",
    a: "Credits are the fuel for Maya's AI work. Each agent run, campaign generation, or Generate with Maya action costs credits — typically 2–25 depending on the task. Maya chat is separate and doesn't consume credits. Your credits reset on the 1st of every month. Starter gets 100, Growth gets 350, ProAgent gets 1,000.",
  },
  {
    q: "How does the 3-day free trial work?",
    a: "Starter only. Your card is collected at sign-up but not charged for 3 days. If you cancel before day 4, you pay nothing. After 3 days your card is charged and the subscription begins. Growth and ProAgent are charged immediately — no trial.",
  },
  {
    q: "Can I cancel or change plans anytime?",
    a: "Yes, always. You can upgrade, downgrade, or cancel from your billing page or through the Stripe customer portal. Cancellations take effect at the end of your current billing period — you keep full access until then.",
  },
  {
    q: "What's a service request?",
    a: "Service requests are how you engage the Agent7even team for done-for-you work — design, content production, ad strategy, and more. Starter gets 1 active request at a time, Growth gets 3, ProAgent gets unlimited. Add-on services (like photography or custom builds) are scoped separately.",
  },
  {
    q: "Do unused credits roll over?",
    a: "No — credits reset on the 1st of each month and don't roll over. If you consistently hit your limit, it's a good signal to upgrade. You can also top up with additional credit packs from the billing page.",
  },
  {
    q: "What's included in annual billing?",
    a: "Annual billing gives you 2 months free — effectively paying for 10 months and getting 12. Starter is $490/yr ($49/mo value), Growth is $890/yr ($89/mo value), ProAgent is $1,490/yr ($149/mo value). Annual plans are billed upfront and are non-refundable after 14 days.",
  },
  {
    q: "What are team seats?",
    a: "Team seats let you invite team members — a VA, social media manager, copywriter, or anyone who needs access to the platform. Starter includes 1 seat, Growth includes 3, ProAgent includes 5. Additional seats are $15/mo each on ProAgent.",
  },
  {
    q: "Is there a setup fee or contract?",
    a: "No setup fee, no contract. All plans are month-to-month unless you choose annual billing. Cancel anytime from your account settings.",
  },
]

// ── Plan data ──────────────────────────────────────────────────────────────

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    Icon: Zap,
    monthlyPrice: 49,
    annualPrice: 490,
    trial: true,
    billingNote: '3 days free — cancel anytime before being charged',
    cta: 'Start your free trial',
    popular: false,
    description: 'Everything you need to start building your brand and running your first campaigns.',
    features: [
      'Maya chat',
      'Foundation',
      'Brand Kit',
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
  {
    key: 'growth',
    name: 'Growth',
    Icon: TrendingUp,
    monthlyPrice: 89,
    annualPrice: 890,
    trial: false,
    billingNote: 'Billed immediately — cancel anytime',
    cta: 'Get started',
    popular: true,
    description: 'Unlimited campaigns, more credits, and priority support for growing businesses.',
    features: [
      'Everything in Starter',
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
  {
    key: 'proagent',
    name: 'ProAgent',
    Icon: Star,
    monthlyPrice: 149,
    annualPrice: 1490,
    trial: false,
    billingNote: 'Billed immediately — cancel anytime',
    cta: 'Get started',
    popular: false,
    description: 'Maximum credits, dedicated support, and white-glove onboarding for serious operators.',
    features: [
      'Everything in Growth',
      '1,000 credits / month',
      'Unlimited service requests',
      '5 team seats (+$15/mo per extra)',
      'Dedicated support',
      '15% add-on discount',
      'Quarterly strategy review',
      'White-glove onboarding',
      'First access to beta features',
    ],
  },
]

// ── Compare table ──────────────────────────────────────────────────────────

type CellVal = boolean | string

const COMPARE_ROWS: { feature: string; starter: CellVal; growth: CellVal; proagent: CellVal }[] = [
  { feature: 'Maya chat',               starter: true,          growth: true,          proagent: true          },
  { feature: 'Foundation',              starter: true,          growth: true,          proagent: true          },
  { feature: 'Brand Kit',               starter: true,          growth: true,          proagent: true          },
  { feature: 'Campaigns',               starter: '3 active',    growth: 'Unlimited',   proagent: 'Unlimited'   },
  { feature: 'Credits / month',         starter: '100',         growth: '350',         proagent: '1,000'       },
  { feature: 'Agents',                  starter: 'All 9',       growth: 'All 9',       proagent: 'All 9'       },
  { feature: 'Morning digest',          starter: true,          growth: true,          proagent: true          },
  { feature: 'Analytics',               starter: 'Basic',       growth: 'Full',        proagent: 'Full'        },
  { feature: 'Service requests',        starter: '1',           growth: '3',           proagent: 'Unlimited'   },
  { feature: 'Team seats',              starter: '1',           growth: '3',           proagent: '5 (+$15/mo)' },
  { feature: 'Support',                 starter: 'Email',       growth: 'Priority',    proagent: 'Dedicated'   },
  { feature: 'Add-on discount',         starter: false,         growth: '10% off',     proagent: '15% off'     },
  { feature: 'Quarterly strategy review', starter: false,       growth: false,         proagent: true          },
  { feature: 'White-glove onboarding',  starter: false,         growth: false,         proagent: true          },
  { feature: '3-day free trial',        starter: true,          growth: false,         proagent: false         },
  { feature: 'Annual billing',          starter: true,          growth: true,          proagent: true          },
]

// ── Cell renderer ──────────────────────────────────────────────────────────

function Cell({ value, highlight = false }: { value: CellVal; highlight?: boolean }) {
  if (value === true) {
    return (
      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
        highlight ? 'bg-[#c8522a]/20' : 'bg-white/10'
      }`}>
        <Check size={11} className={highlight ? 'text-[#c8522a]' : 'text-white/50'} />
      </span>
    )
  }
  if (value === false) {
    return <span className="text-white/15">—</span>
  }
  return (
    <span className={`text-sm font-medium ${highlight ? 'text-[#c8522a]' : 'text-white/60'}`}>
      {value}
    </span>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [annual,  setAnnual]  = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const { isSignedIn, isLoaded } = useUser()

  async function handleCta(planKey: string) {
    if (!isSignedIn) {
      window.location.href = `/sign-up?plan=${planKey}`
      return
    }
    setLoading(planKey)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, annual }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#f5f4f0]">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <a href="/" className="text-xs font-bold tracking-widest uppercase">
          AGENT<span className="text-[#c8522a]">7</span>EVEN
        </a>
        <div className="flex items-center gap-5">
          {isLoaded && (
            isSignedIn ? (
              <a
                href="/dashboard"
                className="text-sm font-medium bg-white/8 hover:bg-white/12 px-4 py-2 rounded-lg transition-colors"
              >
                Go to dashboard →
              </a>
            ) : (
              <>
                <a href="/sign-in" className="text-sm text-white/40 hover:text-white/70 transition-colors">
                  Sign in
                </a>
                <a
                  href="/sign-up"
                  className="text-sm font-medium bg-white/8 hover:bg-white/12 px-4 py-2 rounded-lg transition-colors"
                >
                  Sign up free
                </a>
              </>
            )
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-14 text-center">
        <p className="text-[11px] font-semibold tracking-widest uppercase text-[#c8522a] mb-4">
          Pricing
        </p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-5">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-white/40 max-w-xl mx-auto mb-10">
          One platform for your marketing dashboard, AI tools, and managed
          services. No contracts. Cancel anytime.
        </p>

        {/* Monthly / Annual toggle */}
        <div className="inline-flex items-center gap-1 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setAnnual(false)}
            className={`text-sm font-medium px-5 py-2 rounded-lg transition-all ${
              !annual ? 'bg-white text-[#0d0d0d]' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg transition-all ${
              annual ? 'bg-white text-[#0d0d0d]' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Annual
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
              annual ? 'bg-[#c8522a] text-white' : 'bg-white/10 text-white/40'
            }`}>
              2 months free
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan) => {
            const { Icon } = plan
            const isLoading = loading === plan.key
            const displayPrice = annual ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice

            return (
              <div key={plan.key} className="relative" style={{ paddingTop: plan.trial || plan.popular ? 14 : 0 }}>

                {/* Trial badge */}
                {plan.trial && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-500 text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block" />
                      3-day free trial
                    </span>
                  </div>
                )}

                {/* Most popular badge */}
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-[#f5f4f0] text-[#0d0d0d] text-[11px] font-bold px-4 py-1 rounded-full tracking-wide uppercase whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className={`rounded-2xl border flex flex-col h-full transition-all ${
                  plan.popular
                    ? 'bg-[#c8522a] border-[#c8522a]'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                }`}>
                  <div className="p-8 flex flex-col flex-1">

                    {/* Icon + name */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        plan.popular ? 'bg-white/20' : 'bg-white/6'
                      }`}>
                        <Icon size={17} className={plan.popular ? 'text-white' : 'text-white/60'} />
                      </div>
                      <h3 className={`text-lg font-semibold ${plan.popular ? 'text-white' : 'text-[#f5f4f0]'}`}>
                        {plan.name}
                      </h3>
                    </div>

                    {/* Price */}
                    <div className="mb-1">
                      <div className="flex items-end gap-1.5">
                        <span className={`text-5xl font-semibold tracking-tight leading-none ${
                          plan.popular ? 'text-white' : 'text-[#f5f4f0]'
                        }`}>
                          ${displayPrice}
                        </span>
                        <span className={`text-sm mb-1.5 ${plan.popular ? 'text-white/60' : 'text-white/30'}`}>
                          /mo
                        </span>
                      </div>
                      {annual && (
                        <p className={`text-xs mt-1.5 ${plan.popular ? 'text-white/60' : 'text-white/30'}`}>
                          ${plan.annualPrice} billed annually
                        </p>
                      )}
                      <p className={`text-xs mt-2 font-medium ${
                        plan.trial ? 'text-emerald-400' : plan.popular ? 'text-white/55' : 'text-white/25'
                      }`}>
                        {plan.billingNote}
                      </p>
                    </div>

                    {/* Description */}
                    <p className={`text-sm mt-5 mb-7 leading-relaxed ${
                      plan.popular ? 'text-white/70' : 'text-white/35'
                    }`}>
                      {plan.description}
                    </p>

                    {/* Feature list */}
                    <ul className="space-y-2.5 flex-1 mb-8">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5 ${
                            plan.popular ? 'bg-white/20' : 'bg-white/8'
                          }`}>
                            <Check size={10} className={plan.popular ? 'text-white' : 'text-white/55'} />
                          </div>
                          <span className={`text-sm leading-snug ${
                            plan.popular ? 'text-white/85' : 'text-white/50'
                          }`}>
                            {f}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      onClick={() => handleCta(plan.key)}
                      disabled={isLoading}
                      className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                        plan.trial
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                          : plan.popular
                          ? 'bg-white text-[#c8522a] hover:bg-[#f5f4f0]'
                          : 'bg-white/8 text-[#f5f4f0] hover:bg-white/12 border border-white/10'
                      }`}
                    >
                      {isLoading ? 'Redirecting…' : plan.cta}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Fine print */}
        <p className="text-center text-sm text-white/20 mt-10">
          Starter includes a 3-day free trial — card required, no charge until day 4.
          Growth and ProAgent are charged immediately.{' '}
          Questions?{' '}
          <a href="mailto:hello@agent7even.com" className="text-white/40 hover:text-white/60 underline underline-offset-2 transition-colors">
            hello@agent7even.com
          </a>
        </p>
      </div>

      {/* Compare plans */}
      <div className="max-w-6xl mx-auto px-6 pb-24 mt-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight mb-2">
          Compare plans
        </h2>
        <p className="text-center text-sm text-white/30 mb-10">
          Everything included in each tier, side by side.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left px-6 py-4 text-white/30 font-medium w-[38%]">Feature</th>
                <th className="text-center px-5 py-4 text-[#f5f4f0] font-semibold w-[20%]">Starter</th>
                <th className="text-center px-5 py-4 text-[#c8522a] font-semibold w-[20%] bg-[#c8522a]/[0.06]">Growth</th>
                <th className="text-center px-5 py-4 text-[#f5f4f0] font-semibold w-[22%]">ProAgent</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-white/[0.05] last:border-0 ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
                >
                  <td className="px-6 py-4 text-white/45">{row.feature}</td>
                  <td className="px-5 py-4 text-center">
                    <Cell value={row.starter} />
                  </td>
                  <td className="px-5 py-4 text-center bg-[#c8522a]/[0.04]">
                    <Cell value={row.growth} highlight />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <Cell value={row.proagent} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-6 pb-24">
        <h2 className="text-center text-2xl font-semibold tracking-tight mb-2">
          Frequently asked questions
        </h2>
        <p className="text-center text-sm text-white/30 mb-10">
          Everything you need to know before signing up.
        </p>

        <div className="space-y-2">
          {FAQS.map((faq, i) => {
            const isOpen = openFaq === i
            return (
              <div
                key={i}
                className={`rounded-xl border transition-colors ${
                  isOpen ? 'border-white/15 bg-white/[0.04]' : 'border-white/[0.07] bg-white/[0.02]'
                }`}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className={`text-sm font-medium leading-snug transition-colors ${
                    isOpen ? 'text-[#f5f4f0]' : 'text-white/70'
                  }`}>
                    {faq.q}
                  </span>
                  <span className="flex-shrink-0 text-white/30">
                    {isOpen
                      ? <Minus size={15} className="text-[#c8522a]" />
                      : <Plus size={15} />
                    }
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-white/45 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-sm text-white/25 mt-10">
          Still have questions?{' '}
          <a href="mailto:hello@agent7even.com" className="text-white/45 hover:text-white/70 underline underline-offset-2 transition-colors">
            hello@agent7even.com
          </a>
        </p>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex flex-col md:flex-row items-center gap-6 text-sm text-white/30">
            <span className="text-xs font-bold tracking-widest uppercase">
              AGENT<span className="text-[#c8522a]">7</span>EVEN
            </span>
            <a href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</a>
            <a href="/terms"   className="hover:text-white/60 transition-colors">Terms of Service</a>
            <a href="mailto:hello@agent7even.com" className="hover:text-white/60 transition-colors">
              hello@agent7even.com
            </a>
          </div>
          <p className="text-xs text-white/20">© {new Date().getFullYear()} Agent7even. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}
