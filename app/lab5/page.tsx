'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { Metaballs } from '@paper-design/shaders-react'

declare global {
  interface Window {
    __initMockups?: () => void
  }
}

const FAQ_ITEMS = [
  {
    q: 'What exactly is Maya?',
    a: 'Maya is your AI marketing assistant. She drafts campaigns, writes social posts, handles follow-ups, watches competitors, and schedules content — all trained on your brand voice. You stay in control through an approval queue; nothing goes live until you say so.',
  },
  {
    q: 'Does the copy actually sound like me?',
    a: 'Yes. When you sign up, you complete a Brand Kit session where Maya learns your business, tone, and audience. Everything she creates draws from that — so it reads like you wrote it, not like software.',
  },
  {
    q: 'How does the approval flow work?',
    a: "Maya puts every piece of content into your queue before it goes anywhere. You review, approve, or request changes. She only ships what you've signed off on. You can approve on the go or batch-review at the end of the week.",
  },
  {
    q: 'What channels does Maya cover?',
    a: 'Email, Instagram, and Facebook on all plans. Scheduling across additional channels is available on Growth and ProAgent.',
  },
  {
    q: 'What happens after the 3-day trial?',
    a: 'Your card is collected at sign-up but not charged for the first 3 days. At the end of the trial, Starter billing begins at $49/month. You can cancel before day 4 and pay nothing.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your account settings at any time — no cancellation fees, no questions asked.',
  },
  {
    q: 'Is this right for a solo operator or small team?',
    a: "Yes — it's built for exactly that. Most users are single-person businesses or teams under five. Maya gives you the output of a marketing department without the overhead.",
  },
  {
    q: 'How is this different from a social media scheduling tool?',
    a: "Scheduling tools post content you've already created. Maya creates it — writes the copy, plans the calendar, runs the campaigns — then schedules it. She's a team, not a tool.",
  },
]

export default function Lab5Page() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

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
          <a className="brand" href="/">
            <img className="brand-logo" src="/agent7even_logo.svg" alt="Agent7even" />
          </a>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="/agents">Agents</a>
            <a href="/pricing">Pricing</a>
            <a href="/use-cases">Use cases</a>
          </div>
          <div className="nav-right">
            <a className="nav-signin" href="/sign-in">Sign in</a>
            <a className="btn btn-primary btn-sm" href="/sign-up">Sign up</a>
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
              <a className="btn btn-blue btn-lg" href="/pricing">Start your free trial</a>
              <a className="btn btn-ghost btn-lg" href="#how">See how it works →</a>
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
              <a href="#features">See it →</a>
            </div>
            <div className="lcard reveal">
              <div className="swatch" style={{ background: 'var(--orange)' }}></div>
              <h3>Competitor watch</h3>
              <p>Maya tracks your market and flags what rivals are running before it costs you the weekend.</p>
              <a href="#features">See it →</a>
            </div>
            <div className="lcard reveal">
              <div className="swatch" style={{ background: 'var(--green)' }}></div>
              <h3>Reputation loops</h3>
              <p>Reviews to answer, leads gone cold, follow-ups overdue — surfaced and ready, never dropped.</p>
              <a href="#features">See it →</a>
            </div>
            <div className="lcard reveal">
              <div className="swatch" style={{ background: 'var(--blue)' }}></div>
              <h3>One brand voice</h3>
              <p>Maya learns your business once and sounds like you everywhere you show up.</p>
              <a href="#how">See it →</a>
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

      {/* FAQ */}
      <section id="faq">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Questions</span>
            <h2 className="t-h2">Everything you need to know.</h2>
          </div>
          <div className="faq reveal">
            {FAQ_ITEMS.map(({ q, a }, i) => (
              <div key={q} className="faq-item">
                <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {q}
                  <span className={`faq-icon${openFaq === i ? ' open' : ''}`}>+</span>
                </button>
                {openFaq === i && <div className="faq-body"><p>{a}</p></div>}
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
          <h2>Work like you have a full<br />marketing team. Because now you do.</h2>
          <p>Hire Maya and spend your hours on the work only you can do.</p>
          <div className="cta-btns">
            <a className="btn btn-white btn-lg" href="/pricing">Start your free trial</a>
            <a className="btn btn-dark-ghost btn-lg" href="/pricing">See plans →</a>
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
              <p>The AI-first marketing platform for small business. Meet Maya.</p>
            </div>
            <div className="fcol">
              <h5>Product</h5>
              <a href="#how">How it works</a>
              <a href="#features">Features</a>
              <a href="/pricing">Pricing</a>
              <a href="/sign-up">Sign up</a>
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
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
            </div>
            <div className="fcol">
              <h5>Legal</h5>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
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
