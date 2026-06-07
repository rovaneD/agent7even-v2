'use client'

import { useEffect } from 'react'
import { Metaballs } from '@paper-design/shaders-react'

// ── Agent data (mirrors lib/agents/registry.ts) ────────────────────────────

const AGENTS = [
  {
    id: 'performance_digest',
    name: 'Performance Digest',
    description: "Surfaces what's working and what to do about it. Runs every morning so your day starts with signal, not noise.",
    bg: '#C5F9EC', fg: '#0F766E',
    auto: true,
    schedule: 'Daily at 7 am',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-6"/>
      </svg>
    ),
  },
  {
    id: 'competitor_watcher',
    name: 'Competitor Watcher',
    description: "Monitors your competitors and surfaces what's working for them — so you're never the last to know.",
    bg: '#C5F9CD', fg: '#15803D',
    auto: true,
    schedule: 'Weekly on Monday',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><circle cx="11" cy="11" r="3"/>
      </svg>
    ),
  },
  {
    id: 'trend_spotter',
    name: 'Trend Spotter',
    description: 'Monitors industry trends and viral content in your niche, filtered for brand fit before they land in your queue.',
    bg: '#FFE3AD', fg: '#92400E',
    auto: true,
    schedule: 'Daily at 6 am',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  {
    id: 'brand_voice_guardian',
    name: 'Brand Voice Guardian',
    description: 'Reviews all content against your Brand Kit before it goes out. Flags tone drift, off-message claims, and compliance risks.',
    bg: '#E2F7F2', fg: '#065F46',
    auto: true,
    schedule: 'Runs on every output',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>
      </svg>
    ),
  },
  {
    id: 'seo_scanner',
    name: 'SEO Scanner',
    description: 'Audits your website and suggests improvements — from on-page basics to content gaps — matched to your market.',
    bg: '#AFDAF7', fg: '#075985',
    auto: true,
    schedule: 'Weekly on Monday',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
    ),
  },
  {
    id: 'weekly_content',
    name: 'Weekly Content',
    description: "Drafts your social posts and emails in your voice so you don't start from a blank page. You approve, she schedules.",
    bg: '#C5EFF9', fg: '#0369A1',
    auto: false,
    schedule: 'On your request',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  {
    id: 'campaign_builder',
    name: 'Campaign Builder',
    description: 'Builds complete 30-day marketing campaigns — strategy, emails, social posts, and timeline — from a single brief.',
    bg: '#F7C5F9', fg: '#7E22CE',
    auto: false,
    schedule: 'On your request',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  {
    id: 'email_sequence_builder',
    name: 'Email Sequence Builder',
    description: 'Builds complete email flows — welcome, nurture, promotional, re-engagement — in your voice, ready to load into any ESP.',
    bg: '#EAE1F9', fg: '#6D28D9',
    auto: false,
    schedule: 'On your request',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  {
    id: 'ad_variations',
    name: 'Ad Variations',
    description: 'Creates multiple ad options — headlines, body copy, CTAs — across formats and platforms so you can test without writing each one.',
    bg: '#E6F4AD', fg: '#3F6212',
    auto: false,
    schedule: 'On your request',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l19-9-9 19-2-8-8-2z"/>
      </svg>
    ),
  },
]

const ANALYTICS_TILES = [
  {
    bg: '#EAF1FF', fg: '#0369A1',
    title: 'Social analytics',
    desc: 'Follower growth, engagement rates, reach, and top-performing posts across every connected channel — with best posting times surfaced automatically.',
    chips: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    bg: '#EAF1FF', fg: '#1877F2',
    title: 'Ad intelligence',
    desc: 'Spend, CTR, ROAS, and campaign performance consolidated across ad platforms. Maya flags when creative needs refreshing before your results slip.',
    chips: ['Meta Ads', 'Google Ads', 'TikTok Ads', 'LinkedIn Ads'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
    ),
  },
  {
    bg: '#C5F9EC', fg: '#0F766E',
    title: 'Performance Digest',
    desc: "Every morning, the Performance Digest agent reads your connected data and delivers a plain-English summary of what's working, what isn't, and what to act on.",
    chips: ['Daily digest', 'Weekly summary', 'Campaign alerts'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-6"/>
      </svg>
    ),
  },
  {
    bg: '#F4F0FF', fg: '#6D28D9',
    title: 'Inbox & conversations',
    desc: 'Message volume, response rates, and conversation patterns across your connected inboxes. Surface leads that went quiet, reviews that need a reply, and follow-up gaps.',
    chips: ['Email', 'DMs', 'Reviews', 'Form leads'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
]

export default function AgentsPage() {
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
            <a href="/lab5/agents" style={{ color: 'var(--ink)' }}>Agents</a>
            <a href="/lab5/pricing">Pricing</a>
            <a href="/lab5#uses">Use cases</a>
          </div>
          <div className="nav-right">
            <a className="nav-signin" href="https://app.agent7even.com/sign-in">Sign in</a>
            <a className="btn btn-primary btn-sm" href="https://app.agent7even.com/sign-up">Sign up</a>
          </div>
        </div>
      </nav>

      {/* PAGE HERO */}
      <section style={{ paddingBottom: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal" style={{ marginBottom: 0 }}>
            <span className="eyebrow">The platform</span>
            <h1 className="t-h2">The intelligence running<br />behind your marketing.</h1>
            <p className="t-lead">Nine specialized agents, live analytics, and one orchestrator who ties it all together. Here&rsquo;s exactly how it works.</p>
          </div>
        </div>
      </section>

      {/* ANALYTICS */}
      <section id="analytics">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Analytics</span>
            <h2 className="t-h2">See everything.<br />Understand anything.</h2>
            <p className="t-lead">Agent7even connects your social accounts, ad platforms, and inbox — then surfaces the signal you actually need, not a wall of charts.</p>
          </div>
          <div className="analytics-grid">
            {ANALYTICS_TILES.map((t) => (
              <div key={t.title} className="atile reveal">
                <div className="atile-icon" style={{ background: t.bg, color: t.fg }}>
                  {t.icon}
                </div>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
                <div className="atile-chips">
                  {t.chips.map((c) => <span key={c} className="chip">{c}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MAYA ORCHESTRATOR */}
      <section id="maya">
        <div className="wrap">
          <div className="maya-banner reveal">
            <div className="maya-banner-orb">
              <Metaballs
                speed={0.8}
                count={8}
                size={0.4}
                scale={1}
                colors={['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE']}
                colorBack="#0E0E11"
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>
            <div className="maya-banner-text">
              <span className="eyebrow">Maya</span>
              <h2>The brain that orchestrates the agents.</h2>
              <p>Maya isn&rsquo;t one of the nine agents — she&rsquo;s the intelligence layer above them. She reads your Foundation, monitors your business context, and decides which agents to dispatch, when to run them, and what to do with their output. You talk to Maya; she coordinates the rest. The agents just do their jobs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* AGENTS GRID */}
      <section id="agents" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">The nine agents</span>
            <h2 className="t-h2">Specialists, not generalists.</h2>
            <p className="t-lead">Each agent is built for one job and trained to do it well. Autonomous agents run on a schedule without asking — approval-required agents draft and wait for your sign-off.</p>
          </div>

          <div className="agent-grid">
            {AGENTS.map((agent) => (
              <div key={agent.id} className="agent-card reveal">
                <div className="agent-icon" style={{ background: agent.bg, color: agent.fg }}>
                  {agent.icon}
                </div>
                <h3>{agent.name}</h3>
                <p>{agent.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`agent-tag ${agent.auto ? 'auto' : 'approval'}`}>
                    <span className="dot" />
                    {agent.auto ? 'Runs automatically' : 'Requires approval'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--faint)', fontFamily: 'var(--mono)' }}>
                    {agent.schedule}
                  </span>
                </div>
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
          <h2>Put Maya and the agents<br />to work for your business.</h2>
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
