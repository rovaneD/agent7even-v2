'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Metaballs } from '@paper-design/shaders-react'

const CASES = [
  {
    slug: 'ecommerce',
    label: 'E-commerce brands',
    accent: '#EE533B',
    enemy: 'The brand goes quiet between launches.',
    tagline: 'Tell Maya about the drop. Get the launch sequence back — teasers, emails, posts — in your voice, ready to approve.',
    bullets: [
      "A drop becomes a campaign in an afternoon.",
      "You're never undercut blind.",
      "The list stays warm.",
      "One voice, every channel.",
    ],
  },
  {
    slug: 'local-service',
    label: 'Local service businesses',
    accent: '#10B981',
    enemy: "The competitor across town isn't better. They're just more present.",
    tagline: 'Tell Maya to fill next week. Get the offer and the posts to push it — in your voice, ready to approve.',
    bullets: [
      "A slow week becomes a promotion overnight.",
      "You're never the last to know.",
      "No review goes unanswered.",
      "One voice, everywhere you show up.",
    ],
  },
  {
    slug: 'coaches-creators',
    label: 'Coaches, creators & solo founders',
    accent: '#F5349B',
    enemy: "You can't scale yourself. That's the real ceiling.",
    tagline: 'Tell Maya about the offer. Get the full launch sequence in your voice — review, approve, ship.',
    bullets: [
      "A launch runs itself.",
      "You're never late to the conversation.",
      "The momentum doesn't leak.",
      "It still sounds like you.",
    ],
  },
  {
    slug: 'agencies',
    label: 'Agencies',
    accent: '#3286FE',
    enemy: 'Your best people get pulled into work that just has to get done.',
    tagline: 'Brief Maya on a client. Your team reviews and refines instead of building from zero.',
    bullets: [
      "Campaigns drafted per account, in each client's voice.",
      "Competitive intel without the manual research.",
      "The routine output runs itself.",
      "Voice held per client, automatically.",
    ],
  },
]

export default function UseCasesPage() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
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
      <section style={{ paddingBottom: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal" style={{ marginBottom: 0 }}>
            <span className="eyebrow">Use cases</span>
            <h1 className="t-h2">Maya works for your world,<br />whatever that looks like.</h1>
            <p className="t-lead">Different business, same problem — the marketing never gets done. Here&rsquo;s how Maya solves it for each one.</p>
          </div>
        </div>
      </section>

      {/* CARDS */}
      <section>
        <div className="wrap">
          <div className="uc-grid">
            {CASES.map((c) => (
              <Link key={c.slug} href={`/lab5/use-cases/${c.slug}`} className="uc-card reveal">
                <div className="uc-label">
                  <span className="uc-dot" style={{ background: c.accent }} />
                  <span className="uc-name">{c.label}</span>
                </div>
                <p className="uc-enemy">{c.enemy}</p>
                <p className="uc-tagline">{c.tagline}</p>
                <ul className="uc-bullets">
                  {c.bullets.map((b) => (
                    <li key={b} className="uc-bullet">
                      <span className="uc-bullet-dot" style={{ background: c.accent }} />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="uc-cta" style={{ color: c.accent }}>
                  Read more <span className="uc-arrow">→</span>
                </div>
              </Link>
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
