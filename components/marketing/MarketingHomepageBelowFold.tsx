'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { TRIAL_CARD_NOTE, TRIAL_LABEL } from '@/lib/billing/trialPolicy'
import { trackEvent } from '@/lib/gtag'
import { HOMEPAGE_FAQ_ITEMS } from '@/lib/marketing/homepageFaq'
import MarketingFooter from '@/app/lab5/MarketingFooter'
import DeferredMetaballs from '@/app/lab5/DeferredMetaballs'

const HowItWorksSteps = dynamic(() => import('@/components/marketing/HowItWorksSteps'), { ssr: true })
const StackCompareSection = dynamic(() => import('@/components/marketing/StackCompareSection'), { ssr: true })
const TeamsJourneySection = dynamic(() => import('@/components/marketing/TeamsJourneySection'), { ssr: true })
const CreativeShowcase = dynamic(() => import('@/components/marketing/CreativeShowcase'), { ssr: true })

const FAQ_ITEMS = HOMEPAGE_FAQ_ITEMS

type MarketingHomepageBelowFoldProps = {
  faqLocation?: string
  footerCtaLocation?: string
}

export default function MarketingHomepageBelowFold({
  faqLocation = 'landing',
  footerCtaLocation = 'footer_cta',
}: MarketingHomepageBelowFoldProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <>
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

      <section id="how">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">How it works</span>
            <h2 className="t-h2">
              Tell <em>Maya</em> the goal. Agents draft from Foundation.
              <br />
              You approve before anything goes live.
            </h2>
            <p className="t-lead">
              No briefs, no tool-hopping. Maya reads your Foundation and Brand Kit, coordinates specialist agents, and routes every draft to your approval&nbsp;queue.
              <br />
              <a href="/how-it-works">See the full AI marketing automation workflow →</a>
            </p>
          </div>
          <HowItWorksSteps />
        </div>
      </section>

      <TeamsJourneySection />

      <section id="features">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">What the agents run</span>
            <h2 className="t-h2">
              Twelve specialists.
              <br />
              One shared Foundation.
            </h2>
            <p className="t-lead">
              Every agent reads Foundation and Brand Kit before drafting — campaigns, creative, posts, and reports land in one approval&nbsp;queue.
              <br />
              <a href="/agents">See our AI marketing automation features →</a>
            </p>
          </div>

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Campaigns</div>
              <h3 className="t-h3">Campaign Builder reads Foundation first.</h3>
              <p className="t-body">You name the offer. The Campaign Builder pulls from your Foundation and Brand Kit, then drafts strategy, email copy, social posts, ad variations, and a timeline, all routed to your approval queue.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Email variants drafted from your Foundation.</div>
                <div className="check"><i>✓</i>30-day plan drafted from your saved positioning</div>
                <div className="check"><i>✓</i>Email, social, and ad copy drafted in one run</div>
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
              <p className="t-body">Creative agents pull palette, tone, and scene direction from Brand Kit and Foundation, then generate post images and Reels with captions written from what&rsquo;s actually in the frame.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Instagram post + caption drafted from your Brand Kit.</div>
                <div className="check"><i>✓</i>Colors, style, and scene direction pulled from your brand</div>
                <div className="check"><i>✓</i>Captions read the finished image before they&rsquo;re written</div>
                <div className="check"><i>✓</i>You approve every asset before it can publish</div>
              </div>
            </div>
            <div className="feat-visual"><CreativeShowcase /></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat reveal">
            <div className="feat-copy">
              <div className="feat-relief">Approval Queue</div>
              <h3 className="t-h3">
                Everything waits for your approval
                <br />
                before it ships.
              </h3>
              <p className="t-body">
                Every post, email, and campaign artifact lands in one queue, drafted from the same Foundation and Brand Kit each week, so nothing needs re-briefing.
                Review what&rsquo;s there, approve what&rsquo;s right, and publish on your schedule.
                A typical queue holds around seven assets, about four minutes to review.
              </p>
            </div>
            <div className="feat-visual"><div className="mk" data-mk="approvals"></div></div>
          </div>
          <hr className="feat-rule" />

          <div className="feat flip reveal">
            <div className="feat-copy">
              <div className="feat-relief">SEO</div>
              <h3 className="t-h3">SEO Scanner reads your live site URL.</h3>
              <p className="t-body">The agent snapshots your homepage and key pages, then compares them to your Foundation positioning to flag title, meta, and content gaps specific to your site.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Title and meta gaps flagged on your live site.</div>
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
              <p className="t-body">
                The Competitor Analysis agent drafts weekly briefings from your saved positioning and market context, filtered for your brand — for example, flagging that Coffee Collective launched a Father&apos;s Day campaign three hours ago.
                You review the report and decide what to act on.
              </p>
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
                <p>Name the offer — Campaign Builder drafts strategy, emails, posts, and ad variations from your saved context, then routes them to your queue.</p>
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

      <section id="uses">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Built for the way you work</span>
            <h2 className="t-h2">Marketing built around how your business actually sells.</h2>
            <p className="t-lead">
              See how our AI marketing strategist works for
              <br />
              <a href="/use-cases/local-service">local service businesses</a>,{' '}
              <a href="/use-cases/ecommerce">e-commerce brands</a>,{' '}
              <a href="/for-coaches">coaches, creators &amp; solo founders</a>, and{' '}
              <a href="/use-cases/startups">startups &amp; early-stage teams</a>.
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
            <a className="use reveal" href="/for-coaches">
              <div className="use-copy">
                <h3>Coaches, creators &amp; solo founders</h3>
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
                <button
                  className="faq-q"
                  onClick={() => {
                    if (openFaq !== i) trackEvent('faq_open', { question: q, location: faqLocation })
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

      <div className="cta-section">
        <DeferredMetaballs className="cta-orb" loadWhenVisible />
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
              onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: footerCtaLocation })}
            >
              Start your free trial
            </a>
            <a
              className="btn btn-dark-ghost btn-lg"
              href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'see_plans', location: footerCtaLocation })}
            >
              See plans →
            </a>
          </div>
          <p className="cta-note">
            {TRIAL_LABEL}. {TRIAL_CARD_NOTE}.
          </p>
        </div>
      </div>

      <MarketingFooter />
    </>
  )
}
