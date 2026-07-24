'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { LayoutGrid, Sparkles, Megaphone, Calendar, UserRound, ArrowUp } from 'lucide-react'
import MayaOrb from '@/components/maya/MayaOrb'
import './homepage-site-brand.css'

const MAYA_ACCENT = '#F5349B'
const NARRATION_MODE: 'margins' | 'overlay' | 'hidden' = 'margins'

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v
}

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t
}

const NARR_TEXT = [
  { title: 'Maya remembers.', body: 'Your Foundation — voice, regulars, offers, goals — is already there. Nothing to re-explain.' },
  { title: 'A campaign takes shape.', body: 'Built for Friday, from your context — not a template.' },
  { title: 'Twelve specialists. One system.', body: 'Coordinated by Maya, not stitched together by you.' },
  { title: 'Real work, produced.', body: 'Emails, posts, creative — finished drafts, in your voice.' },
  { title: 'Everything waits for you.', body: 'One approval queue. Nothing publishes without you.' },
]

const REPLIES = [
  'On it — pulling from your Foundation now.',
  'Campaign, email, and posts are underway. Twelve specialists are on it.',
  'Everything lands in your queue. Nothing publishes without you.',
]

type CampaignRow = { dot: string; title: string; subtitle: string; pill: string; pillBg: string; pillColor: string }

const CAMPAIGN_ROWS: CampaignRow[] = [
  {
    dot: '#22C55E',
    title: 'Instagram posts approved',
    subtitle: '3 posts + story · captions in Brand Kit voice',
    pill: 'Approved',
    pillBg: '#DCFCE7',
    pillColor: '#15803D',
  },
  {
    dot: '#F59E0B',
    title: 'Slow Friday Fix',
    subtitle: 'Campaign drafted by Maya · ready to review',
    pill: 'Draft',
    pillBg: '#FEF3C7',
    pillColor: '#B45309',
  },
  {
    dot: '#3B82F6',
    title: '“This Friday, bring a friend”',
    subtitle: 'Email sequence · to regulars (412)',
    pill: 'Queued',
    pillBg: '#DBEAFE',
    pillColor: '#1D4ED8',
  },
]

const STATS = [
  { value: '3', label: 'Awaiting approval' },
  { value: '12', label: 'Drafted this week', accent: true },
  { value: '2', label: 'Campaigns in progress' },
]

function renderVals(p: number, vw: number, vh: number) {
  const seg = (a: number, b: number) => clamp((p - a) / (b - a), 0, 1)
  const fadeUp = (t: number, width = 0.06): CSSProperties => {
    const o = seg(t, t + width)
    return { opacity: o, transform: `translateY(${(6 * (1 - o)).toFixed(2)}px)` }
  }

  const accent = MAYA_ACCENT
  let mode: 'margins' | 'overlay' | 'hidden' = NARRATION_MODE
  let s = Math.min(1, (vw - 48) / 1040, (vh - 130) / 600)
  if (mode === 'margins' && (vw - 1040 * s) / 2 < 275) mode = 'overlay'
  if (mode === 'overlay') s = Math.min(1, (vw - 48) / 1040, (vh - 210) / 600)

  const gNarr: CSSProperties =
    mode === 'hidden'
      ? { display: 'none' }
      : mode === 'margins'
        ? { position: 'absolute', left: Math.max(20, (vw - 1040 * s) / 2 - 262), top: '50%', width: 230, height: 230, transform: 'translateY(-55%)', zIndex: 1 }
        : { position: 'absolute', left: '50%', top: vh / 2 + 300 * s + 14, width: 620, height: 96, transform: 'translateX(-50%)', textAlign: 'center', zIndex: 3 }

  const heroO = 1 - seg(0.08, 0.13)
  const gHero: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: Math.max(58, vh / 2 - 300 * s - 150),
    width: 760,
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

  const msg = "Fill next Friday. It’s our slowest day."
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
    accent,
    typed,
    mayaPill: mayaState === 'Complete' ? 'All caught up' : `Maya is ${mayaState.toLowerCase()}`,
    sStage: {
      width: 1040,
      height: 600,
      flex: 'none',
      transform: `translateY(${(heroO * Math.max(0, (gHero.top! as number) + 175 - (vh / 2 - 300 * s))).toFixed(1)}px) scale(${s})`,
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
      color: '#8A857B',
      zIndex: 3,
    } as CSSProperties,
    gNarr,
    gHero,
    n: [nst(nO(0.14, 0.3)), nst(nO(0.325, 0.465)), nst(nO(0.48, 0.625)), nst(nO(0.645, 0.815)), nst(seg(0.845, 0.885))],
    sCursor: (p < 0.095
      ? { color: accent, animation: 'a7blink 1s steps(1) infinite' }
      : { opacity: 0, animation: 'none' }) as CSSProperties,
    userMsg: fadeUp(0, 0.02),
    replies: [fadeUp(0.1), fadeUp(0.3), fadeUp(0.5)],
    rows: [fadeUp(0.6), fadeUp(0.7), fadeUp(0.8)],
  }
}

const dotStyle: CSSProperties = { width: 9, height: 9, borderRadius: '50%', background: '#D8D4CB' }

const railIconStyle: CSSProperties = { color: '#B7B2A6' }

const replyBubbleStyle: CSSProperties = {
  alignSelf: 'flex-start',
  maxWidth: '92%',
  background: '#F5F5F4',
  color: '#1A1917',
  borderRadius: 14,
  padding: '10px 14px',
  fontSize: 13,
  lineHeight: 1.45,
}

function StatCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, background: '#FAFAF9', border: '1px solid rgba(26,25,23,.08)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ? '#16A34A' : '#1A1917' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#8A857B', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function CampaignRowView({ row }: { row: CampaignRow }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(26,25,23,.08)', borderRadius: 12, padding: '12px 16px' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.dot, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.title}</div>
        <div style={{ fontSize: 11.5, color: '#8A857B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.subtitle}</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, background: row.pillBg, color: row.pillColor, padding: '4px 11px', borderRadius: 99, flex: 'none' }}>
        {row.pill}
      </span>
    </div>
  )
}

export default function HomepageSiteBrandStory() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const [{ p, vw, vh }, setMeasured] = useState({ p: 0, vw: 1440, vh: 900 })

  useEffect(() => {
    const measure = () => {
      const nextVw = window.innerWidth
      const nextVh = window.innerHeight
      let nextP = 0
      const el = scrollRef.current
      if (el) {
        const r = el.getBoundingClientRect()
        nextP = clamp(-r.top / (r.height - nextVh), 0, 1)
      }
      setMeasured({ p: nextP, vw: nextVw, vh: nextVh })
    }
    const sync = () => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        measure()
      })
    }
    window.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    measure()
    return () => {
      window.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const vals = useMemo(() => renderVals(p, vw, vh), [p, vw, vh])

  return (
    <div className="homepage-site-brand" style={{ ['--maya' as string]: vals.accent, minHeight: '100vh' } as CSSProperties}>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 28px',
          background: 'rgba(255,255,255,.94)',
          borderBottom: '1px solid rgba(26,25,23,.08)',
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/agent7even_logo.svg" alt="Agent7even" style={{ height: 27, display: 'block' }} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26, fontSize: 13, color: '#3D3A34' }}>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/agents">Agents</Link>
          <Link href="/pricing">Pricing</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13 }}>
          <Link href="/sign-in">Sign in</Link>
          <Link
            href="/pricing"
            className="hsb-cta"
            style={{ background: '#1A1917', color: '#FFFFFF', padding: '8px 16px', borderRadius: 99, fontWeight: 600 }}
          >
            Start free trial
          </Link>
        </div>
      </nav>

      <div ref={scrollRef} style={{ height: '750vh', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={vals.gHero}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 54, lineHeight: 1.08, marginBottom: 14 }}>Marketing, managed.</div>
            <div style={{ fontSize: 17, lineHeight: 1.55, color: '#6F6A61' }}>You describe the goal. One sentence — that&apos;s the whole job.</div>
          </div>

          <div style={vals.gNarr}>
            {NARR_TEXT.map((item, i) => (
              <div key={item.title} style={vals.n[i]}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, lineHeight: 1.15, marginBottom: 10 }}>{item.title}</div>
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
                  borderBottom: '1px solid rgba(26,25,23,.08)',
                  background: '#FAFAF9',
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
                    fontSize: 11.5,
                    color: '#8A857B',
                    background: '#EFEFED',
                    borderRadius: 6,
                    padding: '5px 0',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                  }}
                >
                  agent7even.ai/dashboard
                </div>
                <div style={{ width: 33, flex: 'none' }} />
              </div>

              {/* body */}
              <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                {/* icon rail */}
                <div
                  style={{
                    width: 56,
                    flex: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 20,
                    padding: '18px 0',
                    borderRight: '1px solid rgba(26,25,23,.08)',
                  }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A1917', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/agent7even_mark.svg" alt="" style={{ width: 15, height: 15 }} />
                  </div>
                  <div style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(59,130,246,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LayoutGrid size={16} color="#3B82F6" />
                  </div>
                  <Sparkles size={16} style={railIconStyle} />
                  <Megaphone size={16} style={railIconStyle} />
                  <Calendar size={16} style={railIconStyle} />
                  <div style={{ marginTop: 'auto' }}>
                    <UserRound size={16} style={railIconStyle} />
                  </div>
                </div>

                {/* chat column */}
                <div style={{ width: 334, flex: 'none', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(26,25,23,.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid rgba(26,25,23,.06)' }}>
                    <MayaOrb size={32} active />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>Maya</div>
                      <div style={{ fontSize: 11, color: '#8A857B' }}>Coordinates 12 specialist agents.</div>
                    </div>
                  </div>

                  <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
                    <div style={vals.userMsg}>
                      <div style={{ alignSelf: 'flex-start', maxWidth: '92%', background: '#3B82F6', color: '#fff', borderRadius: 14, padding: '10px 14px', fontSize: 13, lineHeight: 1.45, minHeight: 20 }}>
                        {vals.typed}
                        <span style={vals.sCursor}>▍</span>
                      </div>
                    </div>
                    {REPLIES.map((text, i) => (
                      <div key={text} style={vals.replies[i]}>
                        <div style={replyBubbleStyle}>{text}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(26,25,23,.06)', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, fontSize: 12.5, color: '#8A857B', background: '#F5F5F4', borderRadius: 99, padding: '9px 14px' }}>Message Maya…</div>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A1917', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <ArrowUp size={14} color="#fff" />
                    </div>
                  </div>
                </div>

                {/* dashboard column */}
                <div style={{ flex: 1, padding: '22px 26px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 700 }}>Good morning</div>
                      <div style={{ fontSize: 12.5, color: '#8A857B', marginTop: 2 }}>Here&apos;s where things stand</div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11.5,
                        color: '#3D3A34',
                        border: '1px solid rgba(26,25,23,.12)',
                        borderRadius: 99,
                        padding: '5px 12px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
                      {vals.mayaPill}
                    </div>
                  </div>

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

          <div style={vals.sCue}>Scroll — watch Maya work</div>
        </div>
      </div>

      <footer data-screen-label="Footer" style={{ position: 'relative', borderTop: '1px solid rgba(26,25,23,.1)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '110px 40px 80px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 44, lineHeight: 1.15, margin: '0 0 18px' }}>
            One Foundation.
            <br />
            Twelve specialist agents.
            <br />
            One approval queue.
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: '#3D3A34', maxWidth: 480, margin: '0 auto 28px' }}>
            Maya reads your Foundation and Brand Kit before every draft. Every campaign lands in your queue before anything goes live.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
            <Link href="/pricing" className="hsb-cta" style={{ background: '#1A1917', color: '#FFFFFF', padding: '12px 24px', borderRadius: 99, fontSize: 14, fontWeight: 600 }}>
              Start your free trial
            </Link>
            <Link href="/pricing" style={{ border: '1px solid rgba(26,25,23,.25)', padding: '12px 24px', borderRadius: 99, fontSize: 14, fontWeight: 600 }}>
              See plans →
            </Link>
          </div>
          <p style={{ fontSize: 12, color: '#8A857B', margin: '16px 0 0' }}>3-day free trial. No charge until day 4.</p>
        </div>
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 40px 70px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '.1em', color: '#8A857B', fontWeight: 600, marginBottom: 12 }}>BUILT FOR THE WAY YOU WORK</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
              <Link href="/use-cases/local-service">Local service businesses →</Link>
              <Link href="/use-cases/ecommerce">E-commerce brands →</Link>
              <Link href="/for-coaches">Coaches, creators &amp; solo founders →</Link>
              <Link href="/use-cases">Startups &amp; early-stage teams →</Link>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '.1em', color: '#8A857B', fontWeight: 600, marginBottom: 12 }}>QUESTIONS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
              <Link href="/pricing">How much does AI marketing cost? →</Link>
              <Link href="/how-it-works">How does the approval flow work? →</Link>
              <Link href="/agents">Does the copy actually sound like me? →</Link>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(26,25,23,.1)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#8A857B' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/agent7even_mark.svg" alt="" style={{ width: 18, height: 18, borderRadius: '50%' }} />© 2026 Agent7even, Inc.
          </span>
          <span style={{ display: 'flex', gap: 18 }}>
            <Link href="/privacy" style={{ color: '#8A857B' }}>Privacy</Link>
            <Link href="/terms" style={{ color: '#8A857B' }}>Terms</Link>
            <Link href="/security" style={{ color: '#8A857B' }}>Security</Link>
          </span>
          <span style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>Built for people with better things to do.</span>
        </div>
      </footer>
    </div>
  )
}
