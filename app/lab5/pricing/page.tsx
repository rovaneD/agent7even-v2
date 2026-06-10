'use client'

import { useEffect, useState } from 'react'
import { Metaballs } from '@paper-design/shaders-react'
import MarketingNav from '../MarketingNav'

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l4.5 4.5L19 7" />
    </svg>
  )
}

const FAQ_ITEMS = [
  {
    q: 'What happens after the 3-day trial?',
    a: 'Your card is collected at sign-up but not charged for the first 3 days. At the end of the trial, Starter billing begins at $49/month. You can cancel before day 4 and pay nothing.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your account settings at any time — no cancellation fees, no questions asked. Cancellations take effect at the end of your current billing period.',
  },
  {
    q: "Does Growth or ProAgent have a free trial?",
    a: "No. Growth and ProAgent are charged immediately on sign-up. The 3-day free trial is exclusive to the Starter plan.",
  },
  {
    q: "What's included in annual billing?",
    a: "Annual billing gives you 2 months free — you pay for 10 months and get 12. Starter is $490/yr, Growth is $890/yr, ProAgent is $1,490/yr. Annual plans are billed upfront.",
  },
  {
    q: 'What are team seats?',
    a: "Seats let you invite team members — a VA, social media manager, or anyone who needs platform access. Starter includes 1 seat, Growth includes 3, ProAgent includes 5. Extra seats are $15/mo each on ProAgent.",
  },
  {
    q: 'Can I upgrade or downgrade anytime?',
    a: 'Yes. Upgrades take effect immediately; downgrades apply at the start of your next billing cycle. You keep full access until your current period ends.',
  },
  {
    q: 'What is the Brand Kit?',
    a: "The Brand Kit is where Maya learns your business. You tell her your tone, audience, and key details — she uses that foundation for everything she creates. The Brand Kit is locked during the Starter trial and unlocks once your subscription begins.",
  },
  {
    q: 'What channels does Maya cover?',
    a: 'Email, Instagram, and Facebook on all plans. Scheduling across additional channels is available on Growth and ProAgent.',
  },
]

const TIERS = [
  {
    name: 'Starter',
    desc: 'For getting your first campaigns out the door.',
    monthlyPrice: 49,
    annualPrice: 490,
    trial: '3-day free trial · Card required, no charge for 3 days',
    features: [
      '1 active campaign at a time',
      'Maya chat + Brand Kit',
      'Approval queue',
      'All 9 agents',
      '100 credits / month',
      '1 seat included',
    ],
    cta: 'Start your free trial',
    ctaHref: '/pricing',
    ctaClass: 'btn-ghost',
    featured: false,
  },
  {
    name: 'Growth',
    desc: 'For businesses that want the marketing fully run.',
    monthlyPrice: 89,
    annualPrice: 890,
    trial: null,
    features: [
      'Everything in Starter',
      'Unlimited campaigns & content',
      'Competitor watch + follow-ups',
      'Scheduling across every channel',
      'Full analytics',
      '350 credits / month',
      '3 seats included',
    ],
    cta: 'Get started',
    ctaHref: '/pricing',
    ctaClass: 'btn-primary',
    featured: true,
  },
  {
    name: 'ProAgent',
    desc: 'For growing businesses that want every advantage.',
    monthlyPrice: 149,
    annualPrice: 1490,
    trial: null,
    features: [
      'Everything in Growth',
      '1,000 credits / month',
      'Multiple brand workspaces',
      'Team roles & approvals',
      'Priority support',
      '5 seats included (+$15/mo per extra)',
    ],
    cta: 'Get started',
    ctaHref: '/pricing',
    ctaClass: 'btn-ghost',
    featured: false,
  },
]

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    document.querySelectorAll('.lab5 .reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="lab5">
      {/* NAV */}
      <MarketingNav active="pricing" />

      {/* PRICING HEADER */}
      <section id="pricing">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Pricing</span>
            <h2 className="t-h2">Less than a freelancer.<br />More than a team.</h2>
            <p className="t-lead">Try Starter free for 3 days. Upgrade when you&rsquo;re ready — most users see the return in week one.</p>
          </div>

          {/* Monthly / Annual toggle */}
          <div className="billing-toggle-wrap">
            <div className="billing-toggle">
              <button
                className={!annual ? 'active' : ''}
                onClick={() => setAnnual(false)}
              >
                Monthly
              </button>
              <button
                className={annual ? 'active' : ''}
                onClick={() => setAnnual(true)}
              >
                Annual <span className="save-badge">2 months free</span>
              </button>
            </div>
          </div>

          <div className="price-grid">
            {TIERS.map((tier) => {
              const displayPrice = annual
                ? Math.round(tier.annualPrice / 12)
                : tier.monthlyPrice

              return (
                <div key={tier.name} className={`tier reveal${tier.featured ? ' featured' : ''}`}>
                  {tier.featured && <div className="badge">Most popular</div>}
                  <div className="tname">{tier.name}</div>
                  <div className="tdesc">{tier.desc}</div>
                  <div className="tprice">
                    ${displayPrice}<span> / mo</span>
                  </div>
                  {annual && (
                    <div className="tprice-note">${tier.annualPrice} billed annually</div>
                  )}
                  {tier.trial && !annual && (
                    <div className="trial-tag">{tier.trial}</div>
                  )}
                  <ul className="tlist">
                    {tier.features.map((f) => (
                      <li key={f}><CheckIcon />{f}</li>
                    ))}
                  </ul>
                  <a className={`btn ${tier.ctaClass}`} href={tier.ctaHref}>{tier.cta}</a>
                </div>
              )
            })}
          </div>

          <p className="tier-note">
            All plans billed monthly. Annual billing saves 2 months — billed upfront.<br />
            Growth &amp; ProAgent charged immediately on sign-up. Starter includes a 3-day free trial.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Questions</span>
            <h2 className="t-h2">Good questions.<br />Straight answers.</h2>
          </div>
          <div className="faq reveal">
            {FAQ_ITEMS.map(({ q, a }, i) => (
              <div key={q} className="faq-item">
                <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {q}
                  <span className={`faq-icon${openFaq === i ? ' open' : ''}`}>+</span>
                </button>
                {openFaq === i && <div className="faq-body"><p>{a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DARK CTA */}
      <div className="cta-section">
        <div className="cta-orb">
          <Metaballs
            speed={1}
            count={9}
            size={0.26}
            scale={1}
            colors={['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE']}
            colorBack="#0E0E11"
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
        <div className="cta-in">
          <h2>Work like you have a full<br />marketing team. Because now you do.</h2>
          <p>Start your 3-day free trial. No charge until day 4.</p>
          <div className="cta-btns">
            <a className="btn btn-white btn-lg" href="/pricing">Start your free trial</a>
            <a className="btn btn-dark-ghost btn-lg" href="/sign-in">Sign in</a>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-in">
          <div className="footer-top">
            <div className="footer-brand">
              <a className="brand" href="/">
                <img className="brand-logo" src="/agent7even_logo.svg" alt="Agent7even" />
              </a>
              <p>The AI-first marketing platform for small business. Meet Maya.</p>
            </div>
            <div className="fcol">
              <h5>Product</h5>
              <a href="/#how">How it works</a>
              <a href="/#features">Features</a>
              <a href="/agents">Agents</a>
              <a href="/pricing">Pricing</a>
            </div>
            <div className="fcol">
              <h5>Use cases</h5>
              <a href="/use-cases/ecommerce">E-commerce</a>
              <a href="/use-cases/local-service">Local service</a>
              <a href="/use-cases/coaches-creators">Creators</a>
              <a href="/use-cases/agencies">Agencies</a>
            </div>
            <div className="fcol">
              <h5>Company</h5>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
              <a href="mailto:support@agent7even.ai">Contact</a>
            </div>
            <div className="fcol">
              <h5>Legal</h5>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="#">Security</a>
            </div>
          </div>
          <div className="footer-btm">
            <p>© 2026 Agent7even, Inc.</p>
            <p>Built for people with better things to do.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
