'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import MayaOrb from '@/components/maya/MayaOrb'
import { trackEvent } from '@/lib/gtag'
import { HOMEPAGE_FAQ_ITEMS } from '@/lib/marketing/homepageFaq'
import MarketingNav from '../../lab5/MarketingNav'
import MarketingFooter from '../../lab5/MarketingFooter'
import DeferredMetaballs from '../../lab5/DeferredMetaballs'
import { useMockupScript } from '../../lab5/useMockupScript'
import '../../lab5/styles.css'
import './homepage-site-brand-b.css'

// Below-fold sections are the production homepage's own components.
const HowItWorksSteps = dynamic(() => import('@/components/marketing/HowItWorksSteps'), { ssr: true })
const StackCompareSection = dynamic(() => import('@/components/marketing/StackCompareSection'), { ssr: true })
const TeamsJourneySection = dynamic(() => import('@/components/marketing/TeamsJourneySection'), { ssr: true })
const CreativeShowcase = dynamic(() => import('@/components/marketing/CreativeShowcase'), { ssr: true })

const MAYA_ACCENT = '#F5349B'

// Production mockup palette (lab5/styles.css)
const BLUE = '#3286FE'
const GREEN = '#10B981'
const AMBER = '#FCA509'
const LINE = 'rgba(26,25,23,.08)'
const FAINT = '#8A8F98'
const INK = '#101217'

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v
}

const NARR_TEXT = [
  { title: 'Maya remembers.', body: 'Your Foundation — voice, regulars, offers, goals — is already there. Nothing to re-explain.' },
  { title: 'A campaign takes shape.', body: 'Built for Friday, from your context — not a template.' },
  { title: 'Twelve specialists. One system.', body: 'Coordinated by Maya, not stitched together by you.' },
  { title: 'Real work, produced.', body: 'Emails, posts, creative — finished drafts, in your voice.' },
  { title: 'Everything waits for you.', body: 'One approval queue. Nothing publishes without you.' },
]

// Same conversation as the production hero mockup.
const REPLIES = [
  'On it. A Friday promo — offer, email draft and three posts. Drafting it in your canvas now.',
  'Want me to match the 20% you ran last spring, or go a little deeper?',
]

type CampaignRow = { dot: string; title: string; subtitle: string; pill: string; pillBg: string; pillColor: string }

// Same rows as the production hero mockup, with lab5 tag colors.
const CAMPAIGN_ROWS: CampaignRow[] = [
  {
    dot: GREEN,
    title: 'Summer Launch',
    subtitle: 'Sequence 2 of 4 · strong engagement',
    pill: 'Approved',
    pillBg: '#E3F9F0',
    pillColor: '#0B815A',
  },
  {
    dot: AMBER,
    title: 'Friday Slow-Day Promo',
    subtitle: 'Drafted by Maya · ready to review',
    pill: 'Draft',
    pillBg: '#FFF3DF',
    pillColor: '#9A6400',
  },
  {
    dot: BLUE,
    title: 'Win-back email sequence',
    subtitle: '12 lapsed customers identified',
    pill: 'Queued',
    pillBg: '#EAF1FF',
    pillColor: '#1F6FEB',
  },
]

const STATS = [
  { value: '3', label: 'Awaiting approval' },
  { value: '12', label: 'Drafted this week', accent: true },
  { value: '2', label: 'Campaigns in progress' },
]

// Taller hero than variant A: eyebrow + display headline + Maya subline +
// body + CTA + trust line before the stage.
const HERO_HEIGHT = 430

function renderVals(p: number, vw: number, vh: number) {
  const seg = (a: number, b: number) => clamp((p - a) / (b - a), 0, 1)
  const fadeUp = (t: number, width = 0.06): CSSProperties => {
    const o = seg(t, t + width)
    return { opacity: o, transform: `translateY(${(6 * (1 - o)).toFixed(2)}px)` }
  }

  // Narration reads centered under the stage, like the A/B screenshot.
  const s = Math.min(1, (vw - 48) / 1040, (vh - 210) / 600)
  // Narrow screens: the hero type stack wraps taller.
  const heroH = vw < 720 ? 540 : HERO_HEIGHT

  const gNarr: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: vh / 2 + 300 * s + 14,
    width: Math.min(620, vw - 32),
    height: 96,
    transform: 'translateX(-50%)',
    textAlign: 'center',
    zIndex: 3,
  }

  const heroO = 1 - seg(0.08, 0.13)
  const heroTop = Math.max(84, vh / 2 - 300 * s - heroH)
  const gHero: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: heroTop,
    width: Math.min(820, vw - 40),
    transform: 'translateX(-50%)',
    textAlign: 'center',
    zIndex: 3,
    opacity: heroO,
    pointerEvents: heroO < 0.1 ? 'none' : 'auto',
  }

  const nO = (a: number, b: number) => seg(a, a + 0.04) * (1 - seg(b, b + 0.04))
  const nst = (o: number): CSSProperties => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: o,
    transform: `translateY(${8 * (1 - Math.min(o * 2, 1))}px)`,
  })

  const msg = 'Fill next Friday — it’s our slow day.'
  const typed = msg.slice(0, Math.round(msg.length * seg(0.008, 0.075)))
  const mayaState =
    p < 0.09
      ? 'Listening'
      : p < 0.2
        ? 'Reading Foundation'
        : p < 0.48
          ? 'Planning'
          : p < 0.64
            ? 'Coordinating'
            : p < 0.82
              ? 'Producing'
              : p < 0.955
                ? 'Routing to queue'
                : 'Complete'

  return {
    accent: MAYA_ACCENT,
    typed,
    mayaPill: p < 0.09 ? 'Maya is working' : mayaState === 'Complete' ? 'All caught up' : `Maya is ${mayaState.toLowerCase()}`,
    // Blobs stay full strength in the hero, then recede while the story runs
    // so the stage animation keeps the focus.
    blobsO: 1 - 0.65 * seg(0.08, 0.16),
    sStage: {
      width: 1040,
      height: 600,
      flex: 'none',
      transform: `translateY(${(heroO * Math.max(0, heroTop + heroH + 40 - (vh / 2 - 300 * s))).toFixed(1)}px) scale(${s})`,
      willChange: 'transform',
      zIndex: 2,
      position: 'relative',
    } as CSSProperties,
    sCue: {
      position: 'absolute',
      right: 28,
      bottom: 20,
      opacity: 1 - seg(0.02, 0.06),
      fontSize: 11.5,
      letterSpacing: '.06em',
      color: FAINT,
      zIndex: 3,
    } as CSSProperties,
    gNarr,
    gHero,
    n: [nst(nO(0.14, 0.3)), nst(nO(0.325, 0.465)), nst(nO(0.48, 0.625)), nst(nO(0.645, 0.815)), nst(seg(0.845, 0.885))],
    sCursor: (p < 0.095
      ? { color: MAYA_ACCENT, animation: 'a7blink-b 1s steps(1) infinite' }
      : { opacity: 0, animation: 'none' }) as CSSProperties,
    userMsg: fadeUp(0, 0.02),
    replies: [fadeUp(0.1), fadeUp(0.35)],
    rows: [fadeUp(0.6), fadeUp(0.7), fadeUp(0.8)],
  }
}

const dotStyle: CSSProperties = { width: 9, height: 9, borderRadius: '50%', background: '#D8D4CB' }

// Production hero-mockup rail icons (lab5/HeroDashboardMockup.tsx)
function RailIcon({ d, active }: { d: ReactNode; active?: boolean }) {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 9,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? '#EAF1FF' : 'transparent',
        color: active ? BLUE : FAINT,
      }}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        {d}
      </svg>
    </div>
  )
}

function StatCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, background: '#FCFCFD', border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: accent ? GREEN : INK }}>{value}</div>
      <div style={{ fontSize: 11.5, color: FAINT, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function CampaignRowView({ row }: { row: CampaignRow }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${LINE}`, borderRadius: 11, padding: '12px 16px', background: '#fff' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.dot, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.title}</div>
        <div style={{ fontSize: 11.5, color: FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.subtitle}</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, background: row.pillBg, color: row.pillColor, padding: '4px 11px', borderRadius: 99, flex: 'none' }}>
        {row.pill}
      </span>
    </div>
  )
}

// Per-frame catch-up toward the scroll position. Wheel events land in steps;
// easing the story toward the target keeps the stage motion smooth.
const SMOOTHING = 0.14

function ScrollHero() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const loopRef = useRef<number | null>(null)
  const targetRef = useRef(0)
  const currentRef = useRef(0)
  const [{ p, vw, vh }, setMeasured] = useState({ p: 0, vw: 1440, vh: 900 })

  useEffect(() => {
    let vwNow = window.innerWidth
    let vhNow = window.innerHeight
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const readTarget = () => {
      const el = scrollRef.current
      if (!el) return 0
      const r = el.getBoundingClientRect()
      return clamp(-r.top / (r.height - vhNow), 0, 1)
    }

    const tick = () => {
      loopRef.current = null
      const target = targetRef.current
      let next = reducedMotion ? target : currentRef.current + (target - currentRef.current) * SMOOTHING
      if (Math.abs(target - next) < 0.0004) next = target
      currentRef.current = next
      setMeasured({ p: next, vw: vwNow, vh: vhNow })
      if (next !== target) loopRef.current = requestAnimationFrame(tick)
    }

    const onScroll = () => {
      targetRef.current = readTarget()
      // Off-screen (target settled at 0 or 1) — no work, no re-renders.
      if (targetRef.current === currentRef.current) return
      if (loopRef.current === null) loopRef.current = requestAnimationFrame(tick)
    }

    const snap = () => {
      vwNow = window.innerWidth
      vhNow = window.innerHeight
      targetRef.current = readTarget()
      currentRef.current = targetRef.current
      setMeasured({ p: currentRef.current, vw: vwNow, vh: vhNow })
    }

    snap()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', snap)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', snap)
      if (loopRef.current !== null) cancelAnimationFrame(loopRef.current)
    }
  }, [])

  const vals = useMemo(() => renderVals(p, vw, vh), [p, vw, vh])

  return (
    <div className="hsb-b">
      <div ref={scrollRef} style={{ height: '750vh', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {/* Metaballs — production WebGL shader in two places, bleeding off the page edges */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, opacity: vals.blobsO, pointerEvents: 'none' }} aria-hidden>
            <DeferredMetaballs className="hsb-metaballs hsb-metaballs--top-left" count={7} />
            <DeferredMetaballs className="hsb-metaballs hsb-metaballs--bottom-right" count={7} />
          </div>

          <div style={vals.gHero}>
            <div className="hsb-b-eyebrow">From idea to approval queue, without switching tools</div>
            <h1 className="hsb-b-h1">
              AI Marketing Automation
              <br />
              in minutes a day
            </h1>
            <div className="hsb-b-sub">
              <MayaOrb size={22} active />
              <span>
                <span className="maya">Maya</span> handles the work. You approve once.
              </span>
            </div>
            <p className="hsb-b-body">
              Maya plans campaigns, writes the content, and routes every draft to one queue.
              Every image, caption, and email pulls from your Foundation.
              You decide what gets published.
            </p>
            <Link
              href="/pricing"
              className="btn btn-hero-primary"
              onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'hero_variant_b' })}
            >
              Start for free →
            </Link>
            <div className="hsb-b-trust">
              <span>
                <span className="hsb-b-check">✓</span> 3-day free trial
              </span>
              <span>Cancel anytime</span>
              <span>No charge until day 4</span>
            </div>
          </div>

          <div style={vals.gNarr}>
            {NARR_TEXT.map((item, i) => (
              <div key={item.title} style={vals.n[i]}>
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.15, marginBottom: 10, color: INK }}>{item.title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: '#6F6A61' }}>{item.body}</div>
              </div>
            ))}
          </div>

          <div style={vals.sStage}>
            <div
              style={{
                position: 'relative',
                width: 1040,
                height: 600,
                background: '#FFFFFF',
                border: '1px solid rgba(26,25,23,.12)',
                borderRadius: 14,
                boxShadow: '0 30px 70px -34px rgba(26,25,23,.3)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* browser chrome */}
              <div
                style={{
                  height: 40,
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '0 16px',
                  borderBottom: `1px solid ${LINE}`,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                  <span style={dotStyle} />
                  <span style={dotStyle} />
                  <span style={dotStyle} />
                </div>
                <div
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: 11,
                    color: FAINT,
                    background: '#F4F4F6',
                    border: `1px solid ${LINE}`,
                    borderRadius: 6,
                    padding: '4px 0',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                  }}
                >
                  agent7even.ai/dashboard
                </div>
                <div style={{ width: 33, flex: 'none' }} />
              </div>

              {/* body */}
              <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                {/* icon rail — same icons as production hero mockup */}
                <div
                  style={{
                    width: 56,
                    flex: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '14px 0',
                    background: '#FCFCFD',
                    borderRight: `1px solid ${LINE}`,
                  }}
                >
                  <div style={{ width: 28, height: 28, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/agent7even_mark.svg" alt="" width={28} height={28} style={{ objectFit: 'contain' }} />
                  </div>
                  <RailIcon
                    active
                    d={
                      <>
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" />
                      </>
                    }
                  />
                  <RailIcon
                    d={
                      <>
                        <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
                        <circle cx="12" cy="12" r="2.4" />
                      </>
                    }
                  />
                  <RailIcon
                    d={
                      <>
                        <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" />
                        <path d="M14 8a4 4 0 0 1 0 8" />
                      </>
                    }
                  />
                  <RailIcon
                    d={
                      <>
                        <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
                        <path d="M3.5 9h17M8 3v3M16 3v3" />
                      </>
                    }
                  />
                  <div style={{ marginTop: 'auto' }}>
                    <RailIcon
                      d={
                        <>
                          <circle cx="12" cy="8.5" r="3.3" />
                          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
                        </>
                      }
                    />
                  </div>
                </div>

                {/* chat column */}
                <div style={{ width: 334, flex: 'none', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${LINE}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: `1px solid ${LINE}` }}>
                    <MayaOrb size={30} active />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>Maya</div>
                      <div style={{ fontSize: 11, color: FAINT }}>Coordinates 12 specialist agents.</div>
                    </div>
                  </div>

                  <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
                    <div style={{ ...vals.userMsg, display: 'flex', justifyContent: 'flex-end' }}>
                      <div
                        style={{
                          maxWidth: '86%',
                          background: BLUE,
                          color: '#fff',
                          borderRadius: 13,
                          borderBottomRightRadius: 4,
                          padding: '10px 14px',
                          fontSize: 13,
                          lineHeight: 1.5,
                          minHeight: 20,
                        }}
                      >
                        {vals.typed}
                        <span style={vals.sCursor}>▍</span>
                      </div>
                    </div>
                    {REPLIES.map((text, i) => (
                      <div key={text} style={vals.replies[i]}>
                        <div
                          style={{
                            alignSelf: 'flex-start',
                            maxWidth: '92%',
                            background: '#F4F4F6',
                            color: '#2A2E36',
                            borderRadius: 13,
                            borderBottomLeftRadius: 4,
                            padding: '10px 14px',
                            fontSize: 13,
                            lineHeight: 1.5,
                          }}
                        >
                          {text}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '12px 16px', borderTop: `1px solid ${LINE}` }}>
                    <div
                      style={{
                        height: 38,
                        borderRadius: 9,
                        background: '#F4F4F6',
                        border: `1px solid ${LINE}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 6px 0 12px',
                        fontSize: 12.5,
                        color: FAINT,
                      }}
                    >
                      Message Maya…
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 7,
                          background: INK,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                        }}
                      >
                        ↑
                      </span>
                    </div>
                  </div>
                </div>

                {/* dashboard column */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '16px 22px', borderBottom: `1px solid ${LINE}` }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>Good morning</div>
                      <div style={{ fontSize: 12, color: FAINT, marginTop: 1 }}>Here&apos;s where things stand</div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        color: '#3D3A34',
                        border: `1px solid rgba(26,25,23,.12)`,
                        borderRadius: 99,
                        padding: '5px 11px',
                        whiteSpace: 'nowrap',
                        background: '#fff',
                      }}
                    >
                      <span className="live-dot" />
                      {vals.mayaPill}
                    </div>
                  </div>

                  <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {STATS.map((stat) => (
                        <StatCard key={stat.label} value={stat.value} label={stat.label} accent={stat.accent} />
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {CAMPAIGN_ROWS.map((row, i) => (
                        <div key={row.title} style={vals.rows[i]}>
                          <CampaignRowView row={row} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={vals.sCue}>Scroll — watch Maya work</div>
        </div>
      </div>
    </div>
  )
}

const FAQ_ITEMS = HOMEPAGE_FAQ_ITEMS

export default function HomepageSiteBrandStoryB() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  // Same mockup script as production — fills the [data-mk] widgets below the fold.
  useMockupScript('/lab5/mockups.js', '__initMockups', { lazy: true })

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
      {/* NAV — production marketing nav */}
      <MarketingNav />

      {/* HERO — variant B scroll story */}
      <ScrollHero />

      {/* Everything below the fold is identical to the production homepage. */}

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
              No briefs, no tool-hopping. Maya reads your Foundation and Brand Kit, coordinates specialist agents, and routes every draft to your approval&nbsp;queue.
              <br />
              <a href="/how-it-works">See the full AI marketing automation workflow →</a>
            </p>
          </div>
          <HowItWorksSteps />
        </div>
      </section>

      <TeamsJourneySection />

      {/* FEATURE ROWS */}
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
              <p className="t-body">You name the offer. The Campaign Builder pulls from your Foundation and Brand Kit, then drafts strategy, email copy, social posts, ad variations, and a timeline — all routed to your approval queue.</p>
              <div className="checks">
                <div className="check"><i>✓</i>Drafted 3 email variants from your Foundation.</div>
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
                <div className="check"><i>✓</i>Generated 4 Instagram images using your Brand Kit.</div>
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
              <div className="feat-relief">Approval Queue</div>
              <h3 className="t-h3">
                Everything waits for your approval
                <br />
                before it ships.
              </h3>
              <p className="t-body">Every post, email, and campaign artifact lands in one queue. Review what changed, approve what&rsquo;s right, then publish when you&rsquo;re ready — nothing goes live automatically.</p>
              <div className="checks">
                <div className="check"><i>✓</i>7 assets waiting. Estimated review time: 4 minutes.</div>
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
                <div className="check"><i>✓</i>Found 2 missing title tags on your homepage.</div>
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
                <div className="check"><i>✓</i>Coffee Collective launched a Father&apos;s Day campaign 3 hours ago.</div>
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

      {/* USE CASES */}
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
                  if (openFaq !== i) trackEvent('faq_open', { question: q, location: 'landing_variant_b' })
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
        <DeferredMetaballs className="cta-orb" loadWhenVisible />
        <div className="cta-in">
          <h2>One Foundation.<br />Twelve specialist agents.<br />One approval queue.</h2>
          <p className="cta-lead">
            Maya reads your Foundation and Brand Kit before every draft.
            <br />
            Every campaign lands in your approval queue before anything goes live.
          </p>
          <div className="cta-btns">
            <a className="btn btn-white btn-lg" href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'footer_cta_variant_b' })}>Start your free trial</a>
            <a className="btn btn-dark-ghost btn-lg" href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'see_plans', location: 'footer_cta_variant_b' })}>See plans →</a>
          </div>
          <p className="cta-note">3-day free trial. No charge until day 4.</p>
        </div>
      </div>

      <MarketingFooter />
    </div>
  )
}
