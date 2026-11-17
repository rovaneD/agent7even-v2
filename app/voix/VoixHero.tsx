'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO_TEL, ink } from './voixStyles'

type Line = { who: 'caller' | 'voix'; text: string }
type Scenario = { chip: string; title: string; sub: string; video: string; poster: string; lines: Line[] }

const SCENE_MS = 7400
const FADE_MS = 900
const FIRST_BUBBLE_MS = 400
const BUBBLE_GAP_MS = 1500

const SCENARIOS: Scenario[] = [
  {
    chip: 'After hours', title: 'After-hours booking', sub: 'Books consults while you’re closed',
    video: '/voix/call-1.mp4', poster: '/voix/call-1.jpg',
    lines: [
      { who: 'caller', text: 'Do you have a lip filler consult this week?' },
      { who: 'voix', text: 'I have Thursday at 4:30 or Friday at 11. Which works better?' },
      { who: 'caller', text: 'Friday, please.' },
      { who: 'voix', text: 'You’re booked for Friday at 11. I’ve texted you a secure deposit link.' },
    ],
  },
  {
    chip: 'New client', title: 'First-time clients', sub: 'Guides new callers to a consultation',
    video: '/voix/call-2.mp4', poster: '/voix/call-2.jpg',
    lines: [
      { who: 'caller', text: 'Hi, I’ve never been in before. Where do I start?' },
      { who: 'voix', text: 'Welcome! Most new clients start with a free 20-minute consultation.' },
      { who: 'caller', text: 'That sounds perfect.' },
      { who: 'voix', text: 'Great. Does a weekday or Saturday work better for you?' },
    ],
  },
  {
    chip: 'Pricing', title: 'Pricing questions', sub: 'Answers with your approved prices',
    video: '/voix/call-3.mp4', poster: '/voix/call-3.jpg',
    lines: [
      { who: 'caller', text: 'How much is Botox?' },
      { who: 'voix', text: 'It’s priced per unit, and most areas take twenty to forty units.' },
      { who: 'voix', text: 'Your provider confirms the exact amount at a free consult. Want me to book one?' },
      { who: 'caller', text: 'Sure, Saturday morning?' },
    ],
  },
  {
    chip: 'Reschedule', title: 'Rescheduling', sub: 'Moves appointments in seconds',
    video: '/voix/call-4.mp4', poster: '/voix/call-4.jpg',
    lines: [
      { who: 'caller', text: 'I need to move my HydraFacial on Thursday.' },
      { who: 'voix', text: 'No problem. I can do Saturday at 10 or Monday at 2.' },
      { who: 'caller', text: 'Monday works.' },
      { who: 'voix', text: 'Done. You’ll get a confirmation by text.' },
    ],
  },
  {
    chip: 'Specials', title: 'Monthly specials', sub: 'Promotes exactly what you approve',
    video: '/voix/call-5.mp4', poster: '/voix/call-5.jpg',
    lines: [
      { who: 'caller', text: 'I saw your post about a lip filler special?' },
      { who: 'voix', text: 'Yes! This month first-time lip filler clients get our new-client special.' },
      { who: 'caller', text: 'Can I book that?' },
      { who: 'voix', text: 'Of course. I have Wednesday at 3 or Thursday at 11.' },
    ],
  },
  {
    chip: 'Provider question', title: 'Clinical questions', sub: 'Hands off to your providers',
    video: '/voix/call-6.mp4', poster: '/voix/call-6.jpg',
    lines: [
      { who: 'caller', text: 'I’m on a blood thinner. Is filler safe for me?' },
      { who: 'voix', text: 'That’s a great question for one of our providers.' },
      { who: 'voix', text: 'I can have a provider call you back today. Would that help?' },
      { who: 'caller', text: 'Yes, please.' },
    ],
  },
]

const pinkOrb = 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #F6C6D3 38%, #D9708F 100%)'
const blueOrb = 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #A9C8FF 38%, #3A6FF2 100%)'

export default function VoixHero() {
  const [idx, setIdx] = useState(0)
  const [shown, setShown] = useState(0)
  const [reduced, setReduced] = useState(false)
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const sceneTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const bubbleTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const startSceneTimer = useCallback(() => {
    if (sceneTimer.current) clearInterval(sceneTimer.current)
    if (reduced) return
    sceneTimer.current = setInterval(() => setIdx((i) => (i + 1) % SCENARIOS.length), SCENE_MS)
  }, [reduced])

  useEffect(() => {
    startSceneTimer()
    return () => { if (sceneTimer.current) clearInterval(sceneTimer.current) }
  }, [startSceneTimer])

  // Play the active video from its first frame; freeze the rest so nothing loops mid-fade.
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return
      if (i === idx && !reduced) {
        try { v.currentTime = 0 } catch {}
        v.play().catch(() => {})
      } else {
        v.pause()
      }
    })
  }, [idx, reduced])

  // Ease the bubbles in one by one for the active scene.
  useEffect(() => {
    bubbleTimers.current.forEach(clearTimeout)
    bubbleTimers.current = []
    if (reduced) { setShown(4); return }
    setShown(0)
    for (let n = 0; n < 4; n++) {
      bubbleTimers.current.push(setTimeout(() => setShown(n + 1), FIRST_BUBBLE_MS + n * BUBBLE_GAP_MS))
    }
    return () => bubbleTimers.current.forEach(clearTimeout)
  }, [idx, reduced])

  const pick = (i: number) => { setIdx(i); startSceneTimer() }
  const current = SCENARIOS[idx]
  const ease = reduced ? 'none' : 'opacity 700ms ease, transform 700ms cubic-bezier(0.2, 0.7, 0.2, 1)'

  return (
    <div style={{ flex: '1.45 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        .voix-chips { scrollbar-width: none; }
        .voix-chips::-webkit-scrollbar { display: none; }
        @media (max-width: 640px) {
          .voix-chips { flex-wrap: nowrap !important; overflow-x: auto; margin-right: calc(-1 * clamp(20px, 3vw, 40px)); padding-right: clamp(20px, 3vw, 40px); }
          .voix-card { min-height: 560px !important; padding: 16px !important; }
          .voix-bubble { max-width: 88% !important; font-size: 14px !important; }
          .voix-bubble-caller { max-width: 80% !important; }
          .voix-title { font-size: 17px !important; }
          .voix-sub { font-size: 14px !important; }
        }
      `}</style>

      <div role="group" aria-label="Demo scenarios" className="voix-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SCENARIOS.map((s, i) => {
          const on = i === idx
          return (
            <button
              key={s.chip}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={on}
              style={{ flex: '0 0 auto', whiteSpace: 'nowrap', font: 'inherit', fontSize: 13, borderRadius: 999, padding: '9px 16px', minHeight: 38, cursor: 'pointer', border: on ? `1px solid ${ink}` : '1px solid #E1E4EA', background: on ? ink : '#FFFFFF', color: on ? '#FFFFFF' : ink }}
            >
              {s.chip}
            </button>
          )
        })}
      </div>

      <div className="voix-card" style={{ position: 'relative', flex: '1 1 auto', minHeight: 'clamp(600px, 56vw, 660px)', borderRadius: 28, overflow: 'hidden', background: '#2B2A2E', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 16, padding: 22 }}>
        {SCENARIOS.map((s, i) => (
          <video
            key={s.video}
            ref={(el) => { videos.current[i] = el }}
            src={s.video}
            poster={s.poster}
            muted
            loop
            playsInline
            preload={i === 0 ? 'auto' : 'metadata'}
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: `opacity ${FADE_MS}ms ease-in-out`, opacity: i === idx ? 1 : 0 }}
          />
        ))}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%)' }} />

        {/* Each scene's bubbles share one grid cell, so the stage is sized by its tallest scene and nothing overlaps. */}
        <div aria-live="polite" style={{ position: 'relative', display: 'grid' }}>
          {SCENARIOS.map((s, si) => {
            const active = si === idx
            return (
              <div key={s.chip} aria-hidden={!active} style={{ gridArea: '1 / 1', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 10, pointerEvents: active ? 'auto' : 'none' }}>
                {s.lines.map((l, i) => {
                  const isVoix = l.who === 'voix'
                  const visible = active && i < shown
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: isVoix ? 'flex-start' : 'flex-end',
                        transition: ease,
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'translateY(0)' : 'translateY(12px)',
                      }}
                    >
                      {isVoix ? (
                        <div className="voix-bubble" style={{ maxWidth: 'min(70%, 400px)', display: 'flex', alignItems: 'center', gap: 10, background: '#FFFFFF', color: ink, borderRadius: 18, padding: '10px 16px 10px 10px', fontSize: 15, lineHeight: 1.4, boxShadow: '0 8px 24px rgba(0,0,0,0.16)' }}>
                          <span aria-hidden="true" style={{ flex: '0 0 auto', width: 24, height: 24, borderRadius: 999, background: pinkOrb }} />
                          <span>{l.text}</span>
                        </div>
                      ) : (
                        <div className="voix-bubble voix-bubble-caller" style={{ maxWidth: 'min(60%, 340px)', background: 'rgba(255,255,255,0.3)', color: '#FFFFFF', borderRadius: 18, padding: '10px 16px', fontSize: 15, lineHeight: 1.4, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
                          {l.text}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span aria-hidden="true" style={{ flex: '0 0 auto', width: 44, height: 44, borderRadius: 999, border: '3px solid rgba(255,255,255,0.9)', background: blueOrb }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#FFFFFF' }}>
              <span className="voix-title" style={{ fontSize: 19, fontWeight: 600 }}>{current.title}</span>
              <span className="voix-sub" style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>{current.sub}</span>
            </div>
          </div>
          {DEMO_TEL && (
            <a href={DEMO_TEL} style={{ textDecoration: 'none', background: '#FFFFFF', color: ink, borderRadius: 999, padding: '13px 22px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>
              Call Voix now
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
