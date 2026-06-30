'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import Metaballs from '../SafeMetaballs'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'

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

      <MarketingNav active="agents" />

      <header className="phero">
        <div className="wrap">
          <span className="eyebrow">The platform</span>
          <h1 className="t-display">The intelligence running<br />behind your marketing.</h1>
          <p className="t-lead">Twelve specialist agents, marketing intelligence when you connect your accounts, and Maya orchestrating them all. Here&rsquo;s what each one does — and what runs automatically vs. what waits for your approval.</p>
        </div>
      </header>

      {/* ── MARKETING INTELLIGENCE ─────────────────────────────────────── */}
      <section id="analytics">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Marketing intelligence</span>
            <h2 className="t-h2">Know what&rsquo;s working.<br />Act on what matters.</h2>
            <p className="t-lead">Connect Google Analytics and your social accounts — then see reach, engagement, and traffic in one place, with plain-English briefings from the Performance Digest.</p>
          </div>

          <div className="sources reveal">
            <span className="lead-in">Connect via Agent7even</span>
            <div className="source"><span className="sd" style={{ background: 'var(--l5-brand)' }}></span><span>Instagram</span></div>
            <div className="source"><span className="sd" style={{ background: 'var(--l5-blue)' }}></span><span>Facebook</span></div>
            <div className="source"><span className="sd" style={{ background: 'var(--l5-ink)' }}></span><span>LinkedIn</span></div>
            <div className="source"><span className="sd" style={{ background: '#111' }}></span><span>X (Growth+)</span></div>
            <div className="source"><span className="sd" style={{ background: '#FF0000' }}></span><span>YouTube</span></div>
            <div className="source"><span className="sd" style={{ background: 'var(--l5-green)' }}></span><span>Google Analytics</span></div>
          </div>
          <p className="t-body reveal" style={{ marginTop: '1rem', maxWidth: '42rem', color: 'var(--l5-muted, #64748B)', fontSize: '0.875rem' }}>
            Instagram, Facebook, LinkedIn, and YouTube on every plan. X / Twitter connect requires Growth or ProAgent.
          </p>

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief"><span className="r-label">Performance overview</span></div>
              <h3 className="t-h3">One view of connected marketing.</h3>
              <p className="t-body">Social and site analytics from the accounts you connect — readable in a glance when GA and social are linked. No tab-hopping, no exporting spreadsheets.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Reach, engagement, and traffic from connected accounts</div>
                <div className="check"><i>✓</i>Performance Digest turns numbers into next actions</div>
                <div className="check"><i>✓</i>Updated as your connected data comes in</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-am="analytics"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief"><span className="r-label">The read on the numbers</span></div>
              <h3 className="t-h3">Charts don&rsquo;t tell you<br />what to do. Maya does.</h3>
              <p className="t-body">The Performance Digest agent reads your connected data and writes a plain-English briefing — what moved, why, and the one or two things worth acting on. The dashboard shows the numbers; the agent tells you what they mean.</p>
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
            <p>Maya isn&rsquo;t one of the twelve agents — she&rsquo;s the intelligence layer above them. She reads your goals and Foundation, decides which agents to run, and routes output to your approval queue. <b>Brand Voice Guardian</b> is a separate agent when you want a dedicated tone check — not an automatic step on every draft. You talk to Maya in plain language; she runs the team.</p>
          </div>
        </div>
      </div>

      <section id="agents">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">The twelve agents</span>
            <h2 className="t-h2">Specialists, not generalists.</h2>
            <p className="t-lead">Each agent is built for exactly one job. Agents marked <b style={{ color: '#0B815A' }}>runs automatically</b> work on a schedule when you enable them — agents marked <b style={{ color: '#1F6FEB' }}>requires approval</b> draft and wait for your sign-off before anything goes out.</p>
          </div>

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">
                <span className="r-label">Content Posting</span>
                <span className="auto-badge appr"><span className="d"></span>Requires approval</span>
              </div>
              <h3 className="t-h3">Posts, captions, and weekly plans.</h3>
              <p className="t-body">Single posts with image-aware captions, or a full week of content. Generate images in your brand style, short video, or attach your own — everything lands in your approval queue. Nothing publishes until you say so.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Reads your image and writes the caption</div>
                <div className="check"><i>✓</i>Generates on-brand images and short video</div>
                <div className="check"><i>✓</i>Weekly content plans in one approval session</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-am="contentPlanner"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">
                <span className="r-label">Campaign Builder</span>
                <span className="auto-badge appr"><span className="d"></span>Requires approval</span>
              </div>
              <h3 className="t-h3">A full campaign from one sentence.</h3>
              <p className="t-body">Tell Maya what you want to promote. The Campaign Builder drafts a 30-day plan — strategy, email copy, social posts, ad variations, and a timeline — ready for your approval. You produce assets from the plan when you&rsquo;re ready.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Strategy, copy, and calendar in a single output</div>
                <div className="check"><i>✓</i>Covers email, social, and ad copy in one run</div>
                <div className="check"><i>✓</i>You approve before anything goes live</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-am="campaignBuilder"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">
                <span className="r-label">Competitor Watcher</span>
                <span className="auto-badge run"><span className="d"></span>Runs automatically</span>
              </div>
              <h3 className="t-h3">Competitive reports<br />from your Foundation.</h3>
              <p className="t-body">On a weekly schedule, the Competitor Watcher delivers competitive briefings grounded in your positioning — actionable reports, not a live metrics feed.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Weekly competitive read you can respond to</div>
                <div className="check"><i>✓</i>Delivered on schedule when enabled</div>
                <div className="check"><i>✓</i>You decide what counter-moves to run</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-am="competitorBoard"></div></div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Also in the roster</span>
            <h2 className="t-h2">The rest of the roster —<br />each with one job.</h2>
          </div>
          <div className="agents-grid">

            <div className="acard reveal">
              <div className="ico" style={{ background: '#EAF1FF', color: 'var(--l5-blue)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M6 21v-6M11 21V8M16 21v-4M21 21V5"/></svg>
              </div>
              <h3>Performance Digest</h3>
              <p>Reads your connected data and delivers a plain-English summary of what&rsquo;s working and what to act on.</p>
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
              <p>Trend reports for your niche, filtered for brand fit before anything reaches your queue.</p>
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
              <p>Scans your site and advises on fixes — on-page basics and content gaps matched to your market.</p>
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
              <p>Drafts complete email flows — welcome, nurture, promotional — ready to load into any ESP.</p>
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
              <p>Writes ad variations to test — headlines, body, CTAs — not live ad campaigns.</p>
              <div className="foot">
                <span className="auto-badge appr"><span className="d"></span>Requires approval</span>
                <span className="cadence">On request</span>
              </div>
            </div>

            <div className="acard reveal">
              <div className="ico" style={{ background: '#FEF3C7', color: '#B45309' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/></svg>
              </div>
              <h3>Idea Analysis</h3>
              <p>Breaks one content idea into angles grounded in your Foundation — structured output for hooks and campaigns.</p>
              <div className="foot">
                <span className="auto-badge appr"><span className="d"></span>Requires approval</span>
                <span className="cadence">On request</span>
              </div>
            </div>

            <div className="acard reveal">
              <div className="ico" style={{ background: '#E2F7F2', color: '#065F46' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
              <h3>Brand Voice Guardian</h3>
              <p>Reviews specific content against your Brand Kit — flags tone, vocabulary, and risky claims with suggested fixes.</p>
              <div className="foot">
                <span className="auto-badge run"><span className="d"></span>Runs automatically</span>
                <span className="cadence">On schedule</span>
              </div>
            </div>

            <div className="acard reveal">
              <div className="ico" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              </div>
              <h3>Post Caption</h3>
              <p>Single-post caption writer — attach an image and get a caption that matches what&rsquo;s in the frame.</p>
              <div className="foot">
                <span className="auto-badge appr"><span className="d"></span>Requires approval</span>
                <span className="cadence">Folded into Content Posting</span>
              </div>
            </div>

            <div className="acard reveal">
              <div className="ico" style={{ background: '#C5EFF9', color: '#0369A1' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </div>
              <h3>Weekly Content</h3>
              <p>Plans a week of posts and emails — copy only, approval-required. Run from Content Posting in your Command Center.</p>
              <div className="foot">
                <span className="auto-badge appr"><span className="d"></span>Requires approval</span>
                <span className="cadence">Folded into Content Posting</span>
              </div>
            </div>

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
        <div className="cta-in reveal">
          <h2>Put Maya and the agents<br />to work for your business.</h2>
          <p>Start your 3-day free trial. No charge until day 4.</p>
          <div className="cta-btns">
            <a className="btn btn-white btn-lg" href="/pricing">Start your free trial</a>
            <a className="btn btn-dark-ghost btn-lg" href="/pricing">See plans →</a>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  )
}
