'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Metaballs from '../SafeMetaballs'
import { cases } from '../../lab-use-cases/_data'
import MarketingNav from '../MarketingNav'
import { useMockupScript } from '../useMockupScript'

declare global {
  interface Window {
    __initUseCaseMockups?: () => void
  }
}

function headlineLines(text: string) {
  const lines = text.split('\n')
  if (lines.length === 1) return text
  return lines.map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line.replace(' to stop.', ' to\u00A0stop.')}
    </span>
  ))
}

// Per-segment config: uc mockup key, colors, pull line, more-cases cards
const SEG: Record<string, {
  ucKey: string
  seg: string
  pull: string
  more: { slug: string; seg: string; bg: string; eyebrow: string; headline: string; tagline: string; icon: React.ReactNode }[]
}> = {
  ecommerce: {
    ucKey: 'ecommerce',
    seg: '#EE533B',
    pull: 'The brand goes quiet between launches — and quiet trains customers to forget.',
    more: [
      { slug: 'local-service', seg: '#10B981', bg: '#E3F9F0', eyebrow: 'Local service', headline: 'Good at the work. Now visible for it.', tagline: 'Stay visible without staying up late — the slow week filled, competitive reports on your desk.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg> },
      { slug: 'coaches-creators', seg: '#F5349B', bg: '#FDE5F1', eyebrow: 'Creators & founders', headline: 'Finally in two places at once.', tagline: 'You are the product and the marketing department. Maya carries the half you never have time for.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg> },
      { slug: 'startups', seg: '#6366F1', bg: '#EEF2FF', eyebrow: 'Startups', headline: 'Ship the story before you ship the team.', tagline: 'Launch-ready GTM from one Foundation — before you can hire marketing.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M3 13l9 5 9-5"/></svg> },
    ],
  },
  'local-service': {
    ucKey: 'local',
    seg: '#10B981',
    pull: "The competitor across town isn't better. They're just more present.",
    more: [
      { slug: 'ecommerce', seg: '#EE533B', bg: '#FFEEE9', eyebrow: 'E-commerce brands', headline: 'The store runs.\nThe brand doesn\'t have to stop.', tagline: 'Consistent presence between drops — launches drafted, the list kept warm.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2l2.2 12.2a1.5 1.5 0 0 0 1.5 1.3h8.3a1.5 1.5 0 0 0 1.5-1.2L21 7H5.5"/></svg> },
      { slug: 'coaches-creators', seg: '#F5349B', bg: '#FDE5F1', eyebrow: 'Creators & founders', headline: 'Finally in two places at once.', tagline: 'You are the product and the marketing department. Maya carries the half you never have time for.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg> },
      { slug: 'startups', seg: '#6366F1', bg: '#EEF2FF', eyebrow: 'Startups', headline: 'Ship the story before you ship the team.', tagline: 'Launch-ready GTM from one Foundation — before you can hire marketing.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M3 13l9 5 9-5"/></svg> },
    ],
  },
  'coaches-creators': {
    ucKey: 'creators',
    seg: '#F5349B',
    pull: "You can't scale yourself. That's the real ceiling.",
    more: [
      { slug: 'ecommerce', seg: '#EE533B', bg: '#FFEEE9', eyebrow: 'E-commerce brands', headline: 'The store runs.\nThe brand doesn\'t have to stop.', tagline: 'Consistent presence between drops — launches drafted, the list kept warm.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2l2.2 12.2a1.5 1.5 0 0 0 1.5 1.3h8.3a1.5 1.5 0 0 0 1.5-1.2L21 7H5.5"/></svg> },
      { slug: 'local-service', seg: '#10B981', bg: '#E3F9F0', eyebrow: 'Local service', headline: 'Good at the work. Now visible for it.', tagline: 'Stay visible without staying up late — the slow week filled, competitive reports on your desk.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg> },
      { slug: 'startups', seg: '#6366F1', bg: '#EEF2FF', eyebrow: 'Startups', headline: 'Ship the story before you ship the team.', tagline: 'Launch-ready GTM from one Foundation — before you can hire marketing.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M3 13l9 5 9-5"/></svg> },
    ],
  },
  startups: {
    ucKey: 'startups',
    seg: '#6366F1',
    pull: "You can't hire marketing yet — but you still have to look like you did.",
    more: [
      { slug: 'ecommerce', seg: '#EE533B', bg: '#FFEEE9', eyebrow: 'E-commerce brands', headline: 'The store runs.\nThe brand doesn\'t have to stop.', tagline: 'Consistent presence between drops — launches drafted, the list kept warm.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2l2.2 12.2a1.5 1.5 0 0 0 1.5 1.3h8.3a1.5 1.5 0 0 0 1.5-1.2L21 7H5.5"/></svg> },
      { slug: 'local-service', seg: '#10B981', bg: '#E3F9F0', eyebrow: 'Local service', headline: 'Good at the work. Now visible for it.', tagline: 'Stay visible without staying up late — the slow week filled, competitive reports on your desk.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg> },
      { slug: 'coaches-creators', seg: '#F5349B', bg: '#FDE5F1', eyebrow: 'Creators & founders', headline: 'Finally in two places at once.', tagline: 'You are the product and the marketing department. Maya carries the half you never have time for.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg> },
    ],
  },
}

const ArrowLeft = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M11 6l-6 6 6 6"/>
  </svg>
)

const ArrowRight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12h15M13 6l6 6-6 6"/>
  </svg>
)

type Props = { slug: string }

export default function UseCaseDetailClient({ slug }: Props) {
  const cfg = SEG[slug]
  const uc = cases.find((c) => c.slug === slug)
  useMockupScript('/lab5/usecase-mockups.js', '__initUseCaseMockups')

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      }),
      { threshold: 0.1, rootMargin: '0px 0px -7% 0px' }
    )
    document.querySelectorAll('.lab5 .reveal').forEach((el) => io.observe(el))
    // Re-init mockups on every mount (Script onLoad only fires once across navigations)
    requestAnimationFrame(() => window.__initUseCaseMockups?.())
    return () => io.disconnect()
  }, [slug])

  if (!cfg || !uc) return notFound()

  return (
    <div className="lab5" style={{ '--seg': cfg.seg } as React.CSSProperties}>

      {/* NAV */}
      <MarketingNav active="use-cases" />

      <div className="wrap">

        {/* BREADCRUMB */}
        <div className="crumb">
          <Link href="/use-cases"><ArrowLeft />Use cases</Link>
        </div>

        {/* HERO */}
        <header className="uc-hero">
          <span className="seg-eyebrow"><span className="sd" />{uc.label}</span>
          <h1 className="t-display">{headlineLines(uc.hero.headline)}</h1>
          <p className="t-lead">{uc.hero.subhead}</p>
          <div className="uc-stage reveal">
            <div data-uc={cfg.ucKey}></div>
          </div>
        </header>

        {/* AGENT STACK */}
        <section className="uc-agents measure reveal">
          <h2>{uc.agentStackHeadline}</h2>
          <ul className="agent-stack">
            {uc.agentStack.map((a) => (
              <li key={a.name}>
                <span className="agent-stack-name">{a.name}</span>
                <span className="agent-stack-role">{a.role}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* LEDE */}
        <section className="uc-lede measure reveal">
          {uc.setup.split('\n\n').slice(0, 1).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        {/* PULL */}
        <section className="pull measure reveal">
          <p>{cfg.pull}</p>
        </section>

        {/* COST */}
        <section className="uc-block measure reveal">
          <h2>{uc.costHeadline}</h2>
          <div className="body">
            {uc.cost.split('\n\n').map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* WHAT MAYA HANDLES */}
        <section className="uc-block measure reveal">
          <h2>{uc.whatHeadline}</h2>
          <div className="body">
            {uc.what.split('\n\n').map((p, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace('You stay in control. Nothing sends until you say so.', '<b>You stay in control. Nothing sends until you say so.</b>') }} />
            ))}
          </div>
        </section>

        {/* IN PRACTICE — proof grid */}
        <section className="uc-practice measure-wide reveal">
          <h2>What that looks like in practice</h2>
          <div className="proof">
            {uc.bullets.map((b, i) => (
              <div key={b.heading} className="proof-item">
                <span className="pn"><b>0{i + 1}</b>{uc.proofLabels[i]}</span>
                <h3>{b.heading}</h3>
                <p>{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* WHERE MAYA SITS */}
        <section className="uc-sits measure-wide reveal">
          <div className="panel">
            <h2>Where Maya sits</h2>
            <p>{uc.where}</p>
            <a className="btn btn-seg btn-lg seg-cta" href="/pricing">
              Start your free trial
            </a>
          </div>
        </section>

        {/* MORE USE CASES */}
        <section className="uc-more reveal">
          <div className="more-head">
            <h2>More use cases</h2>
            <Link href="/use-cases">All use cases <ArrowRight /></Link>
          </div>
          <div className="more-grid">
            {cfg.more.map((m) => (
              <Link
                key={m.slug}
                href={`/use-cases/${m.slug}`}
                className="mcard"
                style={{ '--seg': m.seg } as React.CSSProperties}
              >
                <div className="cap" style={{ background: m.bg }}>
                  <div className="ico" style={{ color: m.seg }}>{m.icon}</div>
                </div>
                <div className="mbody">
                  <span className="seg-eyebrow"><span className="sd" />{m.eyebrow}</span>
                  <h3>{headlineLines(m.headline)}</h3>
                  <p>{m.tagline}</p>
                  <span className="go">Read more <ArrowRight /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>

      {/* DARK CTA */}
      <div className="cta-wrap">
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
      </div>

      {/* FOOTER */}
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
              <a href="/use-cases/startups">Startups</a>
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
