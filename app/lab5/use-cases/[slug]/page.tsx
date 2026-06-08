'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Metaballs } from '@paper-design/shaders-react'
import { notFound, useParams } from 'next/navigation'
import { cases } from '../../../lab-use-cases/_data'

const COLOR_SETS = [
  ['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE'],
  ['#3286FE', '#10B981', '#FCA509', '#F5349B', '#EE533B'],
  ['#10B981', '#3286FE', '#F5349B', '#FCA509', '#EE533B'],
  ['#FCA509', '#EE533B', '#3286FE', '#10B981', '#F5349B'],
]

function UseCaseThumbnail({ index, height = '100%' }: { index: number; height?: string }) {
  return (
    <Metaballs
      speed={0.5 + index * 0.15}
      count={8}
      size={0.35 + index * 0.02}
      scale={1}
      colors={COLOR_SETS[index % COLOR_SETS.length]}
      colorBack="#00000000"
      style={{ width: '100%', height, display: 'block', backgroundColor: '#F0F4FF', mixBlendMode: 'multiply' }}
    />
  )
}

export default function UseCaseDetailPage() {
  const params = useParams()
  const slug = params?.slug as string
  const uc = cases.find((c) => c.slug === slug)
  const idx = cases.findIndex((c) => c.slug === slug)
  const others = cases.filter((c) => c.slug !== slug)

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

  if (!uc) return notFound()

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

      {/* ARTICLE HERO */}
      <section className="uc-hero">
        <div className="uc-prose wrap">
          <Link href="/lab5/use-cases" className="uc-back">← Use cases</Link>
          <div className="uc-meta reveal">
            <span style={{ color: uc.accent, fontWeight: 600 }}>{uc.label}</span>
          </div>
          <h1 className="t-display reveal" style={{ marginTop: '20px' }}>{uc.hero.headline}</h1>
          <p className="t-lead reveal" style={{ marginTop: '20px', maxWidth: '520px' }}>{uc.hero.subhead}</p>
        </div>
        <div className="wrap">
          <div className="uc-visual reveal">
            <UseCaseThumbnail index={idx} height="100%" />
          </div>
        </div>
      </section>

      {/* ARTICLE BODY */}
      <article>
        <div className="uc-prose wrap">
          {/* Setup */}
          <div className="uc-section reveal">
            {uc.setup.split('\n\n').map((p, i) => (
              <p key={i} className="uc-p">{p}</p>
            ))}
          </div>

          {/* Cost */}
          <div className="uc-section reveal">
            <h2 className="uc-h2">{uc.costHeadline}</h2>
            {uc.cost.split('\n\n').map((p, i) => (
              <p key={i} className="uc-p">{p}</p>
            ))}
          </div>

          {/* What Maya handles */}
          <div className="uc-section reveal">
            <h2 className="uc-h2">{uc.whatHeadline}</h2>
            {uc.what.split('\n\n').map((p, i) => (
              <p key={i} className="uc-p">{p}</p>
            ))}
          </div>

          {/* Bullets */}
          <div className="uc-section reveal">
            <h2 className="uc-h2">What that looks like in practice</h2>
            <ul className="uc-list">
              {uc.bullets.map((b) => (
                <li key={b.heading} className="uc-list-item">
                  <span className="uc-list-dot" style={{ background: uc.accent }} />
                  <span>
                    <strong style={{ color: 'var(--l5-ink)' }}>{b.heading}</strong>{' '}{b.body}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Where Maya sits */}
          <div className="uc-section reveal">
            <h2 className="uc-h2">Where Maya sits</h2>
            <p className="uc-p">{uc.where}</p>
          </div>

          {/* CTA */}
          <div className="uc-section reveal" style={{ paddingBottom: '80px' }}>
            <a className="btn btn-blue btn-lg" href="https://app.agent7even.com/pricing">
              Start your free trial
            </a>
          </div>
        </div>
      </article>

      {/* MORE USE CASES */}
      <section className="uc-more-section">
        <div className="wrap">
          <h2 className="uc-more-hd reveal">More use cases</h2>
          <div className="uc-more-grid">
            {others.map((c) => {
              const ci = cases.findIndex((x) => x.slug === c.slug)
              return (
                <Link key={c.slug} href={`/lab5/use-cases/${c.slug}`} className="uc-more-card reveal">
                  <div className="uc-thumb">
                    <UseCaseThumbnail index={ci} height="100%" />
                  </div>
                  <div className="uc-more-text">
                    <div className="uc-label">
                      <span className="uc-dot" style={{ background: c.accent }} />
                      <span className="uc-name">{c.label}</span>
                    </div>
                    <p className="uc-more-headline">{c.hero.headline}</p>
                    <p className="uc-more-sub">{c.hero.subhead}</p>
                  </div>
                </Link>
              )
            })}
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
