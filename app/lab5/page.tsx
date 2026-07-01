'use client'

import { useEffect, useState } from 'react'
import Metaballs from './SafeMetaballs'
import { trackEvent } from '@/lib/gtag'
import MarketingNav from './MarketingNav'
import MarketingFooter from './MarketingFooter'
import { useMockupScript } from './useMockupScript'

import { HOMEPAGE_FAQ_ITEMS } from '@/lib/marketing/homepageFaq'
import HowItWorksSteps from '@/components/marketing/HowItWorksSteps'
import StackCompareSection from '@/components/marketing/StackCompareSection'
import CreativeShowcase from '@/components/marketing/CreativeShowcase'

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
            <p className="eyebrow">From idea to approval queue, without switching tools.</p>
            <h1 className="hero-title">Marketing, managed.</h1>
            <p className="hero-lead">
              <span className="hero-lead-line"><em>Maya</em> plans campaigns, writes the content, and queues it for your approval,</span>
              <span className="hero-lead-line">every image, caption, and email pulls from your Brand Kit.</span>
              <span className="hero-lead-line">Nothing goes live without your&nbsp;approval.</span>
            </p>
            <p className="hero-tagline">One Foundation. Twelve specialist agents. One approval queue.</p>
            <div className="hero-cta">
              <div className="hero-cta-row">
                <a
                  className="btn btn-hero-primary btn-lg"
                  href="/pricing"
                  onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'hero' })}
                >
                  Start your free trial
                </a>
                <a
                  className="btn btn-ghost btn-lg"
                  href="#how"
                  onClick={() => trackEvent('cta_click', { cta: 'see_how_it_works', location: 'hero_secondary' })}
                >
                  See how it works →
                </a>
              </div>
              <p className="hero-note">3-day free trial. No charge until day 4.</p>
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
          <p>How the system works</p>
          <div className="names">
            <span>Foundation once</span>
            <span>Approval-first</span>
            <span>12 specialist agents</span>
          </div>
        </div>
      </div>

      <StackCompareSection />

      {/* HOW IT WORKS */}
      <section id="how">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">How it works</span>
            <h2 className="t-h2">
              Tell <em>Maya</em> the goal. Agents draft from Foundation.
              <br />
              You approve once.
            </h2>
            <p className="t-lead">
              No briefs, no tool-hopping. Maya reads your Foundation and Brand Kit, coordinates specialist agents, and routes every draft to your approval queue.{' '}
              <a href="/how-it-works">See the full AI marketing automation workflow →</a>
            </p>
          </div>
          <HowItWorksSteps />
        </div>
      </section>

      {/* FEATURE ROWS */}
      <section id="features" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">What the agents run</span>
            <h2 className="t-h2">
              Twelve specialists.
              <br />
              One shared Foundation.
            </h2>
            <p className="t-lead">
              Every agent reads Foundation and Brand Kit before drafting — campaigns, creative, posts, and reports land in one approval queue.{' '}
              <a href="/agents">See our AI marketing automation features →</a>
            </p>
          </div>

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Campaigns</div>
              <h3 className="t-h3">Campaign Builder reads Foundation first.</h3>
              <p className="t-body">You name the offer. The Campaign Builder pulls from your Foundation and Brand Kit, then drafts strategy, email copy, social posts, ad variations, and a timeline — all routed to your approval queue.</p>
              <div className="checks">
                <div className="check"><i>✓</i>30-day plan drafted from your saved positioning</div>
                <div className="check"><i>✓</i>Email, social, and ad copy generated in one run</div>
                <div className="check"><i>✓</i>Nothing publishes until you approve from the queue</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="campaign"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">Creative</div>
              <h3 className="t-h3">Every image uses your saved colors, style, and creative direction.</h3>
              <p className="t-body">Creative agents pull palette, tone, and scene direction from Brand Kit and Foundation — then generate post images and Reels, with captions written from what&rsquo;s actually in the frame.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Colors, style, and scene direction pulled from your brand</div>
                <div className="check"><i>✓</i>Captions written after reading the image — not a blank template</div>
                <div className="check"><i>✓</i>You approve every asset before it can publish</div>
              </div>
            </div>
            <div className="feat-visual"><CreativeShowcase /></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Content</div>
              <h3 className="t-h3">
                Next week&apos;s posts queue before
                <br />
                the week&nbsp;starts.
              </h3>
              <p className="t-body">The Content Posting agent drafts from your Foundation and Brand Kit — posts land in your queue for approval, not on your feed automatically.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Captions drafted after reading Foundation and Brand Kit</div>
                <div className="check"><i>✓</i>Queued for your approval — you choose when to publish</div>
                <div className="check"><i>✓</i>Same source context every week — no re-briefing</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="approvals"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">SEO</div>
              <h3 className="t-h3">SEO Scanner reads your live site URL.</h3>
              <p className="t-body">The agent snapshots your homepage and key pages, compares them to your Foundation positioning, and flags title, meta, and content gaps — not generic checklists.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Live homepage and key page snapshot</div>
                <div className="check"><i>✓</i>Prioritized fixes for small teams</div>
                <div className="check"><i>✓</i>Runs on your saved website URL</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="seo"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Competitors</div>
              <h3 className="t-h3">
                Competitive reports pull from
                <br />
                your Foundation.
              </h3>
              <p className="t-body">The Competitor Analysis agent drafts briefings from your saved positioning and market context — actionable reports you can respond to, not a live spy feed.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Weekly competitor briefings from your positioning</div>
                <div className="check"><i>✓</i>Trend reports filtered for your brand</div>
                <div className="check"><i>✓</i>You decide what to act on</div>
              </div>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="competitor"></div></div>
          </div>

          <p className="agents-bridge reveal">
            Marketing intelligence, SEO, and email agents run on the same Foundation and approval queue.
            <br />
            <a href="/agents">Explore our AI marketing agents</a>
            {' · '}
            <a href="/pricing">View transparent&nbsp;pricing</a>
          </p>
        </div>
      </section>

      {/* ALWAYS-ON LAYER */}
      <section className="layer">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Always on</span>
            <h2 className="t-h2">
              Tomorrow&apos;s marketing
              <br />
              is already waiting.
            </h2>
          </div>
          <div className="cards">
            <div className="lcard reveal">
              <div className="lcard-copy">
                <h3>Campaigns from Foundation</h3>
                <p>Name the offer — Campaign Builder drafts emails, posts, and ad variations from your saved context, then routes them to your queue.</p>
                <a href="#features">See it →</a>
              </div>
              <div className="card-widget"><div data-mk="widget-campaign"></div></div>
            </div>
            <div className="lcard reveal">
              <div className="lcard-copy">
                <h3>Competitor reports from Foundation</h3>
                <p>Competitor Analysis agent drafts briefings from your positioning — you decide what to act on.</p>
                <a href="#features">See it →</a>
              </div>
              <div className="card-widget"><div data-mk="widget-competitor"></div></div>
            </div>
            <div className="lcard reveal">
              <div className="lcard-copy">
                <h3>Approval queue before publish</h3>
                <p>Every post, email, and campaign artifact lands in one queue. Review, edit, approve — then publish when you&rsquo;re ready.</p>
                <a href="#how">See it →</a>
              </div>
              <div className="card-widget"><div data-mk="widget-approvals"></div></div>
            </div>
            <div className="lcard reveal">
              <div className="lcard-copy">
                <h3>One Foundation, every channel</h3>
                <p>Every email, post, and caption starts from the same Foundation and Brand Kit — not a fresh prompt each time.</p>
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
            <h2 className="t-h2">Marketing built around how your business actually sells.</h2>
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
                <p>Campaign and post drafts queue from Foundation between launches — you approve before anything publishes.</p>
                <span className="use-link">See it →</span>
              </div>
              <div className="card-widget"><div data-mk="widget-use-ecommerce"></div></div>
            </a>
            <a className="use reveal" href="/use-cases/local-service">
              <div className="use-copy">
                <h3>Local service</h3>
                <p>Weekly content drafts from your Foundation — approve from the queue, publish when you&rsquo;re ready.</p>
                <span className="use-link">See it →</span>
              </div>
              <div className="card-widget"><div data-mk="widget-use-local"></div></div>
            </a>
            <a className="use reveal" href="/use-cases/coaches-creators">
              <div className="use-copy">
                <h3>Creators &amp; founders</h3>
                <p>One Foundation feeds posts, emails, and creative — twelve agents draft, you approve what ships.</p>
                <span className="use-link">See it →</span>
              </div>
              <div className="card-widget"><div data-mk="widget-use-creators"></div></div>
            </a>
            <a className="use reveal" href="/use-cases/startups">
              <div className="use-copy">
                <h3>Startups</h3>
                <p>Foundation, Brand Kit, and agent drafts before your first marketing hire.</p>
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
            <p className="t-lead">
              Prefer long-form guides? Read practical AI marketing tips on our{' '}
              <a href="/blog">blog</a>.
            </p>
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
          <h2>One Foundation.<br />Twelve specialist agents.<br />One approval queue.</h2>
          <p className="cta-lead">Maya coordinates the agents, reads your Brand Kit before every draft, and routes nothing live until you approve.</p>
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
