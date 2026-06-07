'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { Metaballs } from '@paper-design/shaders-react'

declare global {
  interface Window {
    __initMockups?: () => void
  }
}

// Remaining agents shown in compact grid (the 4 above get full feature rows)
const BACKGROUND_AGENTS = [
  {
    id: 'performance_digest',
    name: 'Performance Digest',
    description: "Reads your connected data every morning and delivers a plain-English summary of what's working and what to act on.",
    bg: '#C5F9EC', fg: '#0F766E',
    auto: true, schedule: 'Daily at 7 am',
  },
  {
    id: 'trend_spotter',
    name: 'Trend Spotter',
    description: "Monitors industry trends and viral content in your niche daily, filtered for brand fit before they reach your queue.",
    bg: '#FFE3AD', fg: '#92400E',
    auto: true, schedule: 'Daily at 6 am',
  },
  {
    id: 'seo_scanner',
    name: 'SEO Scanner',
    description: 'Audits your website every week and surfaces improvements — from on-page basics to content gaps — matched to your market.',
    bg: '#AFDAF7', fg: '#075985',
    auto: true, schedule: 'Weekly on Monday',
  },
  {
    id: 'email_sequence_builder',
    name: 'Email Sequence Builder',
    description: 'Builds complete email flows — welcome, nurture, promotional — in your voice, ready to load into any ESP.',
    bg: '#EAE1F9', fg: '#6D28D9',
    auto: false, schedule: 'On your request',
  },
  {
    id: 'ad_variations',
    name: 'Ad Variations',
    description: 'Creates multiple ad options — headlines, body, CTAs — across formats so you can test without writing each one.',
    bg: '#E6F4AD', fg: '#3F6212',
    auto: false, schedule: 'On your request',
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
      <Script
        src="/lab5/mockups.js"
        strategy="afterInteractive"
        onLoad={() => requestAnimationFrame(() => window.__initMockups?.())}
      />

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
            <p className="t-lead">Nine specialized agents, live analytics, and one orchestrator who ties it all together. Here&rsquo;s exactly what each one does.</p>
          </div>
        </div>
      </section>

      {/* ── ANALYTICS ─────────────────────────────────────────────────── */}
      <section id="analytics">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Analytics</span>
            <h2 className="t-h2">See everything.<br />Understand anything.</h2>
            <p className="t-lead">Agent7even connects your social accounts, ad platforms, and inbox — then surfaces the signal you actually need, not a wall of charts.</p>
          </div>

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Performance overview</div>
              <h3 className="t-h3">One view of your whole marketing.</h3>
              <p className="t-body">Social analytics, ad spend and CTR, inbox volume, and campaign results — all connected, all readable in one dashboard. The Performance Digest agent reads it every morning and delivers a plain-English briefing before you start your day.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Social and ad performance across every connected channel</div>
                <div className="check"><i>✓</i>Daily AI summary of what&rsquo;s working and what to act on</div>
                <div className="check"><i>✓</i>Maya reads your analytics and adjusts what she recommends</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="dashboard"></div></div>
          </div>
        </div>
      </section>

      {/* ── MAYA ORCHESTRATOR ─────────────────────────────────────────── */}
      <section id="maya" style={{ paddingTop: 0 }}>
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
              <p>Maya isn&rsquo;t one of the nine agents — she&rsquo;s the intelligence layer above them. She reads your Foundation, monitors your context, and decides which agents to dispatch, when to run them, and what to do with their output. You talk to Maya in plain language; she handles the coordination. The agents just do their jobs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── AGENTS ────────────────────────────────────────────────────── */}
      <section id="agents" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">The nine agents</span>
            <h2 className="t-h2">Specialists, not generalists.</h2>
            <p className="t-lead">Each agent is built for exactly one job. Autonomous agents run on a schedule without asking — approval-required agents draft and wait for your sign-off before anything goes out.</p>
          </div>

          {/* Campaign Builder */}
          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Campaign Builder</div>
              <h3 className="t-h3">A full campaign from one sentence.</h3>
              <p className="t-body">Tell Maya what you want to promote. The Campaign Builder drafts the complete 30-day push — strategy, emails, social posts, ad copy, and timeline — and queues everything for your approval before a single thing goes out.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Strategy, copy, and calendar in one output</div>
                <div className="check"><i>✓</i>Covers email, social, and paid in a single run</div>
                <div className="check"><i>✓</i>You approve it all before anything goes live</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="campaign"></div></div>
          </div>
          <hr className="feat-rule" />

          {/* Weekly Content */}
          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">Weekly Content</div>
              <h3 className="t-h3">Your feed, drafted before the week starts.</h3>
              <p className="t-body">The Weekly Content agent plans your social calendar and writes every post in your voice. You review the week&rsquo;s content in one queue — approve the lot or edit line by line. Nothing posts until you say so.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Written from your Brand Kit, not a template</div>
                <div className="check"><i>✓</i>One approval session covers the whole week</div>
                <div className="check"><i>✓</i>Consistent even when you&rsquo;re too busy to think about it</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="calendar"></div></div>
          </div>
          <hr className="feat-rule" />

          {/* Approvals / Brand Voice Guardian */}
          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Approvals</div>
              <h3 className="t-h3">Nothing ships without your sign-off.</h3>
              <p className="t-body">Every agent that creates content runs it through the Brand Voice Guardian first — checking tone, brand fit, and compliance before it ever reaches your queue. You get a clean draft to approve, not a first draft to fix.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Brand Voice Guardian reviews every output before you see it</div>
                <div className="check"><i>✓</i>Approve, edit, or reject from one place</div>
                <div className="check"><i>✓</i>Maya never posts without a green light from you</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="approvals"></div></div>
          </div>
          <hr className="feat-rule" />

          {/* Competitor Watcher */}
          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">Competitor Watcher</div>
              <h3 className="t-h3">Know what your rivals are running.</h3>
              <p className="t-body">Every Monday, the Competitor Watcher surfaces what your competitors promoted last week — what channels, what offers, what messaging. You get the report before your week starts, not after you&rsquo;ve already reacted.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Promotions, content, and positioning tracked every week</div>
                <div className="check"><i>✓</i>Delivered Monday morning so you can respond, not react</div>
                <div className="check"><i>✓</i>Maya flags opportunities in your daily digest</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="competitor"></div></div>
          </div>
          <hr className="feat-rule" />

          {/* Remaining 5 agents */}
          <div className="sec-head reveal" style={{ marginTop: '60px' }}>
            <span className="eyebrow">Also running for you</span>
            <h2 className="t-h2" style={{ fontSize: 'clamp(22px,2.5vw,28px)' }}>Five more agents, always at work.</h2>
          </div>
          <div className="agent-grid">
            {BACKGROUND_AGENTS.map((agent) => (
              <div key={agent.id} className="agent-card reveal">
                <div className="agent-icon" style={{ background: agent.bg, color: agent.fg }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
                  </svg>
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
