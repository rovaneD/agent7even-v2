'use client'

import { useEffect, useState } from 'react'
import Metaballs from './SafeMetaballs'
import { trackEvent } from '@/lib/gtag'
import MarketingNav from './MarketingNav'
import MarketingFooter from './MarketingFooter'
import { useMockupScript } from './useMockupScript'

import { HOMEPAGE_FAQ_ITEMS } from '@/lib/marketing/homepageFaq'
import { HOW_IT_WORKS_STEPS } from '@/lib/marketing/howItWorksContent'
import { AI_VS_AGENCY_COMPARE } from '@/lib/marketing/aiVsAgencyContent'

declare global {
  interface Window {
    __initMockups?: () => void
  }
}

const FAQ_ITEMS = HOMEPAGE_FAQ_ITEMS

export default function Lab5Page() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  useMockupScript('/lab5/mockups.js', '__initMockups')

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

      {/* NAV */}
      <MarketingNav />

      {/* HERO */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">AI marketing platform for small business</p>
            <h1 className="hero-title">Marketing, managed.</h1>
            <p className="hero-lead">
              <span className="hero-lead-line"><em>Maya</em> plans campaigns, writes the content, and queues it for your approval,</span>
              <span className="hero-lead-line">generates images, video, and captions in your brand voice.</span>
              <span className="hero-lead-line">Nothing goes live without your&nbsp;approval.</span>
            </p>
            <p className="hero-tagline">The operating system for your marketing.</p>
            <p className="hero-pricing-hook">
              Not{' '}
              <a href="/pricing">agencies charging $3K/month for reports</a>
              {' '}— Starter from $49/mo with a 3-day trial.
            </p>
            <div className="hero-cta">
              <div className="hero-primary-stack">
                <a
                  className="btn btn-hero-primary btn-lg"
                  href="/pricing"
                  onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'hero' })}
                >
                  Start your free trial
                </a>
                <p className="hero-note">
                  3-day free trial.
                  <br />
                  No charge until day 4.
                </p>
              </div>
              <a
                className="btn btn-ghost btn-lg"
                href="#how"
                onClick={() => trackEvent('cta_click', { cta: 'see_how_it_works', location: 'hero_secondary' })}
              >
                See how it works →
              </a>
            </div>
          </div>
          <div className="hero-orb">
            <Metaballs
              speed={1}
              count={10}
              size={0.52}
              scale={1}
              colors={['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE']}
              colorBack="#00000000"
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>
        </div>
        <div className="wrap showpiece reveal">
          <div
            className="mk"
            data-mk="dashboard"
            role="img"
            aria-label="AI marketing strategist dashboard showing campaign planning and approval queue"
          />
        </div>
      </header>

      {/* TRUST STRIP */}
      <div className="strip">
        <div className="strip-in">
          <p>Built for solo operators and small teams</p>
          <div className="names">
            <span>3-day Starter trial</span>
            <span>Approval-first</span>
            <span>12 specialist agents</span>
          </div>
        </div>
      </div>

      {/* AI VS TRADITIONAL */}
      <section id="compare" className="compare-section">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">AI marketing vs traditional</span>
            <h2 className="t-h2">Strategy and execution — without the agency invoice.</h2>
            <p className="t-lead">
              Traditional marketing stacks tools, freelancers, and retainers. Agent7even gives you an AI marketing strategist plus twelve specialist agents — with an approval queue so nothing publishes without you.{' '}
              <a href="/ai-vs-agency">See the full AI vs agency comparison →</a>
            </p>
          </div>
          <div className="compare-grid reveal">
            <div className="compare-col compare-traditional">
              <h3>{AI_VS_AGENCY_COMPARE.traditional.title}</h3>
              <ul>
                {AI_VS_AGENCY_COMPARE.traditional.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="compare-col compare-agent7even">
              <h3>{AI_VS_AGENCY_COMPARE.agent7even.title}</h3>
              <ul>
                {AI_VS_AGENCY_COMPARE.agent7even.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">How it works</span>
            <h2 className="t-h2">One conversation. A week of marketing done.</h2>
            <p className="t-lead">
              No briefs, no tool-hopping. Tell Maya what you want and she takes it from idea to your approval queue — you stay in control.{' '}
              <a href="/how-it-works">See the full AI marketing automation workflow →</a>
            </p>
          </div>
          <div className="steps">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div key={step.n} className="step reveal">
                <div className="step-n">{step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE ROWS */}
      <section id="features" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">What the OS runs</span>
            <h2 className="t-h2">
              A world-class marketing team,
              <br />
              on&nbsp;call.
            </h2>
            <p className="t-lead">
              Planned, drafted, and queued for your approval —
              <br />
              while you run the&nbsp;business.{' '}
              <a href="/agents">See our AI marketing automation features →</a>
            </p>
          </div>

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Campaigns</div>
              <h3 className="t-h3">Your week, promoted.</h3>
              <p className="t-body">You say the offer. The Campaign Builder drafts the full push — strategy, email copy, social posts, ad variations, and a timeline — ready for your approval.</p>
              <div className="checks">
                <div className="check"><i>✓</i>30-day plan in a single run</div>
                <div className="check"><i>✓</i>Email, social, and ad copy drafted together</div>
                <div className="check"><i>✓</i>You approve before anything goes live</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="campaign"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">Creative</div>
              <h3 className="t-h3">Images and video, on-brand.</h3>
              <p className="t-body">Generate post images in your brand style, short-form video, and captions that match what&rsquo;s in the frame — not generic stock.</p>
              <div className="checks">
                <div className="check"><i>✓</i>AI images from your Brand Kit and Foundation</div>
                <div className="check"><i>✓</i>Reads your image and writes the caption</div>
                <div className="check"><i>✓</i>Every asset waits in your approval queue</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="calendar"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Content</div>
              <h3 className="t-h3">The feed, handled.</h3>
              <p className="t-body">Your social presence stays alive even on your busiest weeks. Maya drafts posts and captions in your voice — queued for approval, not auto-posted.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Posts written the way you&rsquo;d write them</div>
                <div className="check"><i>✓</i>Queued for your approval — you choose when to publish</div>
                <div className="check"><i>✓</i>Consistent even when life isn&rsquo;t</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="approvals"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">SEO</div>
              <h3 className="t-h3">Your site, audited.</h3>
              <p className="t-body">The SEO Scanner reads your live pages and flags title, meta, and content gaps you can fix — grounded in your Foundation, not generic checklists.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Live homepage and key page snapshot</div>
                <div className="check"><i>✓</i>Prioritized fixes for small teams</div>
                <div className="check"><i>✓</i>Runs on your saved website URL</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="watch"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">Competitors</div>
              <h3 className="t-h3">The market, understood.</h3>
              <p className="t-body">Competitive reports grounded in your Foundation — actionable briefings you can respond to, not a live spy feed.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Weekly competitor briefings from your positioning</div>
                <div className="check"><i>✓</i>Trend reports filtered for your brand</div>
                <div className="check"><i>✓</i>You decide what to act on</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="competitor"></div></div>
          </div>

          <p className="agents-bridge reveal">
            Plus marketing intelligence, SEO, and email — twelve specialist agents in all.{' '}
            <a href="/agents">Explore our AI marketing agents</a>
            {' · '}
            <a href="/pricing">View transparent pricing</a>
          </p>
        </div>
      </section>

      {/* ALWAYS-ON LAYER */}
      <section className="layer">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Always on</span>
            <h2 className="t-h2">
              The marketing layer
              <br />
              that never&nbsp;sleeps.
            </h2>
          </div>
          <div className="cards">
            <div className="lcard reveal">
              <div className="lcard-copy">
                <h3>Campaigns on command</h3>
                <p>Tell Maya the offer; get the full sequence — emails, posts, ad variations — ready to approve.</p>
                <a href="#features">See it →</a>
              </div>
              <div className="card-widget"><div data-mk="widget-campaign"></div></div>
            </div>
            <div className="lcard reveal">
              <div className="lcard-copy">
                <h3>Competitor reports</h3>
                <p>Competitive briefings from your Foundation — so you know what to respond to.</p>
                <a href="#features">See it →</a>
              </div>
              <div className="card-widget"><div data-mk="widget-competitor"></div></div>
            </div>
            <div className="lcard reveal">
              <div className="lcard-copy">
                <h3>Nothing goes live without you</h3>
                <p>Every post, email, and campaign artifact lands in your queue. Review, edit, approve — then publish when you&rsquo;re ready.</p>
                <a href="#how">See it →</a>
              </div>
              <div className="card-widget"><div data-mk="widget-approvals"></div></div>
            </div>
            <div className="lcard reveal">
              <div className="lcard-copy">
                <h3>One brand voice</h3>
                <p>Maya learns your business once and sounds like you everywhere you show up.</p>
                <a href="#how">See it →</a>
              </div>
              <div className="card-widget"><div data-mk="widget-voice"></div></div>
            </div>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section id="uses">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Built for the way you work</span>
            <h2 className="t-h2">Built for your kind of business.</h2>
            <p className="t-lead">
              See how our AI marketing strategist works for{' '}
              <a href="/use-cases/local-service">local service businesses</a>,{' '}
              <a href="/use-cases/coaches-creators">coaches and creators</a>, and{' '}
              <a href="/use-cases/ecommerce">e-commerce brands</a>.
            </p>
          </div>
          <div className="uses">
            <a className="use reveal" href="/use-cases/ecommerce">
              <div className="use-copy">
                <h3>E-commerce brands</h3>
                <p>The store stops going quiet between launches.</p>
                <span className="use-link">See it →</span>
              </div>
              <div className="card-widget"><div data-mk="widget-use-ecommerce"></div></div>
            </a>
            <a className="use reveal" href="/use-cases/local-service">
              <div className="use-copy">
                <h3>Local service</h3>
                <p>Stay visible without staying up late.</p>
                <span className="use-link">See it →</span>
              </div>
              <div className="card-widget"><div data-mk="widget-use-local"></div></div>
            </a>
            <a className="use reveal" href="/use-cases/coaches-creators">
              <div className="use-copy">
                <h3>Creators &amp; founders</h3>
                <p>Finally be in two places at once.</p>
                <span className="use-link">See it →</span>
              </div>
              <div className="card-widget"><div data-mk="widget-use-creators"></div></div>
            </a>
            <a className="use reveal" href="/use-cases/startups">
              <div className="use-copy">
                <h3>Startups</h3>
                <p>Launch-ready GTM before you can hire marketing.</p>
                <span className="use-link">See it →</span>
              </div>
              <div className="card-widget"><div data-mk="widget-use-startups"></div></div>
            </a>
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
                <button className="faq-q" onClick={() => {
                  if (openFaq !== i) trackEvent('faq_open', { question: q, location: 'landing' })
                  setOpenFaq(openFaq === i ? null : i)
                }}>
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
          <h2>Work like you have a full<br />marketing team.</h2>
          <p>Meet Maya and twelve specialist agents — spend your hours on the work only you can do.</p>
          <div className="cta-btns">
            <a className="btn btn-white btn-lg" href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'footer_cta' })}>Start your free trial</a>
            <a className="btn btn-dark-ghost btn-lg" href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'see_plans', location: 'footer_cta' })}>See plans →</a>
          </div>
          <p className="cta-note">3-day free trial. No charge until day 4.</p>
        </div>
      </div>

      <MarketingFooter />
    </div>
  )
}
