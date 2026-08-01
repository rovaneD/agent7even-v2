'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import MayaOrb from '@/components/maya/MayaOrb'
import MarketingHomepageBelowFold from '@/components/marketing/MarketingHomepageBelowFold'
import { FIRST_CHARGE_DAY, TRIAL_LABEL } from '@/lib/billing/trialPolicy'
import { trackEvent } from '@/lib/gtag'
import MarketingNav from '../../lab5/MarketingNav'
import DeferredMetaballs from '../../lab5/DeferredMetaballs'
import { useMockupScript } from '../../lab5/useMockupScript'
import '../../lab5/styles.css'
import './homepage-site-brand-b.css'

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
// body + CTA + trust line before the stage. Includes the extra line breaks.
const HERO_HEIGHT = 480
/** Vertical gap between hero copy and the dashboard mockup at rest. */
const HERO_STAGE_GAP = 80
/** Vertical gap between dashboard mockup bottom and scroll narration. */
const NARR_STAGE_GAP = 56

/**
 * Story timeline as a function of progress p ∈ [0,1] — shared by the desktop
 * scroll-driven hero and the mobile self-playing hero.
 */
function storyVals(p: number) {
  const seg = (a: number, b: number) => clamp((p - a) / (b - a), 0, 1)
  const fadeUp = (t: number, width = 0.06): CSSProperties => {
    const o = seg(t, t + width)
    return { opacity: o, transform: `translateY(${(6 * (1 - o)).toFixed(2)}px)` }
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
    typed,
    mayaPill: p < 0.09 ? 'Maya is working' : mayaState === 'Complete' ? 'All caught up' : `Maya is ${mayaState.toLowerCase()}`,
    // Blobs stay full strength in the hero, then recede while the story runs
    // so the stage animation keeps the focus.
    blobsO: 1 - 0.65 * seg(0.08, 0.16),
    n: [nst(nO(0.14, 0.3)), nst(nO(0.325, 0.465)), nst(nO(0.48, 0.625)), nst(nO(0.645, 0.815)), nst(seg(0.845, 0.885))],
    sCursor: (p < 0.095
      ? { color: MAYA_ACCENT, animation: 'a7blink-b 1s steps(1) infinite' }
      : { opacity: 0, animation: 'none' }) as CSSProperties,
    userMsg: fadeUp(0, 0.02),
    replies: [fadeUp(0.1), fadeUp(0.35)],
    rows: [fadeUp(0.6), fadeUp(0.7), fadeUp(0.8)],
  }
}

type StoryVals = ReturnType<typeof storyVals>

/** Desktop layout: sticky-viewport positions driven by scroll progress. */
function renderVals(p: number, vw: number, vh: number) {
  const seg = (a: number, b: number) => clamp((p - a) / (b - a), 0, 1)

  // Narration reads centered under the stage, like the A/B screenshot.
  const s = Math.min(1, (vw - 48) / 1040, (vh - 210) / 600)

  const gNarr: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: vh / 2 + 300 * s + NARR_STAGE_GAP,
    width: Math.min(620, vw - 32),
    height: 96,
    transform: 'translateX(-50%)',
    textAlign: 'center',
    // Below the stage so narration can never paint over the mockup when
    // scrolling back up (the previous zIndex: 3 sat above sStage's 2).
    zIndex: 1,
    pointerEvents: 'none',
  }

  const heroO = 1 - seg(0.08, 0.13)
  // Sit the hero copy higher so the stage isn't jammed against the bottom.
  const heroTop = Math.max(72, vh / 2 - 300 * s - HERO_HEIGHT - 24)
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

  return {
    ...storyVals(p),
    sStage: {
      width: 1040,
      height: 600,
      flex: 'none',
      transform: `translateY(${(heroO * Math.max(0, heroTop + HERO_HEIGHT + HERO_STAGE_GAP - (vh / 2 - 300 * s))).toFixed(1)}px) scale(${s})`,
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

function HeroCopy() {
  return (
    <>
      <div className="hsb-b-eyebrow">
        From idea to approval queue,
        <br />
        without switching tools
      </div>
      <h1 className="hsb-b-h1">
        AI Marketing Automation
        <br />
        in minutes a day
      </h1>
      <div className="hsb-b-sub">
        <div className="hsb-b-sub-line">
          <div className="hsb-b-sub-primary">
            <span className="hsb-b-orb" aria-hidden>
              <MayaOrb size={22} active />
            </span>
            <span>
              <span className="maya">Maya</span> handles the work.
            </span>
          </div>
          <p className="hsb-b-sub-secondary">You approve before anything goes live.</p>
        </div>
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
          <span className="hsb-b-check">✓</span> {TRIAL_LABEL}
        </span>
        <span>Cancel anytime</span>
        <span>No charge until day {FIRST_CHARGE_DAY}</span>
      </div>
    </>
  )
}

function Narration({ story }: { story: StoryVals }) {
  return (
    <>
      {NARR_TEXT.map((item, i) => (
        <div key={item.title} style={story.n[i]}>
          <div className="hsb-narr-title">{item.title}</div>
          <div className="hsb-narr-body">{item.body}</div>
        </div>
      ))}
    </>
  )
}

// Per-frame catch-up toward the scroll position. Wheel events land in steps;
// easing the story toward the target keeps the stage motion smooth.
const SMOOTHING = 0.14

function DesktopStory() {
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
          <div className="hsb-blob-layer" style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, opacity: vals.blobsO, pointerEvents: 'none' }} aria-hidden>
            <DeferredMetaballs className="hsb-metaballs hsb-metaballs--top-left" count={7} />
            <DeferredMetaballs className="hsb-metaballs hsb-metaballs--bottom-right" count={7} />
          </div>

          <div style={vals.gHero}>
            <HeroCopy />
          </div>

          <div style={vals.gNarr}>
            <Narration story={vals} />
          </div>

          <div style={vals.sStage}>
            <StoryStage story={vals} />
          </div>

          <div style={vals.sCue}>Scroll — watch Maya work</div>
        </div>
      </div>
    </div>
  )
}

/** The browser-framed dashboard mockup, animated by the story timeline. */
function StoryStage({ story }: { story: StoryVals }) {
  return (
    <div className="hsb-stage-frame">
      {/* browser chrome */}
      <div className="hsb-stage-chrome">
        <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
          <span style={dotStyle} />
          <span style={dotStyle} />
          <span style={dotStyle} />
        </div>
        <div className="hsb-stage-url">agent7even.ai/dashboard</div>
        <div style={{ width: 33, flex: 'none' }} />
      </div>

      {/* body */}
      <div className="hsb-stage-body">
        {/* icon rail — same icons as production hero mockup */}
        <div className="hsb-stage-rail">
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
        <div className="hsb-stage-chat">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: `1px solid ${LINE}` }}>
            <span className="hsb-b-orb hsb-b-orb--stage">
              <MayaOrb size={30} active />
            </span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>Maya</div>
              <div style={{ fontSize: 11, color: FAINT }}>Coordinates 12 specialist agents.</div>
            </div>
          </div>

          <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
            <div style={{ ...story.userMsg, display: 'flex', justifyContent: 'flex-end' }}>
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
                {story.typed}
                <span style={story.sCursor}>|</span>
              </div>
            </div>
            {REPLIES.map((text, i) => (
              <div key={text} style={story.replies[i]}>
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
        <div className="hsb-stage-main">
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
              {story.mayaPill}
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
                <div key={row.title} style={story.rows[i]}>
                  <CampaignRowView row={row} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const MOBILE_BREAKPOINT = 860
/** Full story loop duration on mobile (ms). */
const MOBILE_STORY_MS = 14000

/**
 * Mobile: document-flow layout. Hero copy stays put; the stage sits below it
 * and auto-plays the story once it enters the viewport — no scroll scrubbing,
 * so the Maya orb never detaches and type can't layer over the UI.
 */
function MobileStory() {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)
  const playingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const stage = stageRef.current
    if (!stage) return

    if (reduced) {
      setP(1)
      return
    }

    const stop = () => {
      playingRef.current = false
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    const tick = (now: number) => {
      if (!playingRef.current) return
      const t = clamp((now - startRef.current) / MOBILE_STORY_MS, 0, 1)
      // Ease in/out so the loop doesn't feel mechanical.
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      setP(eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Hold at the end, then loop.
        window.setTimeout(() => {
          if (!playingRef.current) return
          startRef.current = performance.now()
          rafRef.current = requestAnimationFrame(tick)
        }, 1600)
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting)
        if (visible && !playingRef.current) {
          playingRef.current = true
          startRef.current = performance.now()
          rafRef.current = requestAnimationFrame(tick)
        } else if (!visible) {
          stop()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(stage)
    return () => {
      io.disconnect()
      stop()
    }
  }, [])

  const story = useMemo(() => storyVals(p), [p])

  return (
    <div ref={rootRef} className="hsb-b hsb-b--mobile">
      <div className="hsb-mobile-metaballs hsb-blob-layer" aria-hidden>
        <DeferredMetaballs className="hsb-metaballs hsb-metaballs--top-left" count={7} />
        <DeferredMetaballs className="hsb-metaballs hsb-metaballs--bottom-right" count={7} />
      </div>

      <div className="hsb-mobile-copy">
        <HeroCopy />
      </div>

      <div ref={stageRef} className="hsb-mobile-stage">
        <div className="hsb-mobile-stage-scale">
          <StoryStage story={story} />
        </div>
      </div>

      <div className="hsb-mobile-narr">
        <Narration story={story} />
      </div>
    </div>
  )
}

function ScrollHero() {
  const [mode, setMode] = useState<'desktop' | 'mobile' | null>(null)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const sync = () => setMode(mq.matches ? 'mobile' : 'desktop')
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // SSR / first paint: prefer mobile layout (no sticky 750vh trap) so phones
  // don't flash a broken scroll-scrub before hydration.
  if (mode === null || mode === 'mobile') return <MobileStory />
  return <DesktopStory />
}


export default function HomepageSiteBrandStoryB() {
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
    <div className="lab5 lab5--hsb-header-back">
      <MarketingNav />
      <div className="hsb-header-backdrop" aria-hidden />

      <ScrollHero />

      <MarketingHomepageBelowFold faqLocation="landing_variant_b" footerCtaLocation="footer_cta_variant_b" />
    </div>
  )
}
