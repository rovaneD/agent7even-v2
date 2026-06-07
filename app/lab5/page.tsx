'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { Metaballs } from '@paper-design/shaders-react'

declare global {
  interface Window {
    __initMockups?: () => void
  }
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l4.5 4.5L19 7" />
    </svg>
  )
}

export default function Lab5Page() {
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
      <Script
        src="/lab5/mockups.js"
        strategy="afterInteractive"
        onLoad={() => {
          requestAnimationFrame(() => window.__initMockups?.())
        }}
      />

      {/* NAV */}
      <nav className="nav">
        <div className="nav-in">
          <a className="brand" href="#">
            <span className="brand-mark">7</span>
            <span className="brand-name">AGENT<b>7</b>EVEN</span>
          </a>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#uses">Use cases</a>
          </div>
          <div className="nav-right">
            <a className="nav-signin" href="#">Sign in</a>
            <button className="btn btn-primary btn-sm">Get access</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="pill"><span className="live-dot"></span>AI marketing platform for small business</span>
            <h1 className="t-display">Meet <em>Maya</em>, the<br />marketing team that<br />never clocks out.</h1>
            <p className="t-lead">Campaigns planned, copy drafted, content posted — in your voice, approved by you. She runs the marketing while you run the business.</p>
            <p className="hero-tag">No agency. No busywork. No missed momentum.</p>
            <div className="hero-cta">
              <button className="btn btn-blue btn-lg">Get access</button>
              <button className="btn btn-ghost btn-lg">See how it works →</button>
            </div>
          </div>
          <div className="hero-orb">
            <Metaballs
              speed={1}
              count={10}
              size={0.36}
              scale={1}
              colors={['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE']}
              colorBack="#00000000"
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>
        </div>
        <div className="wrap showpiece reveal">
          <div className="mk" data-mk="dashboard"></div>
        </div>
      </header>

      {/* TRUST STRIP */}
      <div className="strip">
        <div className="strip-in">
          <p>Trusted by independent brands &amp; solo founders</p>
          <div className="names">
            <span>Ember Coffee</span>
            <span>Field Goods</span>
            <span>Atlas Studio</span>
            <span>Maker &amp; Co.</span>
            <span>Northline</span>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section id="how">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">How it works</span>
            <h2 className="t-h2">One conversation. A week of marketing done.</h2>
            <p className="t-lead">No briefs, no tool-hopping. Tell Maya what you want and she takes it from idea to scheduled — you stay in approval.</p>
          </div>
          <div className="steps">
            <div className="step reveal">
              <div className="step-n">01</div>
              <h3>Tell her what you want</h3>
              <p>&ldquo;Promote the Friday slot.&rdquo; &ldquo;We&rsquo;ve gone quiet — fix it.&rdquo; Maya already knows your business and gets to work.</p>
            </div>
            <div className="step reveal">
              <div className="step-n">02</div>
              <h3>She drafts it in your voice</h3>
              <p>Emails, posts and offers — built from what Maya knows about your brand. One voice, every channel.</p>
            </div>
            <div className="step reveal">
              <div className="step-n">03</div>
              <h3>You approve, she ships</h3>
              <p>Nothing goes live until you say so. Review the queue, approve what&rsquo;s right, and Maya makes it happen.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE ROWS */}
      <section id="features" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">What Maya runs</span>
            <h2 className="t-h2">A world-class marketing team, on call.</h2>
            <p className="t-lead">Over eight hours a week of marketing work — planned, drafted, scheduled and sent — while you keep the lights on.</p>
          </div>

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Campaigns</div>
              <h3 className="t-h3">Your week, promoted.</h3>
              <p className="t-body">You say the offer. Maya builds the full push — email, posts, captions — and has it ready before you close your laptop.</p>
              <div className="checks">
                <div className="check"><i>✓</i>The campaign drafted while you were on the floor</div>
                <div className="check"><i>✓</i>Every channel covered — nothing left to figure out</div>
                <div className="check"><i>✓</i>Ready to approve, not ready to start from scratch</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="campaign"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">Content</div>
              <h3 className="t-h3">The feed, handled.</h3>
              <p className="t-body">Your social presence stays alive even on your busiest weeks. Maya posts in your voice, so it always sounds like you — not like software.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Posts written the way you&rsquo;d write them</div>
                <div className="check"><i>✓</i>Scheduled and out without touching a tool</div>
                <div className="check"><i>✓</i>Consistent even when life isn&rsquo;t</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="calendar"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Follow-up</div>
              <h3 className="t-h3">The leads, still warm.</h3>
              <p className="t-body">The inquiry from Tuesday. The customer you meant to win back. The review that deserved a reply. Maya catches what slips through.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Cold leads followed up before they go cold for good</div>
                <div className="check"><i>✓</i>Reviews answered in your voice, same day</div>
                <div className="check"><i>✓</i>Nothing dropped because you were heads-down</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="approvals"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">Competitors</div>
              <h3 className="t-h3">The market, watched.</h3>
              <p className="t-body">Maya tracks what your competitors are running, so you&rsquo;re never the last to know — and never caught flat-footed on a Monday.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Rival promotions flagged before they cost you</div>
                <div className="check"><i>✓</i>Trends surfaced before they peak</div>
                <div className="check"><i>✓</i>You move first, not in reaction</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="competitor"></div></div>
          </div>
        </div>
      </section>

      {/* ALWAYS-ON LAYER */}
      <section className="layer">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Always on</span>
            <h2 className="t-h2">The marketing layer that never sleeps.</h2>
          </div>
          <div className="cards">
            <div className="lcard reveal">
              <div className="swatch" style={{ background: 'var(--brand)' }}></div>
              <h3>Campaigns on command</h3>
              <p>Tell Maya the offer; get the full sequence — emails, posts, the whole push — ready to approve.</p>
              <a href="#">See it →</a>
            </div>
            <div className="lcard reveal">
              <div className="swatch" style={{ background: 'var(--orange)' }}></div>
              <h3>Competitor watch</h3>
              <p>Maya tracks your market and flags what rivals are running before it costs you the weekend.</p>
              <a href="#">See it →</a>
            </div>
            <div className="lcard reveal">
              <div className="swatch" style={{ background: 'var(--green)' }}></div>
              <h3>Reputation loops</h3>
              <p>Reviews to answer, leads gone cold, follow-ups overdue — surfaced and ready, never dropped.</p>
              <a href="#">See it →</a>
            </div>
            <div className="lcard reveal">
              <div className="swatch" style={{ background: 'var(--blue)' }}></div>
              <h3>One brand voice</h3>
              <p>Maya learns your business once and sounds like you everywhere you show up.</p>
              <a href="#">See it →</a>
            </div>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section id="uses">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Built for the way you work</span>
            <h2 className="t-h2">Maya fits your kind of business.</h2>
          </div>
          <div className="uses">
            <div className="use reveal">
              <div className="ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8h16l-1 12H5L4 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />
                </svg>
              </div>
              <h3>E-commerce brands</h3>
              <p>The store stops going quiet between launches.</p>
            </div>
            <div className="use reveal">
              <div className="ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" />
                </svg>
              </div>
              <h3>Local service</h3>
              <p>Stay visible without staying up late.</p>
            </div>
            <div className="use reveal">
              <div className="ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
                </svg>
              </div>
              <h3>Creators &amp; founders</h3>
              <p>Finally be in two places at once.</p>
            </div>
            <div className="use reveal">
              <div className="ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 21V5l8-2v18M12 21V8l8 2v11M3 21h18M8 8h0M8 12h0M16 13h0M16 17h0" />
                </svg>
              </div>
              <h3>Agencies</h3>
              <p>The production capacity you&rsquo;d otherwise hire.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Pricing</span>
            <h2 className="t-h2">Less than a freelancer. More than a team.</h2>
            <p className="t-lead">Start free. Upgrade when Maya&rsquo;s pulling her weight — which is usually week one.</p>
          </div>
          <div className="price-grid">
            <div className="tier reveal">
              <div className="tname">Starter</div>
              <div className="tdesc">For getting your first campaigns out the door.</div>
              <div className="tprice">$0<span> / month</span></div>
              <ul className="tlist">
                <li><CheckIcon />1 campaign at a time</li>
                <li><CheckIcon />Maya chat + canvas</li>
                <li><CheckIcon />Approval queue</li>
              </ul>
              <button className="btn btn-ghost">Start free</button>
            </div>
            <div className="tier featured reveal">
              <div className="badge">Most popular</div>
              <div className="tname">Growth</div>
              <div className="tdesc">For businesses that want the marketing fully run.</div>
              <div className="tprice">$149<span> / month</span></div>
              <ul className="tlist">
                <li><CheckIcon />Unlimited campaigns &amp; content</li>
                <li><CheckIcon />Competitor watch + follow-ups</li>
                <li><CheckIcon />Scheduling across every channel</li>
                <li><CheckIcon />Brand-voice training</li>
              </ul>
              <button className="btn btn-primary">Get access</button>
            </div>
            <div className="tier reveal">
              <div className="tname">Studio</div>
              <div className="tdesc">For agencies running Maya across many clients.</div>
              <div className="tprice">Custom</div>
              <ul className="tlist">
                <li><CheckIcon />Multiple brand workspaces</li>
                <li><CheckIcon />Team roles &amp; approvals</li>
                <li><CheckIcon />Priority support</li>
              </ul>
              <button className="btn btn-ghost">Talk to us</button>
            </div>
          </div>
        </div>
      </section>

      {/* DARK CTA */}
      <div className="cta reveal">
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
          <p>Hire Maya and spend your hours on the work only you can do.</p>
          <div className="cta-btns">
            <button className="btn btn-white btn-lg">Get access</button>
            <button className="btn btn-dark-ghost btn-lg">See use cases</button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-in">
          <div className="footer-top">
            <div className="footer-brand">
              <a className="brand" href="#">
                <span className="brand-mark">7</span>
                <span className="brand-name">AGENT<b>7</b>EVEN</span>
              </a>
              <p>The AI-first marketing platform for small business. Meet Maya.</p>
            </div>
            <div className="fcol">
              <h5>Product</h5>
              <a href="#">Maya</a>
              <a href="#">Campaigns</a>
              <a href="#">Canvas</a>
              <a href="#">Pricing</a>
            </div>
            <div className="fcol">
              <h5>Use cases</h5>
              <a href="#">E-commerce</a>
              <a href="#">Local service</a>
              <a href="#">Creators</a>
              <a href="#">Agencies</a>
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
