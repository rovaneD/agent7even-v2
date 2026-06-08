'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Metaballs } from '@paper-design/shaders-react'

const CARD_IMAGES: Record<string, string> = {
  ecommerce: '/lab5/TheBrand.jpg',
  'local-service': '/lab5/The Competitor.jpg',
  'coaches-creators': '/lab5/scale.jpg',
  agencies: '/lab5/Yourbest.jpg',
}

const CARDS = [
  {
    slug: 'ecommerce',
    ic: '#EE533B',
    label: 'E-commerce brands',
    h2: "The brand goes quiet between launches.",
    lead: "Tell Maya about the drop. Get the launch sequence back — teasers, emails, posts — in your voice, ready to approve.",
    pts: [
      "A drop becomes a campaign in an afternoon.",
      "You're never undercut blind.",
      "The list stays warm.",
      "One voice, every channel.",
    ],
  },
  {
    slug: 'local-service',
    ic: '#10B981',
    label: 'Local service businesses',
    h2: "The competitor across town isn't better. They're just more present.",
    lead: "Tell Maya to fill next week. Get the offer and the posts to push it — in your voice, ready to approve.",
    pts: [
      "A slow week becomes a promotion overnight.",
      "You're never the last to know.",
      "No review goes unanswered.",
      "One voice, everywhere you show up.",
    ],
  },
  {
    slug: 'coaches-creators',
    ic: '#F5349B',
    label: 'Coaches, creators & solo founders',
    h2: "You can't scale yourself. That's the real ceiling.",
    lead: "Tell Maya about the offer. Get the full launch sequence in your voice — review, approve, ship.",
    pts: [
      "A launch runs itself.",
      "You're never late to the conversation.",
      "The momentum doesn't leak.",
      "It still sounds like you.",
    ],
  },
  {
    slug: 'agencies',
    ic: '#3286FE',
    label: 'Agencies',
    h2: "Your best people get pulled into work that just has to get done.",
    lead: "Brief Maya on a client. Your team reviews and refines instead of building from zero.",
    pts: [
      "Campaigns drafted per account, in each client's voice.",
      "Competitive intel without the manual research.",
      "The routine output runs itself.",
      "Voice held per client, automatically.",
    ],
  },
]

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
            <a href="/lab5/agents">Agents</a>
            <a href="/lab5/pricing">Pricing</a>
            <a href="/lab5/use-cases" style={{ color: 'var(--ink)' }}>Use cases</a>
          </div>
          <div className="nav-right">
            <a className="nav-signin" href="https://app.agent7even.com/sign-in">Sign in</a>
            <a className="btn btn-primary btn-sm" href="https://app.agent7even.com/sign-up">Sign up</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="idx-hero">
        <div className="wrap">
          <span className="eyebrow">Use cases</span>
          <h1 className="t-display">Maya works for your world,<br />whatever that looks like.</h1>
          <p className="t-lead">Different business, same problem — the marketing never gets done. Here&rsquo;s how Maya solves it for each one.</p>
        </div>
      </header>

      {/* GRID */}
      <section className="wrap" style={{ paddingBottom: '108px' }}>
        <div className="idx-grid">
          {CARDS.map((c) => (
            <Link
              key={c.slug}
              href={`/lab5/use-cases/${c.slug}`}
              className="idx-card reveal"
              style={{ '--ic': c.ic } as React.CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CARD_IMAGES[c.slug]} alt="" className="idx-card-img" />
              <div className="pad">
                <span className="seg-eyebrow">
                  <span className="sd" />
                  {c.label}
                </span>
                <h2>{c.h2}</h2>
                <p className="lead">{c.lead}</p>
                <ul className="pts">
                  {c.pts.map((pt) => (
                    <li key={pt}><span className="d" />{pt}</li>
                  ))}
                </ul>
                <span className="go">Read more <ArrowRight /></span>
              </div>
            </Link>
          ))}
        </div>
        <p className="idx-foot-note">Same Maya. Four different jobs to be done.</p>
      </section>

      {/* DARK CTA */}
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
            <a className="btn btn-white btn-lg" href="https://app.agent7even.com/pricing">Start your free trial</a>
            <a className="btn btn-dark-ghost btn-lg" href="/lab5/pricing">See plans →</a>
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
              <a href="/lab5/agents">Agents</a>
              <a href="/lab5/pricing">Pricing</a>
            </div>
            <div className="fcol">
              <h5>Use cases</h5>
              <a href="/lab5/use-cases/ecommerce">E-commerce</a>
              <a href="/lab5/use-cases/local-service">Local service</a>
              <a href="/lab5/use-cases/coaches-creators">Creators</a>
              <a href="/lab5/use-cases/agencies">Agencies</a>
            </div>
            <div className="fcol">
              <h5>Company</h5>
              <a href="#">About</a><a href="#">Blog</a><a href="#">Careers</a><a href="#">Contact</a>
            </div>
            <div className="fcol">
              <h5>Legal</h5>
              <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Security</a>
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
