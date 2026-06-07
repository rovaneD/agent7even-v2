'use client'

import { useEffect } from 'react'
import { Metaballs } from '@paper-design/shaders-react'

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
    a: 'Yes. Cancel from your account settings at any time — no cancellation fees, no questions asked.',
  },
  {
    q: 'Does Growth or ProAgent have a free trial?',
    a: 'No. Growth and ProAgent are charged immediately on sign-up. The 3-day free trial is exclusive to the Starter plan.',
  },
  {
    q: 'What are team seats?',
    a: 'Each plan includes a set number of seats — Starter includes 1, Growth includes 3, ProAgent includes 5. You can add extra seats on any plan for $15/month per seat.',
  },
  {
    q: 'Can I upgrade or downgrade my plan?',
    a: 'Yes. You can change plans at any time from your account settings. Upgrades take effect immediately; downgrades apply at the start of your next billing cycle.',
  },
  {
    q: 'What is the Brand Kit?',
    a: "The Brand Kit is where Maya learns your business. You tell her your tone, audience, and key details — she uses that foundation for everything she creates. The Brand Kit is locked during the Starter trial and unlocks once your subscription begins.",
  },
  {
    q: 'Does Maya actually sound like me?',
    a: "Yes. Maya is trained on your Brand Kit and refines her voice over time based on what you approve and reject. The longer she runs, the more accurate she gets.",
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
    price: '$49',
    period: '/ month',
    trial: '3-day free trial · Card required, no charge for 3 days',
    features: [
      '1 active campaign at a time',
      'Maya chat + Brand Kit',
      'Approval queue',
      '1 seat included',
    ],
    cta: 'Start your free trial',
    ctaHref: 'https://app.agent7even.com/pricing',
    ctaClass: 'btn-ghost',
    featured: false,
  },
  {
    name: 'Growth',
    desc: 'For businesses that want the marketing fully run.',
    price: '$89',
    period: '/ month',
    trial: null,
    features: [
      'Unlimited campaigns & content',
      'Competitor watch + follow-ups',
      'Scheduling across every channel',
      'Brand-voice training',
      '3 seats included',
    ],
    cta: 'Get started',
    ctaHref: 'https://app.agent7even.com/pricing',
    ctaClass: 'btn-primary',
    featured: true,
  },
  {
    name: 'ProAgent',
    desc: 'For growing businesses that want every advantage.',
    price: '$149',
    period: '/ month',
    trial: null,
    features: [
      'Everything in Growth',
      'Multiple brand workspaces',
      'Team roles & approvals',
      'Priority support',
      '5 seats included',
    ],
    cta: 'Get started',
    ctaHref: 'https://app.agent7even.com/pricing',
    ctaClass: 'btn-ghost',
    featured: false,
  },
]

export default function PricingPage() {
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
      <nav className="nav">
        <div className="nav-in">
          <a className="brand" href="/lab5">
            <span className="brand-mark">7</span>
            <span className="brand-name">AGENT<b>7</b>EVEN</span>
          </a>
          <div className="nav-links">
            <a href="/lab5#how">How it works</a>
            <a href="/lab5#features">Features</a>
            <a href="/lab5/pricing" style={{ color: 'var(--ink)' }}>Pricing</a>
            <a href="/lab5#uses">Use cases</a>
          </div>
          <div className="nav-right">
            <a className="nav-signin" href="https://app.agent7even.com/sign-in">Sign in</a>
            <a className="btn btn-primary btn-sm" href="https://app.agent7even.com/sign-up">Sign up</a>
          </div>
        </div>
      </nav>

      {/* PRICING HEADER */}
      <section id="pricing">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Pricing</span>
            <h2 className="t-h2">Less than a freelancer.<br />More than a team.</h2>
            <p className="t-lead">Try Starter free for 3 days. Upgrade when you&rsquo;re ready — most users see the return in week one.</p>
          </div>

          <div className="price-grid">
            {TIERS.map((tier) => (
              <div key={tier.name} className={`tier reveal${tier.featured ? ' featured' : ''}`}>
                {tier.featured && <div className="badge">Most popular</div>}
                <div className="tname">{tier.name}</div>
                <div className="tdesc">{tier.desc}</div>
                <div className="tprice">
                  {tier.price}<span> {tier.period}</span>
                </div>
                {tier.trial && <div className="trial-tag">{tier.trial}</div>}
                <ul className="tlist">
                  {tier.features.map((f) => (
                    <li key={f}><CheckIcon />{f}</li>
                  ))}
                </ul>
                <a className={`btn ${tier.ctaClass}`} href={tier.ctaHref}>{tier.cta}</a>
              </div>
            ))}
          </div>

          <p className="tier-note">
            All plans billed monthly. Annual plans available — save up to 17%.<br />
            Extra seats $15/mo each. Growth &amp; ProAgent billed immediately on sign-up.
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
            {FAQ_ITEMS.map(({ q, a }) => (
              <details key={q} className="faq-item">
                <summary>{q}</summary>
                <div className="faq-body"><p>{a}</p></div>
              </details>
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
            <a className="btn btn-white btn-lg" href="https://app.agent7even.com/pricing">Start your free trial</a>
            <a className="btn btn-dark-ghost btn-lg" href="https://app.agent7even.com/sign-in">Sign in</a>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-in">
          <div className="footer-top">
            <div className="footer-brand">
              <a className="brand" href="/lab5">
                <span className="brand-mark">7</span>
                <span className="brand-name">AGENT<b>7</b>EVEN</span>
              </a>
              <p>The AI-first marketing platform for small business. Meet Maya.</p>
            </div>
            <div className="fcol">
              <h5>Product</h5>
              <a href="/lab5#how">How it works</a>
              <a href="/lab5#features">Features</a>
              <a href="/lab5/pricing">Pricing</a>
              <a href="https://app.agent7even.com/sign-up">Sign up</a>
            </div>
            <div className="fcol">
              <h5>Use cases</h5>
              <a href="/lab5#uses">E-commerce</a>
              <a href="/lab5#uses">Local service</a>
              <a href="/lab5#uses">Creators</a>
              <a href="/lab5#uses">Agencies</a>
            </div>
            <div className="fcol">
              <h5>Company</h5>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
            </div>
            <div className="fcol">
              <h5>Legal</h5>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
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
