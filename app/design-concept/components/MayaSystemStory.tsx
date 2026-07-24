'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import MayaPresence, { type MayaPresenceState } from './MayaPresence'
import { AGENTS, CONTEXT_FRAGMENTS, WORK_ITEMS } from '../storyData'

gsap.registerPlugin(ScrollTrigger)

function StoryCaption({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <div className="dc-story__caption">
      <p className="dc-story__step">{step}</p>
      <h3 className="dc-story__title">{title}</h3>
      <p className="dc-story__lead">{children}</p>
    </div>
  )
}

const mayaStates: MayaPresenceState[] = ['idle', 'listening', 'reading', 'coordinating', 'routing', 'complete']

export default function MayaSystemStory() {
  const rootRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const section = sectionRef.current
    if (!root || !section) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('dc-story-root--static')
      return
    }

    const ctx = gsap.context(() => {
      const captions = gsap.utils.toArray<HTMLElement>('.dc-story__caption-wrap')
      const request = root.querySelector('.dc-flow__request')
      const foundation = root.querySelector('.dc-flow__foundation')
      const contextItems = gsap.utils.toArray<HTMLElement>('.dc-flow__context-item')
      const agentRail = root.querySelector('.dc-flow__agents')
      const agents = gsap.utils.toArray<HTMLElement>('.dc-flow__agent')
      const workspace = root.querySelector('.dc-flow__workspace')
      const workRows = gsap.utils.toArray<HTMLElement>('.dc-flow__work-row')
      const queue = root.querySelector('.dc-flow__queue')
      const queueRows = gsap.utils.toArray<HTMLElement>('.dc-flow__queue-row')
      const control = root.querySelector('.dc-flow__control')
      const routeLine = root.querySelector('.dc-flow__route-line')
      const maya = root.querySelector('.dc-flow__maya')
      const mayaEl = maya?.querySelector('.dc-maya') as HTMLElement | null

      const setMayaState = (state: MayaPresenceState) => {
        if (!mayaEl) return
        mayaStates.forEach((s) => mayaEl.classList.remove(`dc-maya--${s}`))
        mayaEl.classList.add(`dc-maya--${state}`)
      }

      const showCaption = (index: number, tl: gsap.core.Timeline, at: string | number) => {
        tl.to(
          captions,
          {
            opacity: (i: number) => (i === index ? 1 : 0),
            y: (i: number) => (i === index ? 0 : 12),
            duration: 0.3,
          },
          at,
        )
      }

      gsap.set(captions, { opacity: 0, y: 12 })
      gsap.set(captions[0], { opacity: 1, y: 0 })
      gsap.set(foundation, { opacity: 0, y: 16, visibility: 'hidden' })
      gsap.set(contextItems, { opacity: 0, y: 10 })
      gsap.set(agentRail, { opacity: 0, y: 16, visibility: 'hidden' })
      gsap.set(agents, { opacity: 0, x: -8 })
      gsap.set(workspace, { opacity: 0, y: 12, visibility: 'hidden' })
      gsap.set(workRows, { opacity: 0, y: 10 })
      gsap.set(queue, { opacity: 0, y: 12, visibility: 'hidden' })
      gsap.set(queueRows, { opacity: 0, y: 8 })
      gsap.set(control, { opacity: 0, y: 12, visibility: 'hidden' })
      gsap.set(routeLine, { scaleX: 0, transformOrigin: 'left center', opacity: 0 })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=430%',
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      })

      // Scene 1 — request
      tl.call(() => setMayaState('listening'))
        .to(request, { scale: 1.02, duration: 0.35 })
        .to({}, { duration: 0.5 })

      // Scene 2 — context + activity rail
      showCaption(1, tl, '>')
      tl.call(() => setMayaState('reading'), undefined, '<')
        .to(request, { y: -12, scale: 0.94, opacity: 0.55, duration: 0.45 }, '<')
        .to(foundation, { opacity: 1, y: 0, visibility: 'visible', duration: 0.45 }, '<0.05')
        .to(contextItems, { opacity: 1, y: 0, stagger: 0.05, duration: 0.28 }, '<0.08')
        .to(agentRail, { opacity: 1, y: 0, visibility: 'visible', duration: 0.35 }, '<0.12')
        .to(agents, { opacity: 1, x: 0, stagger: 0.04, duration: 0.25 }, '<0.05')
        .to(routeLine, { scaleX: 1, opacity: 1, duration: 0.4 }, '<0.1')
        .call(() => setMayaState('coordinating'), undefined, '>')
        .to({}, { duration: 0.55 })

      // Scene 3 — one campaign workspace grows from the same rail
      showCaption(2, tl, '>')
      tl.to(request, { opacity: 0, y: -24, duration: 0.3 }, '<')
        .to(foundation, { scale: 0.98, duration: 0.35 }, '<')
        .to(workspace, { opacity: 1, y: 0, visibility: 'visible', duration: 0.48 }, '<0.05')
        .to(workRows, { opacity: 1, y: 0, stagger: 0.06, duration: 0.3 }, '<0.1')
        .to({}, { duration: 0.6 })

      // Scene 4 — workspace resolves into approval
      showCaption(3, tl, '>')
      tl.call(() => setMayaState('routing'), undefined, '<')
        .to(foundation, { opacity: 0.35, duration: 0.35 }, '<')
        .to(agentRail, { opacity: 0.35, duration: 0.35 }, '<')
        .to(workspace, { opacity: 0, y: -10, visibility: 'hidden', duration: 0.42 }, '<')
        .to(queue, { opacity: 1, y: 0, visibility: 'visible', duration: 0.48 }, '<0.06')
        .to(queueRows, { opacity: 1, y: 0, stagger: 0.06, duration: 0.28 }, '<0.08')
        .to(control, { opacity: 1, y: 0, visibility: 'visible', duration: 0.35 }, '>0.05')
        .call(() => setMayaState('complete'), undefined, '<')
        .to({}, { duration: 0.65 })

      return () => tl.kill()
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={rootRef} className="dc-story-root dc-story-root--coherent">
      <section id="story" ref={sectionRef} className="dc-story dc-story--coherent" aria-labelledby="dc-story-heading">
        <h2 id="dc-story-heading" className="dc-sr-only">
          How Maya turns one request into approved marketing
        </h2>

        <div className="dc-story__sticky">
          <div className="dc-wrap dc-story__frame dc-story__frame--coherent">
            <div className="dc-story__captions">
              <div className="dc-story__caption-wrap">
                <StoryCaption step="01" title="Tell Maya the goal">
                  Start with the outcome. No workflow setup. No long brief.
                </StoryCaption>
              </div>
              <div className="dc-story__caption-wrap">
                <StoryCaption step="02" title="Maya builds from what she knows">
                  Foundation context stays visible while specialist agents begin the work.
                </StoryCaption>
              </div>
              <div className="dc-story__caption-wrap">
                <StoryCaption step="03" title="One campaign takes shape">
                  Strategy, email, posts, creative, and insights grow inside one connected workspace.
                </StoryCaption>
              </div>
              <div className="dc-story__caption-wrap">
                <StoryCaption step="04" title="Everything arrives ready for you">
                  The completed work resolves into one approval queue. You edit, approve, or schedule.
                </StoryCaption>
              </div>
            </div>

            <div className="dc-flow" aria-hidden="true">
              <div className="dc-flow__ambient dc-flow__ambient--violet" />
              <div className="dc-flow__ambient dc-flow__ambient--gold" />

              <div className="dc-flow__top">
                <div className="dc-flow__maya">
                  <MayaPresence state="idle" size="lg" />
                </div>

                <div className="dc-flow__request">
                  <span className="dc-flow__request-label">You</span>
                  <strong>Fill next Friday — it&apos;s our slow day.</strong>
                  <span className="dc-flow__request-note">Request received</span>
                </div>
              </div>

              <div className="dc-flow__body">
                <div className="dc-flow__left">
                  <section className="dc-flow__foundation">
                    <div className="dc-flow__section-head">
                      <span>Foundation</span>
                      <em>Reading saved context</em>
                    </div>
                    <div className="dc-flow__context-grid">
                      {CONTEXT_FRAGMENTS.slice(0, 4).map((item) => (
                        <div key={item.id} className="dc-flow__context-item">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="dc-flow__route-line" aria-hidden="true" />

                  <section className="dc-flow__agents">
                    <p className="dc-flow__eyebrow">Maya is coordinating</p>
                    <div className="dc-flow__agent-list">
                      {AGENTS.slice(0, 4).map((agent) => (
                        <div key={agent.id} className={`dc-flow__agent dc-flow__agent--${agent.color}`}>
                          <span className="dc-flow__agent-dot" />
                          <strong>{agent.name}</strong>
                          <em>{agent.action}</em>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="dc-flow__right">
                  <section className="dc-flow__workspace">
                    <header className="dc-flow__workspace-head">
                      <div>
                        <span>Campaign workspace</span>
                        <strong>Friday Slow-Day Promo</strong>
                      </div>
                      <em>Building now</em>
                    </header>
                    <div className="dc-flow__work-list">
                      {WORK_ITEMS.slice(0, 4).map((item) => (
                        <div key={item.id} className={`dc-flow__work-row dc-flow__work-row--${item.type}`}>
                          <span className="dc-flow__work-icon" />
                          <div>
                            <strong>{item.title}</strong>
                            <em>{item.meta}</em>
                          </div>
                          <span className="dc-flow__work-status">{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="dc-flow__queue">
                    <header className="dc-flow__queue-head">
                      <div>
                        <span>Approval queue</span>
                        <strong>4 items ready</strong>
                      </div>
                      <em>About 4 minutes</em>
                    </header>
                    <div className="dc-flow__queue-list">
                      {WORK_ITEMS.slice(0, 4).map((item) => (
                        <div key={item.id} className="dc-flow__queue-row">
                          <div>
                            <strong>{item.title}</strong>
                            <em>{item.queueSource}</em>
                          </div>
                          <span>{item.queueStatus}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              <div className="dc-flow__control">
                <strong>You decide what gets published.</strong>
                <div>
                  <button type="button" className="dc-btn dc-btn--primary dc-btn--sm">
                    Approve
                  </button>
                  <button type="button" className="dc-btn dc-btn--ghost dc-btn--sm">
                    Edit
                  </button>
                  <button type="button" className="dc-btn dc-btn--ghost dc-btn--sm">
                    Schedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="dc-story-static">
        <div className="dc-wrap">
          <h2>From one request to one approval queue.</h2>
          <p>
            Maya reads Foundation, coordinates the right specialists, builds the campaign, and returns the work for
            your approval.
          </p>
        </div>
      </div>
    </div>
  )
}
