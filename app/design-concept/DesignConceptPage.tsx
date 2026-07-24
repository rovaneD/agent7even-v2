'use client'

import { useEffect, useState } from 'react'
import SafeMetaballs from '../lab5/SafeMetaballs'
import MarketingNav from '../lab5/MarketingNav'
import MarketingFooter from '../lab5/MarketingFooter'
import { useMockupScript } from '../lab5/useMockupScript'
import { trackEvent } from '@/lib/gtag'
import { HOMEPAGE_FAQ_ITEMS } from '@/lib/marketing/homepageFaq'
import StackCompareSection from '@/components/marketing/StackCompareSection'
import CreativeShowcase from '@/components/marketing/CreativeShowcase'

declare global {
  interface Window {
    __initMockups?: () => void
  }
}

const FAQ_ITEMS = HOMEPAGE_FAQ_ITEMS

const METABALL_COLORS = ['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE'] as const

export default function DesignConceptPage() {
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
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    document.querySelectorAll('.lab5.dc-layout .reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="lab5 dc-layout">
      <MarketingNav />

      {/* Hero — production copy; dashboard mock right; metaballs blurred behind */}
      <header className="hero dc-hero">
        <div className="dc-hero__metaballs" aria-hidden="true">
          <SafeMetaballs
            speed={1}
            count={10}
            size={0.52}
            scale={1}
            colors={[...METABALL_COLORS]}
            colorBack="#00000000"
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
        <div className="wrap dc-hero__grid">
          <div className="hero-copy">
            <p className="eyebrow">From idea to approval queue, without switching tools.</p>
            <h1 className="hero-title">Marketing, managed.</h1>
            <p className="hero-lead">
              <span className="hero-lead-line">
                <em>Maya</em> plans campaigns, writes the content, and routes every draft to one queue.
              </span>
              <span className="hero-lead-line">Every image, caption, and email pulls from your Foundation.</span>
              <span className="hero-lead-line">You decide what gets published.</span>
            </p>
            <p className="hero-tagline">One Foundation. Twelve specialist agents. One approval queue.</p>
            <div className="hero-cta">
              <div className="hero-cta-row">
                <a
                  className="btn btn-blue btn-lg"
                  href="/pricing"
                  onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'design_concept_hero' })}
                >
                  Start your free trial
                </a>
                <a
                  className="btn btn-ghost btn-lg"
                  href="#workflow"
                  onClick={() => trackEvent('cta_click', { cta: 'see_how_it_works', location: 'design_concept_hero' })}
                >
                  See how it works →
                </a>
              </div>
              <p className="hero-note">3-day free trial. No charge until day 4.</p>
            </div>
          </div>
          <div className="dc-hero__mock reveal">
            <div
              className="mk"
              data-mk="dashboard"
              role="img"
              aria-label="Agent7even dashboard showing campaign planning and approval queue"
            />
          </div>
        </div>
      </header>

      {/* Stop stitching — production stack compare + approval mock */}
      <section id="workflow">
        <StackCompareSection />
        <div className="wrap dc-workflow-mock reveal">
          <div className="mk" data-mk="approvals" role="img" aria-label="Approval queue with drafts ready for review" />
        </div>
      </section>

      {/* Split — campaign */}
      <section className="dc-split">
        <div className="wrap">
          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Campaigns</div>
              <h3 className="t-h3">Create your marketing campaign effortlessly.</h3>
              <p className="t-body">
                You name the offer. Campaign Builder pulls from your Foundation and Brand Kit, then drafts strategy,
                email copy, social posts, ad variations, and a timeline — all routed to your approval queue.
              </p>
              <div className="checks">
                <div className="check">
                  <i>✓</i>Email variants drafted from your Foundation.
                </div>
                <div className="check">
                  <i>✓</i>30-day plan drafted from your saved positioning
                </div>
                <div className="check">
                  <i>✓</i>Email, social, and ad copy drafted in one run
                </div>
              </div>
            </div>
            <div className="feat-visual">
              <div className="mk" data-mk="campaign" />
            </div>
          </div>
        </div>
      </section>

      {/* Three super-power cards — production lcard pattern */}
      <section className="layer dc-super">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Why Agent7even</span>
            <h2 className="t-h2">
              The things that set <em>Agent7even</em> apart. The super powers.
            </h2>
          </div>
          <div className="cards dc-super__cards">
            <div className="lcard reveal">
              <div className="lcard-copy">
                <h3>Campaigns from Foundation</h3>
                <p>
                  Name the offer — Campaign Builder drafts strategy, emails, posts, and ad variations from your saved
                  context, then routes them to your queue.
                </p>
                <a href="#workflow">See it →</a>
              </div>
              <div className="card-widget">
                <div data-mk="widget-campaign" />
              </div>
            </div>
            <div className="lcard reveal">
              <div className="lcard-copy">
                <h3>Approval queue before publish</h3>
                <p>
                  Every post, email, and campaign artifact lands in one queue. Review, edit, approve — then publish
                  when you&apos;re ready.
                </p>
                <a href="#workflow">See it →</a>
              </div>
              <div className="card-widget">
                <div data-mk="widget-approvals" />
              </div>
            </div>
            <div className="lcard reveal">
              <div className="lcard-copy">
                <h3>One Foundation, every channel</h3>
                <p>
                  Every email, post, and caption starts from the same Foundation and Brand Kit — not a fresh prompt
                  each time.
                </p>
                <a href="#workflow">See it →</a>
              </div>
              <div className="card-widget">
                <div data-mk="widget-voice" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Alternating feature rows — production feat + mk */}
      <section id="features">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Everything under one roof</span>
            <h2 className="t-h2">
              Unwavering focus.
              <br />
              One shared Foundation.
            </h2>
          </div>

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Creative</div>
              <h3 className="t-h3">Every image uses your saved colors, style, and creative direction.</h3>
              <p className="t-body">
                Creative agents pull palette, tone, and scene direction from Brand Kit and Foundation — then generate
                post images and Reels, with captions written from what&apos;s actually in the frame.
              </p>
            </div>
            <div className="feat-visual">
              <CreativeShowcase />
            </div>
          </div>
          <hr className="feat-rule" />

          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">Approval Queue</div>
              <h3 className="t-h3">Everything waits for your approval before it ships.</h3>
              <p className="t-body">
                Every post, email, and campaign artifact lands in one queue. Review what changed, approve what&apos;s
                right, then publish when you&apos;re ready.
              </p>
            </div>
            <div className="feat-visual">
              <div className="mk" data-mk="approvals" />
            </div>
          </div>
          <hr className="feat-rule" />

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">SEO</div>
              <h3 className="t-h3">SEO Scanner reads your live site URL.</h3>
              <p className="t-body">
                The agent snapshots your homepage and key pages, compares them to your Foundation positioning, and flags
                title, meta, and content gaps.
              </p>
            </div>
            <div className="feat-visual">
              <div className="mk" data-mk="seo" />
            </div>
          </div>
          <hr className="feat-rule" />

          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">Competitors</div>
              <h3 className="t-h3">Competitive reports pull from your Foundation.</h3>
              <p className="t-body">
                The Competitor Analysis agent drafts briefings from your saved positioning and market context — actionable
                reports you can respond to.
              </p>
            </div>
            <div className="feat-visual">
              <div className="mk" data-mk="competitor" />
            </div>
          </div>
          <hr className="feat-rule" />

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Calendar</div>
              <h3 className="t-h3">Schedule what you approve — from one queue.</h3>
              <p className="t-body">
                Approved posts and campaigns move to your calendar. Nothing publishes until you sign off from the queue
                first.
              </p>
            </div>
            <div className="feat-visual">
              <div className="mk" data-mk="calendar" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — production pattern */}
      <section id="faq">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Questions</span>
            <h2 className="t-h2">Everything you need to know.</h2>
          </div>
          <div className="faq reveal">
            {FAQ_ITEMS.map(({ q, a }, i) => (
              <div key={q} className="faq-item">
                <button
                  type="button"
                  className="faq-q"
                  onClick={() => {
                    if (openFaq !== i) trackEvent('faq_open', { question: q, location: 'design_concept' })
                    setOpenFaq(openFaq === i ? null : i)
                  }}
                >
                  {q}
                  <span className={`faq-icon${openFaq === i ? ' open' : ''}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="faq-body">
                    <p>{a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dark CTA — production */}
      <div className="cta-section">
        <div className="cta-orb">
          <SafeMetaballs
            speed={1}
            count={9}
            size={0.26}
            scale={1}
            colors={[...METABALL_COLORS]}
            colorBack="#0E0E11"
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
        <div className="cta-in">
          <h2>
            One Foundation.
            <br />
            Twelve specialist agents.
            <br />
            One approval queue.
          </h2>
          <p className="cta-lead">
            Maya reads your Foundation and Brand Kit before every draft.
            <br />
            Every campaign lands in your approval queue before anything goes live.
          </p>
          <div className="cta-btns">
            <a
              className="btn btn-white btn-lg"
              href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'design_concept_footer' })}
            >
              Start your free trial
            </a>
            <a
              className="btn btn-dark-ghost btn-lg"
              href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'see_plans', location: 'design_concept_footer' })}
            >
              See plans →
            </a>
          </div>
          <p className="cta-note">3-day free trial. No charge until day 4.</p>
        </div>
      </div>

      <MarketingFooter />
      <p className="dc-layout__note wrap">Design concept prototype — not the production homepage.</p>
    </div>
  )
}
