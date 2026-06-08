'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { Metaballs } from '@paper-design/shaders-react'

declare global {
  interface Window {
    __initMockups?: () => void
    __initAgentMockups?: () => void
  }
}

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
        src="/lab5/agent-mockups.js"
        strategy="afterInteractive"
        onLoad={() => requestAnimationFrame(() => window.__initAgentMockups?.())}
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
      <header className="phero">
        <div className="wrap">
          <span className="eyebrow">The platform</span>
          <h1 className="t-display">The intelligence running<br />behind your marketing.</h1>
          <p className="t-lead">Nine specialized agents, live analytics, and one orchestrator who ties it all together. Here&rsquo;s exactly what each one does.</p>
        </div>
      </header>

      {/* ── ANALYTICS ─────────────────────────────────────────────────── */}
      <section id="analytics">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Analytics</span>
            <h2 className="t-h2">See everything.<br />Understand anything.</h2>
            <p className="t-lead">Agent7even connects your social accounts, ad platforms, and inbox — then surfaces the signal you actually need, not a wall of charts.</p>
          </div>

          {/* Connected sources strip */}
          <div className="sources reveal">
            <span className="lead-in">Connected</span>
            <div className="source"><span className="sd" style={{ background: 'var(--l5-brand)' }}></span><span>Instagram</span></div>
            <div className="source"><span className="sd" style={{ background: 'var(--l5-blue)' }}></span><span>Facebook</span></div>
            <div className="source"><span className="sd" style={{ background: 'var(--l5-green)' }}></span><span>Google</span></div>
            <div className="source"><span className="sd" style={{ background: 'var(--l5-amber)' }}></span><span>Mailchimp</span></div>
            <div className="source"><span className="sd" style={{ background: 'var(--l5-ink)' }}></span><span>Shopify</span></div>
            <div className="source"><span className="sd" style={{ background: 'var(--l5-orange)' }}></span><span>TikTok</span></div>
          </div>

          {/* Analytics feat row 1 */}
          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief"><span className="r-label">Performance overview</span></div>
              <h3 className="t-h3">One view of your whole marketing.</h3>
              <p className="t-body">Social, ad spend, email, and revenue — every connected channel in one place, readable in a glance. No tab-hopping, no exporting, no spreadsheets to stitch together.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Reach, engagement, and revenue across every channel</div>
                <div className="check"><i>✓</i>Attribution that connects the post to the sale</div>
                <div className="check"><i>✓</i>Updated continuously as the data comes in</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-am="analytics"></div></div>
          </div>
          <hr className="feat-rule" />

          {/* Analytics feat row 2 */}
          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief"><span className="r-label">The read on the numbers</span></div>
              <h3 className="t-h3">Charts don&rsquo;t tell you<br />what to do. Maya does.</h3>
              <p className="t-body">Every morning the Performance Digest reads your data and writes a plain-English briefing — what moved, why, and the one or two things worth acting on. The dashboard shows the numbers; Maya tells you what they mean.</p>
              <div className="checks">
                <div className="check"><i>✓</i>A daily summary in sentences, not dashboards</div>
                <div className="check"><i>✓</i>What&rsquo;s working and what to fix, ranked for you</div>
                <div className="check"><i>✓</i>Every insight comes with a next move you can approve</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-am="digest"></div></div>
          </div>
        </div>
      </section>

      {/* ── MAYA ORCHESTRATOR ─────────────────────────────────────────── */}
      <div className="orch reveal" style={{ marginBottom: '0' }}>
        <div className="orch-in">
          <div className="orch-orb">
            <Metaballs
              speed={0.8}
              count={8}
              size={0.3}
              scale={1}
              colors={['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE']}
              colorBack="#141418"
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>
          <div>
            <span className="eyebrow">Maya</span>
            <h2>The brain that<br />orchestrates the agents.</h2>
            <p>Maya isn&rsquo;t one of the nine agents — she&rsquo;s the intelligence layer above them. She reads your goals, watches your context, and decides which agents to run, when to run them, and what to do with their output. <b>You talk to Maya in plain language; she handles the coordination.</b> The agents just do their jobs.</p>
          </div>
        </div>
      </div>

      {/* ── THE NINE AGENTS ───────────────────────────────────────────── */}
      <section id="agents">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">The nine agents</span>
            <h2 className="t-h2">Specialists, not generalists.</h2>
            <p className="t-lead">Each agent is built for exactly one job. Agents marked <b style={{ color: '#0B815A' }}>runs automatically</b> work on a schedule without asking — agents marked <b style={{ color: '#1F6FEB' }}>requires approval</b> draft and wait for your sign-off before anything goes out.</p>
          </div>

          {/* Campaign Builder */}
          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">
                <span className="r-label">Campaign Builder</span>
                <span className="auto-badge appr"><span className="d"></span>Requires approval</span>
              </div>
              <h3 className="t-h3">A full campaign from one sentence.</h3>
              <p className="t-body">Tell Maya what you want to promote. The Campaign Builder drafts the complete push — strategy, emails, social posts, ad copy, and a timeline — and queues everything for your approval before a single thing goes out.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Strategy, copy, and calendar in a single output</div>
                <div className="check"><i>✓</i>Covers email, social, and paid in one run</div>
                <div className="check"><i>✓</i>You approve it all before anything goes live</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-am="campaignBuilder"></div></div>
          </div>
          <hr className="feat-rule" />

          {/* Weekly Content */}
          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">
                <span className="r-label">Weekly Content</span>
                <span className="auto-badge run"><span className="d"></span>Runs automatically</span>
              </div>
              <h3 className="t-h3">Your feed, drafted before<br />the week starts.</h3>
              <p className="t-body">Every Sunday the Weekly Content agent plans your social calendar and writes each post in your voice. You review the week in one queue — approve the lot or edit a line here and there. Nothing posts until you say so.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Written from your Brand Kit, not a template</div>
                <div className="check"><i>✓</i>One approval session covers the whole week</div>
                <div className="check"><i>✓</i>Consistent even when you&rsquo;re too busy to think about it</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-am="contentPlanner"></div></div>
          </div>
          <hr className="feat-rule" />

          {/* Brand Voice Guardian */}
          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">
                <span className="r-label">Brand Voice Guardian</span>
                <span className="auto-badge appr"><span className="d"></span>Reviews everything</span>
              </div>
              <h3 className="t-h3">Nothing ships without<br />your sign-off.</h3>
              <p className="t-body">Every piece of content runs through the Brand Voice Guardian first — checking tone, brand fit, and compliance before it ever reaches your queue. You get a clean draft to approve, not a first draft to fix.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Tone and brand fit scored on every output</div>
                <div className="check"><i>✓</i>Off-brand phrasing and risky claims flagged automatically</div>
                <div className="check"><i>✓</i>Maya never posts without a green light from you</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-am="voiceGuardian"></div></div>
          </div>
          <hr className="feat-rule" />

          {/* Competitor Watcher */}
          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">
                <span className="r-label">Competitor Watcher</span>
                <span className="auto-badge run"><span className="d"></span>Runs automatically</span>
              </div>
              <h3 className="t-h3">Know what your rivals<br />are running.</h3>
              <p className="t-body">Every Monday the Competitor Watcher surfaces what your competitors promoted last week — channels, offers, messaging. You get the report before your week starts, not after you&rsquo;ve already reacted.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Promotions, content, and positioning tracked weekly</div>
                <div className="check"><i>✓</i>Delivered Monday morning so you respond, not react</div>
                <div className="check"><i>✓</i>Maya drafts a counter-move the moment something lands</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-am="competitorBoard"></div></div>
          </div>
        </div>
      </section>

      {/* ── FIVE MORE AGENTS ──────────────────────────────────────────── */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Also running for you</span>
            <h2 className="t-h2">Five more agents,<br />always at work.</h2>
          </div>
          <div className="agents-grid">

            <div className="acard reveal">
              <div className="ico" style={{ background: '#EAF1FF', color: 'var(--l5-blue)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M6 21v-6M11 21V8M16 21v-4M21 21V5"/></svg>
              </div>
              <h3>Performance Digest</h3>
              <p>Reads your connected data every morning and delivers a plain-English summary of what&rsquo;s working and what to act on.</p>
              <div className="foot">
                <span className="auto-badge run"><span className="d"></span>Runs automatically</span>
                <span className="cadence">Daily &middot; 7am</span>
              </div>
            </div>

            <div className="acard reveal">
              <div className="ico" style={{ background: '#FFF3DF', color: '#9A6400' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l5-5 4 4 8-8M21 8h-4M21 8v4"/></svg>
              </div>
              <h3>Trend Spotter</h3>
              <p>Monitors industry trends and viral content in your niche, filtered for brand fit before anything reaches your queue.</p>
              <div className="foot">
                <span className="auto-badge run"><span className="d"></span>Runs automatically</span>
                <span className="cadence">Daily &middot; 6am</span>
              </div>
            </div>

            <div className="acard reveal">
              <div className="ico" style={{ background: '#E3F9F0', color: '#0B815A' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <h3>SEO Scanner</h3>
              <p>Audits your website every week and surfaces improvements — from on-page basics to content gaps matched to your market.</p>
              <div className="foot">
                <span className="auto-badge run"><span className="d"></span>Runs automatically</span>
                <span className="cadence">Weekly &middot; Mon</span>
              </div>
            </div>

            <div className="acard reveal">
              <div className="ico" style={{ background: '#FDE5F1', color: '#C01A77' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>
              </div>
              <h3>Email Sequence Builder</h3>
              <p>Builds complete email flows — welcome, nurture, promotional — in your voice, ready to load into any ESP.</p>
              <div className="foot">
                <span className="auto-badge appr"><span className="d"></span>Requires approval</span>
                <span className="cadence">On request</span>
              </div>
            </div>

            <div className="acard reveal">
              <div className="ico" style={{ background: '#EFE9FF', color: '#5B3FD4' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="11" height="6" rx="1.5"/><path d="M18 14h3M18 17h3M18 20h3"/></svg>
              </div>
              <h3>Ad Variations</h3>
              <p>Creates multiple ad options — headlines, body, CTAs — across formats so you can test without writing each one.</p>
              <div className="foot">
                <span className="auto-badge appr"><span className="d"></span>Requires approval</span>
                <span className="cadence">On request</span>
              </div>
            </div>

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
