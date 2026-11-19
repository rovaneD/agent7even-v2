'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { trackEvent } from '@/lib/gtag'
import { blue, body, eyebrow, h2, ink, line, muted, serif, wrap } from './voixStyles'

const WEEKS_PER_MONTH = 52 / 12

const SOURCES = {
  zenoti: 'https://www.zenoti.com/thecheckin/how-track-salon-call-conversion-rate',
  amspa: 'https://americanmedspa.org/blog/2024-medical-spa-state-of-the-industry-executive-report-recap',
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

type SliderProps = {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step: number
  format: (n: number) => string
  onChange: (n: number) => void
}

function Slider({ label, hint, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: blue }}
      />
      <span style={{ fontSize: 13, lineHeight: 1.5, color: muted }}>{hint}</span>
    </label>
  )
}

const stat: CSSProperties = { flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${line}`, paddingTop: 20 }
const statNum: CSSProperties = { fontFamily: serif, fontSize: 'clamp(44px, 5vw, 60px)', lineHeight: 1, letterSpacing: '-0.02em' }
const srcLink: CSSProperties = { color: muted, fontSize: 12 }

export default function MissedCallCost() {
  const [calls, setCalls] = useState(80)
  const [missedPct, setMissedPct] = useState(37)
  const [bookPct, setBookPct] = useState(20)
  const [visit, setVisit] = useState(527)
  const used = useRef(false)
  // One event the first time someone moves a slider: they engaged with the cost math.
  const onAny = <T,>(set: (v: T) => void) => (v: T) => {
    if (!used.current) {
      used.current = true
      trackEvent('voix_calculator_used')
    }
    set(v)
  }

  const missedPerWeek = calls * (missedPct / 100)
  const lostBookingsPerMonth = missedPerWeek * (bookPct / 100) * WEEKS_PER_MONTH
  const lostPerMonth = lostBookingsPerMonth * visit

  return (
    <section id="cost" style={{ borderTop: `1px solid ${line}` }}>
      <div style={{ ...wrap, paddingTop: 88, paddingBottom: 88, display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
          <p style={eyebrow}>The true cost of missed calls</p>
          <h2 style={h2}>Every unanswered call is a booking someone else gets.</h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: body }}>
            Most missed calls don’t happen after hours. They happen at 2pm, while your team is with a client. And a caller who wants Botox
            this week rarely waits for a callback.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
          <div style={stat}>
            <span style={statNum}>37%</span>
            <span style={{ fontSize: 15, lineHeight: 1.5, color: body }}>of calls to salons and spas go unanswered.</span>
            <a href={SOURCES.zenoti} target="_blank" rel="noreferrer" style={srcLink}>Zenoti call data</a>
          </div>
          <div style={stat}>
            <span style={statNum}>82%</span>
            <span style={{ fontSize: 15, lineHeight: 1.5, color: body }}>of those missed calls happen during business hours.</span>
            <a href={SOURCES.zenoti} target="_blank" rel="noreferrer" style={srcLink}>Zenoti call data</a>
          </div>
          <div style={stat}>
            <span style={statNum}>$527</span>
            <span style={{ fontSize: 15, lineHeight: 1.5, color: body }}>is what the average med spa patient spends per visit.</span>
            <a href={SOURCES.amspa} target="_blank" rel="noreferrer" style={srcLink}>AmSpa 2024 State of the Industry</a>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 420px', minWidth: 0, background: '#F3F4F6', borderRadius: 24, padding: 'clamp(24px, 4vw, 36px)', display: 'flex', flexDirection: 'column', gap: 26 }}>
            <h3 style={{ margin: 0, fontSize: 21, fontWeight: 600 }}>Run your own numbers</h3>
            <Slider label="Calls per week" hint="All inbound calls to your spa." value={calls} min={20} max={400} step={5} format={(n) => String(n)} onChange={onAny(setCalls)} />
            <Slider
              label="Calls that go unanswered"
              hint="Industry average is 37%. Include after-hours calls."
              value={missedPct}
              min={5}
              max={70}
              step={1}
              format={(n) => `${n}%`}
              onChange={onAny(setMissedPct)}
            />
            <Slider
              label="Missed callers who would have booked"
              hint="New bookings only. We start at a conservative 20%."
              value={bookPct}
              min={5}
              max={60}
              step={1}
              format={(n) => `${n}%`}
              onChange={onAny(setBookPct)}
            />
            <Slider
              label="Value of a first visit"
              hint="AmSpa’s average spend per visit is $527."
              value={visit}
              min={100}
              max={2000}
              step={25}
              format={money}
              onChange={onAny(setVisit)}
            />
          </div>

          <div style={{ flex: '1 1 340px', minWidth: 0, background: ink, color: '#FFFFFF', borderRadius: 24, padding: 'clamp(24px, 4vw, 36px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 14, color: '#B9BFD0' }}>Potential booking value from missed calls</span>
              <span style={{ fontFamily: serif, fontSize: 'clamp(56px, 7vw, 84px)', lineHeight: 1, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
                {money(lostPerMonth)}
              </span>
              <span style={{ fontSize: 16, color: '#D9DDE8' }}>
                per month · {money(lostPerMonth * 12)} a year
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 15, lineHeight: 1.5, color: '#D9DDE8' }}>
              <span>
                That’s about <strong style={{ color: '#FFFFFF' }}>{Math.round(missedPerWeek)} missed calls a week</strong> and{' '}
                <strong style={{ color: '#FFFFFF' }}>{Math.round(lostBookingsPerMonth)} first visits a month at stake</strong>, before counting repeat
                visits, memberships or referrals.
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: '#B9BFD0' }}>
                An estimate from the numbers above, not a guarantee. Some callers leave a message, book online or call back, and not every
                consultation becomes a treatment. Your pilot report shows what Voix actually booked.
              </span>
              <a href="#pilot" style={{ alignSelf: 'flex-start', textDecoration: 'none', background: '#FFFFFF', color: ink, borderRadius: 999, padding: '14px 22px', fontSize: 15, fontWeight: 500 }}>
                Stop missing calls: apply for a spot
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
