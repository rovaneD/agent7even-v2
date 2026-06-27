'use client'

import { useState } from 'react'
import { Check, Zap, TrendingUp, Star, Plus, Minus } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import { trackEvent } from '@/lib/gtag'

// ── FAQ data ───────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'What does Maya actually create?',
    a: "Campaign plans, social posts, email copy, ad variations to test, on-brand images, short video, SEO and competitor reports, and performance digests — all drafted for your approval queue. Twelve specialist agents handle specific jobs; Maya coordinates them. Nothing publishes until you sign off.",
  },
  {
    q: 'Are campaigns, chat, and text agents unlimited?',
    a: "Yes. Maya chat, agent runs, and campaign generation do not consume media credits on any plan. Credits meter image and video generation only.",
  },
  {
    q: 'What are media credits?',
    a: "Media credits pay for generated images and videos. Standard images cost 3 credits, standard videos 10. Starter (100 credits) ≈ 33 images or 10 videos per month — plus unlimited text work.",
  },
  {
    q: "What's a service request?",
    a: "Human-delivered work (design, photography, ad management) you request and track in your dashboard, fulfilled by our team. Not AI — managed services. Starter gets 1 active request, Growth 3, ProAgent unlimited.",
  },
  {
    q: 'Which social platforms can I connect?',
    a: 'Instagram, Facebook, LinkedIn, Threads, and YouTube on every plan. X / Twitter connect requires Growth or ProAgent while we measure platform usage — Starter can still draft posts for any platform.',
  },
  {
    q: 'What does ProAgent unlock beyond more credits?',
    a: 'Premium image (Recraft) and premium video (Kling) models — higher-quality media on ProAgent. Standard models on every plan.',
  },
  {
    q: "How does the 3-day free trial work?",
    a: "Starter only. Your card is collected at sign-up but not charged for 3 days. If you cancel before day 4, you pay nothing. Growth and ProAgent are charged immediately — no trial.",
  },
  {
    q: "Can I cancel or change plans anytime?",
    a: "Yes, always. You can upgrade, downgrade, or cancel from your billing page or through the Stripe customer portal. Cancellations take effect at the end of your current billing period — you keep full access until then.",
  },
  {
    q: "Do unused credits roll over?",
    a: "No — media credits reset on your monthly billing date and don't roll over. If you consistently hit your limit, upgrade or top up from billing.",
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
    description: 'Unlimited text work plus media credits for images and video.',
    features: [
      'Unlimited campaigns, content, chat & agents',
      '100 media credits / month',
      'Maya + all 12 agents',
      'Foundation + Brand Kit',
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
    description: 'More media volume for businesses posting every week.',
    features: [
      'Everything in Starter',
      '350 media credits / month',
      'X / Twitter connect',
      'Full analytics',
      '3 service requests',
      '3 team seats',
      'Priority support',
      '10% add-on discount',
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
    description: 'Maximum media allowance plus premium Recraft & Kling models.',
    features: [
      'Everything in Growth',
      '1,000 media credits / month',
      'Premium image & video models',
      'Unlimited service requests',
      '5 team seats (+$15/mo per extra)',
      'Dedicated support',
      '15% add-on discount',
      'Quarterly strategy review',
    ],
  },
]

// ── Compare table ──────────────────────────────────────────────────────────

type CellVal = boolean | string

const COMPARE_ROWS: { feature: string; starter: CellVal; growth: CellVal; proagent: CellVal }[] = [
  { feature: 'Maya chat',               starter: true,          growth: true,          proagent: true          },
  { feature: 'Foundation',              starter: true,          growth: true,          proagent: true          },
  { feature: 'Brand Kit',               starter: true,          growth: true,          proagent: true          },
  { feature: 'Campaigns & content',     starter: 'Unlimited',   growth: 'Unlimited',   proagent: 'Unlimited'   },
  { feature: 'Maya chat & agents',      starter: 'Unlimited',   growth: 'Unlimited',   proagent: 'Unlimited'   },
  { feature: 'Media credits / month',   starter: '100',         growth: '350',         proagent: '1,000'       },
  { feature: 'Media allowance',         starter: '≈33 img / 10 vid', growth: '≈116 img / 35 vid', proagent: '≈333 img / 100 vid' },
  { feature: 'Premium media models',    starter: false,         growth: false,         proagent: true          },
  { feature: 'Agents',                  starter: 'All 12',      growth: 'All 12',      proagent: 'All 12'      },
  { feature: 'Morning digest',          starter: true,          growth: true,          proagent: true          },
  { feature: 'Analytics',               starter: 'Basic',       growth: 'Full',        proagent: 'Full'        },
  { feature: 'X / Twitter connect',     starter: false,         growth: true,          proagent: true          },
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
        highlight ? 'bg-[#3B82F6]/15' : 'bg-gray-100'
      }`}>
        <Check size={11} className={highlight ? 'text-[#3B82F6]' : 'text-gray-500'} />
      </span>
    )
  }
  if (value === false) {
    return <span className="text-gray-300">—</span>
  }
  return (
    <span className={`text-sm font-medium ${highlight ? 'text-[#3B82F6]' : 'text-gray-600'}`}>
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
    const billing = annual ? 'annual' : 'monthly'
    trackEvent('select_plan', { plan: planKey, billing })

    if (!isSignedIn) {
      trackEvent('sign_up_click', { location: 'pricing', plan: planKey, billing })
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
      if (data.url) {
        trackEvent('begin_checkout', { plan: planKey, billing })
        window.location.href = data.url
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <a href="/" className="flex items-center">
          <img src="/agent7even_logo.svg" alt="Agent7even" className="h-[38px] w-auto" />
        </a>
        <div className="flex items-center gap-5">
          {isLoaded && (
            isSignedIn ? (
              <a
                href="/dashboard"
                className="text-sm font-medium bg-gray-900 text-white hover:bg-black px-4 py-2 rounded-lg transition-colors"
              >
                Go to dashboard →
              </a>
            ) : (
              <>
                <a href="/sign-in" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  Sign in
                </a>
                <a
                  href="/sign-up"
                  className="text-sm font-medium bg-gray-900 text-white hover:bg-black px-4 py-2 rounded-lg transition-colors"
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
        <p className="text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-4">
          Pricing
        </p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-5">
          Choose your marketing team size
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10">
          Unlimited campaigns, content, and Maya chat on every plan. Media credits meter images and video only — so daily marketing work never stalls mid-week.
        </p>

        {/* Monthly / Annual toggle */}
        <div className="inline-flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => { setAnnual(false); trackEvent('billing_toggle', { billing: 'monthly' }) }}
            className={`text-sm font-medium px-5 py-2 rounded-lg transition-all ${
              !annual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => { setAnnual(true); trackEvent('billing_toggle', { billing: 'annual' }) }}
            className={`flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg transition-all ${
              annual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Annual
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
              annual ? 'bg-[#3B82F6] text-white' : 'bg-gray-200 text-gray-500'
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
                    <span className="bg-[#3B82F6] text-white text-[11px] font-bold px-4 py-1 rounded-full tracking-wide uppercase whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className={`rounded-2xl border flex flex-col h-full transition-all ${
                  plan.popular
                    ? 'bg-[#16181d] border-[#16181d]'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}>
                  <div className="p-8 flex flex-col flex-1">

                    {/* Icon + name */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        plan.popular ? 'bg-white/15' : 'bg-gray-100'
                      }`}>
                        <Icon size={17} className={plan.popular ? 'text-white' : 'text-gray-600'} />
                      </div>
                      <h3 className={`text-lg font-semibold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                        {plan.name}
                      </h3>
                    </div>

                    {/* Price */}
                    <div className="mb-1">
                      <div className="flex items-end gap-1.5">
                        <span className={`text-5xl font-semibold tracking-tight leading-none ${
                          plan.popular ? 'text-white' : 'text-gray-900'
                        }`}>
                          ${displayPrice}
                        </span>
                        <span className={`text-sm mb-1.5 ${plan.popular ? 'text-white/60' : 'text-gray-400'}`}>
                          /mo
                        </span>
                      </div>
                      {annual && (
                        <p className={`text-xs mt-1.5 ${plan.popular ? 'text-white/60' : 'text-gray-400'}`}>
                          ${plan.annualPrice} billed annually
                        </p>
                      )}
                      <p className={`text-xs mt-2 font-medium ${
                        plan.trial ? 'text-emerald-600' : plan.popular ? 'text-white/55' : 'text-gray-400'
                      }`}>
                        {plan.billingNote}
                      </p>
                    </div>

                    {/* Description */}
                    <p className={`text-sm mt-5 mb-7 leading-relaxed ${
                      plan.popular ? 'text-white/70' : 'text-gray-500'
                    }`}>
                      {plan.description}
                    </p>

                    {/* Feature list */}
                    <ul className="space-y-2.5 flex-1 mb-8">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5 ${
                            plan.popular ? 'bg-white/15' : 'bg-gray-100'
                          }`}>
                            <Check size={10} className={plan.popular ? 'text-white' : 'text-gray-500'} />
                          </div>
                          <span className={`text-sm leading-snug ${
                            plan.popular ? 'text-white/85' : 'text-gray-600'
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
                          ? 'bg-[#3B82F6] text-white hover:bg-[#2563EB]'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200'
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
        <p className="text-center text-sm text-gray-400 mt-10">
          Starter includes a 3-day free trial — card required, no charge until day 4.
          Growth and ProAgent are charged immediately.{' '}
          Questions?{' '}
          <a href="mailto:billing@agent7even.ai" className="text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors">
            billing@agent7even.ai
          </a>
        </p>
      </div>

      {/* Compare plans */}
      <div className="max-w-6xl mx-auto px-6 pb-24 mt-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight mb-2">
          Compare plans
        </h2>
        <p className="text-center text-sm text-gray-400 mb-10">
          Everything included in each tier, side by side.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-6 py-4 text-gray-400 font-medium w-[38%]">Feature</th>
                <th className="text-center px-5 py-4 text-gray-900 font-semibold w-[20%]">Starter</th>
                <th className="text-center px-5 py-4 text-[#3B82F6] font-semibold w-[20%] bg-[#3B82F6]/[0.05]">Growth</th>
                <th className="text-center px-5 py-4 text-gray-900 font-semibold w-[22%]">ProAgent</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-gray-50/50' : ''}`}
                >
                  <td className="px-6 py-4 text-gray-600">{row.feature}</td>
                  <td className="px-5 py-4 text-center">
                    <Cell value={row.starter} />
                  </td>
                  <td className="px-5 py-4 text-center bg-[#3B82F6]/[0.03]">
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
        <p className="text-center text-sm text-gray-400 mb-10">
          Everything you need to know before signing up.
        </p>

        <div className="space-y-2">
          {FAQS.map((faq, i) => {
            const isOpen = openFaq === i
            return (
              <div
                key={i}
                className={`rounded-xl border transition-colors ${
                  isOpen ? 'border-gray-300 bg-gray-50/60' : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  onClick={() => {
                    if (!isOpen) trackEvent('faq_open', { question: faq.q, location: 'pricing' })
                    setOpenFaq(isOpen ? null : i)
                  }}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className={`text-sm font-medium leading-snug transition-colors ${
                    isOpen ? 'text-gray-900' : 'text-gray-700'
                  }`}>
                    {faq.q}
                  </span>
                  <span className="flex-shrink-0 text-gray-400">
                    {isOpen
                      ? <Minus size={15} className="text-[#3B82F6]" />
                      : <Plus size={15} />
                    }
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-sm text-gray-400 mt-10">
          Still have questions?{' '}
          <a href="mailto:support@agent7even.ai" className="text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors">
            support@agent7even.ai
          </a>
        </p>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex flex-col md:flex-row items-center gap-6 text-sm text-gray-400">
            <a href="/" className="flex items-center">
              <img src="/agent7even_logo.svg" alt="Agent7even" className="h-[30px] w-auto" />
            </a>
            <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
            <a href="/terms"   className="hover:text-gray-600 transition-colors">Terms of Service</a>
            <a href="mailto:support@agent7even.ai" className="hover:text-gray-600 transition-colors">
              support@agent7even.ai
            </a>
          </div>
          <p className="text-xs text-gray-300">© {new Date().getFullYear()} Agent7even. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}
