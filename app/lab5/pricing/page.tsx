'use client'

import { useEffect, useState } from 'react'
import Metaballs from '../SafeMetaballs'
import MarketingNav from '../MarketingNav'

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l4.5 4.5L19 7" />
    </svg>
  )
}

const SERVICE_REQUEST_DEF =
  'Human-delivered work (design, photography, ad management) you request and track in your dashboard, fulfilled by our team. Not AI — managed services.'

const FAQ_ITEMS = [
  {
    q: 'What does Maya actually create?',
    a: 'Campaign plans, social posts, email copy, ad variations to test, on-brand images, short video, SEO and competitor reports, and performance digests — all drafted for your approval queue. Twelve specialist agents handle specific jobs; Maya coordinates them. Nothing publishes until you sign off.',
  },
  {
    q: 'Are campaigns, chat, and text agents really unlimited?',
    a: 'Yes. Maya chat, agent runs, and campaign generation do not consume media credits on any plan. Credits meter image and video generation only — the creative assets that cost real compute.',
  },
  {
    q: 'What are media credits?',
    a: 'Media credits pay for generated images and videos only. Standard images cost 3 credits, standard videos 10. A typical month on Starter (100 credits) is about 33 images or 10 videos — plus unlimited text work on top.',
  },
  {
    q: 'What are service requests?',
    a: SERVICE_REQUEST_DEF + ' Starter includes 1 active request, Growth 3, ProAgent unlimited.',
  },
  {
    q: 'What does ProAgent unlock beyond more credits?',
    a: 'Premium image (Recraft) and premium video (Kling) models — higher-quality media generation gated to ProAgent. Standard Gemini/Veo models are on every plan.',
  },
  {
    q: 'How does the 3-day free trial work?',
    a: 'Starter only. Your card is collected at sign-up but not charged for 3 days. Cancel before day 4 and pay nothing. Growth and ProAgent are charged immediately on sign-up.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your account settings — no fees, no contract. Access continues through the end of your billing period.',
  },
  {
    q: "What's included in annual billing?",
    a: 'Annual billing saves 2 months — billed upfront. Starter $490/yr, Growth $890/yr, ProAgent $1,490/yr.',
  },
]

const TIERS = [
  {
    name: 'Starter',
    desc: 'Your first marketing OS — unlimited text work, media for steady posting.',
    monthlyPrice: 49,
    annualPrice: 490,
    trial: '3-day free trial · Card required, no charge for 3 days',
    mediaNote: '100 media credits/mo · ≈ 33 images or 10 videos',
    features: [
      'Unlimited campaigns, content, chat & agent runs',
      '100 media credits / month',
      'Maya + all 12 specialist agents',
      'Approval queue',
      '1 service request',
      '1 seat included',
    ],
    cta: 'Start your free trial',
    ctaHref: '/pricing',
    ctaClass: 'btn-ghost',
    featured: false,
  },
  {
    name: 'Growth',
    desc: 'More media volume for businesses posting across channels every week.',
    monthlyPrice: 89,
    annualPrice: 890,
    trial: null,
    mediaNote: '350 media credits/mo · ≈ 116 images or 35 videos',
    features: [
      'Everything in Starter',
      '350 media credits / month',
      '3 service requests',
      '3 seats included',
      'Priority support',
    ],
    cta: 'Get started',
    ctaHref: '/pricing',
    ctaClass: 'btn-primary',
    featured: true,
  },
  {
    name: 'ProAgent',
    desc: 'Maximum media allowance plus premium Recraft & Kling models.',
    monthlyPrice: 149,
    annualPrice: 1490,
    trial: null,
    mediaNote: '1,000 media credits/mo · ≈ 333 images or 100 videos',
    features: [
      'Everything in Growth',
      '1,000 media credits / month',
      'Premium image & video models',
      'Unlimited service requests',
      '5 seats included (+$15/mo per extra)',
      'Dedicated support',
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
      <MarketingNav active="pricing" />

      <section id="pricing">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Pricing</span>
            <h2 className="t-h2">Choose your marketing<br />team size.</h2>
            <p className="t-lead">
              Unlimited campaigns, content, and Maya chat on every plan. Media credits meter images and video only — so the work you do every day never runs out mid-week.
            </p>
          </div>

          <div className="pricing-anchor reveal">
            <p>
              A part-time social coordinator runs <b>$2,000–4,000/mo</b>. A freelance retainer often starts at <b>$3,000/mo</b>.
              Agent7even gives you twelve specialist agents plus Maya for a fraction of that — with you approving everything before it goes live.
            </p>
          </div>

          <div className="billing-toggle-wrap">
            <div className="billing-toggle">
              <button className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>Monthly</button>
              <button className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>
                Annual <span className="save-badge">2 months free</span>
              </button>
            </div>
          </div>

          <div className="price-grid">
            {TIERS.map((tier) => {
              const displayPrice = annual ? Math.round(tier.annualPrice / 12) : tier.monthlyPrice
              return (
                <div key={tier.name} className={`tier reveal${tier.featured ? ' featured' : ''}`}>
                  {tier.featured && <div className="badge">Most popular</div>}
                  <div className="tname">{tier.name}</div>
                  <div className="tdesc">{tier.desc}</div>
                  <div className="tprice">${displayPrice}<span> / mo</span></div>
                  {annual && <div className="tprice-note">${tier.annualPrice} billed annually</div>}
                  {tier.trial && !annual && <div className="trial-tag">{tier.trial}</div>}
                  <div className="trial-tag" style={{ marginTop: tier.trial && !annual ? 8 : 0, background: '#F4F8FF', color: 'var(--l5-blue)', border: '1px solid #DCE9FF' }}>
                    {tier.mediaNote}
                  </div>
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

          <p className="tier-note reveal">
            <b>Service requests:</b> {SERVICE_REQUEST_DEF}<br />
            Growth and ProAgent charged immediately on sign-up. Starter includes a 3-day free trial.<br />
            <span style={{ color: 'var(--l5-faint)' }}>Open decisions flagged: ProAgent naming · trial on all tiers · Starter→Growth is primarily volume — see FAQ.</span>
          </p>
        </div>
      </section>

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

      <footer className="footer">
        <div className="footer-in">
          <div className="footer-top">
            <div className="footer-brand">
              <a className="brand" href="/">
                <img className="brand-logo" src="/agent7even_logo.svg" alt="Agent7even" />
              </a>
              <p>The AI marketing operating system for small business. Meet Maya.</p>
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
              <a href="/security">Security</a>
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
