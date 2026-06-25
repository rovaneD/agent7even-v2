'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import Metaballs from '../SafeMetaballs'
import MarketingNav from '../MarketingNav'
import { cases } from '../../lab-use-cases/_data'

const CARD_IMAGES: Record<string, string> = {
  ecommerce: '/lab5/uc-ecommerce.jpg',
  'local-service': '/lab5/uc-local.jpg',
  'coaches-creators': '/lab5/uc-creators.jpg',
  agencies: '/lab5/uc-agencies.jpg',
}

/** Local service leads — strongest vertical per A1 §5 */
const CARD_ORDER = ['local-service', 'ecommerce', 'coaches-creators', 'agencies'] as const

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12h15M13 6l6 6-6 6"/>
  </svg>
)

export default function UseCasesPage() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    document.querySelectorAll('.lab5 .reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const ordered = CARD_ORDER.map((slug) => cases.find((c) => c.slug === slug)).filter(Boolean)

  return (
    <div className="lab5">
      <MarketingNav active="use-cases" />

      <header className="idx-hero">
        <div className="wrap">
          <span className="eyebrow">Use cases</span>
          <h1 className="t-display">Which business looks<br />most like yours?</h1>
          <p className="t-lead">Same marketing OS — different agents matter most depending on how you work. Pick your world and see the stack that fits.</p>
        </div>
      </header>

      <section className="wrap" style={{ paddingBottom: '108px' }}>
        <div className="idx-grid">
          {ordered.map((c) => (
            <Link
              key={c!.slug}
              href={`/use-cases/${c!.slug}`}
              className="idx-card reveal"
              style={{ '--ic': c!.accent } as React.CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CARD_IMAGES[c!.slug]} alt="" className="idx-card-img" />
              <div className="pad">
                <span className="seg-eyebrow">
                  <span className="sd" />
                  {c!.label}
                </span>
                <h2>{c!.painLine}</h2>
                <p className="lead">{c!.hero.subhead.split('. ')[0]}.</p>
                <div className="uc-card-stack">
                  <span className="uc-card-stack-label">Lead agents</span>
                  <ul className="uc-card-stack-list">
                    {c!.agentStack.map((a) => (
                      <li key={a.name}><b>{a.name}</b> — {a.role}</li>
                    ))}
                  </ul>
                </div>
                <span className="go">See this stack <ArrowRight /></span>
              </div>
            </Link>
          ))}
        </div>
        <p className="idx-foot-note">Different pain. Different agents. One approval-first OS.</p>
      </section>

      <div className="cta-section">
        <div className="cta-orb">
          <Metaballs
            speed={1} count={9} size={0.26} scale={1}
            colors={['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE']}
            colorBack="#0E0E11"
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
        <div className="cta-in reveal">
          <h2>Put Maya to work<br />for your business.</h2>
          <p>Start your 3-day free trial. No charge until day 4.</p>
          <div className="cta-btns">
            <a className="btn btn-white btn-lg" href="/pricing">Start your free trial</a>
            <a className="btn btn-dark-ghost btn-lg" href="/pricing">See plans →</a>
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
              <a href="#">About</a><a href="#">Blog</a><a href="#">Careers</a><a href="mailto:support@agent7even.ai">Contact</a>
            </div>
            <div className="fcol">
              <h5>Legal</h5>
              <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/security">Security</a>
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
