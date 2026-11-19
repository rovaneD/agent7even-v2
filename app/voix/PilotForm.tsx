'use client'

import { useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { trackEvent } from '@/lib/gtag'
import { DEMO_TEL, blue, ink, muted } from './voixStyles'

const field: CSSProperties = { font: 'inherit', fontSize: 15, padding: '13px 14px', border: '1px solid #E1E4EA', borderRadius: 10, background: '#F7F8FA', color: ink, width: '100%', boxSizing: 'border-box' }
const label: CSSProperties = { fontSize: 13, fontWeight: 500 }
const group: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

export default function PilotForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const started = useRef(false)
  const [firstName, setFirstName] = useState('')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setError('')
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    setFirstName(String(data.name ?? '').trim().split(/\s+/)[0] ?? '')
    try {
      const res = await fetch('/api/voix/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.')
      trackEvent('voix_form_submit', { software: String(data.software ?? ''), locations: String(data.locations ?? '') })
      setStatus('sent')
    } catch (err) {
      trackEvent('voix_form_error', { message: err instanceof Error ? err.message : 'unknown' })
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  const box: CSSProperties = { flex: '1 1 440px', minWidth: 0, background: '#FFFFFF', borderRadius: 24, padding: 'clamp(24px, 4vw, 36px)', display: 'flex', flexDirection: 'column', gap: 18 }

  if (status === 'sent') return <PilotSubmitted box={box} firstName={firstName} />

  return (
    <form
      onSubmit={onSubmit}
      onFocus={(e) => {
        if (started.current) return
        started.current = true
        trackEvent('voix_form_start', { field: (e.target as HTMLElement).getAttribute('name') ?? '' })
      }}
      aria-label="Pilot application"
      style={box}
    >
      <div style={group}>
        <label htmlFor="voix-name" style={label}>Your name</label>
        <input id="voix-name" name="name" type="text" autoComplete="name" required style={field} />
      </div>
      <div style={group}>
        <label htmlFor="voix-spa" style={label}>Spa name</label>
        <input id="voix-spa" name="spa" type="text" autoComplete="organization" required style={field} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ ...group, flex: '1 1 180px' }}>
          <label htmlFor="voix-email" style={label}>Email</label>
          <input id="voix-email" name="email" type="email" autoComplete="email" required style={field} />
        </div>
        <div style={{ ...group, flex: '1 1 180px' }}>
          <label htmlFor="voix-phone" style={label}>Phone</label>
          <input id="voix-phone" name="phone" type="tel" autoComplete="tel" style={field} />
        </div>
      </div>
      <div style={group}>
        <label htmlFor="voix-instagram" style={label}>Spa Instagram</label>
        <input id="voix-instagram" name="instagram" type="text" placeholder="@yourspa" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={field} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ ...group, flex: '1 1 180px' }}>
          <label htmlFor="voix-software" style={label}>Booking software</label>
          <select id="voix-software" name="software" defaultValue="" style={field}>
            <option value="" disabled>Choose one</option>
            <option>Zenoti</option>
            <option>Boulevard</option>
            <option>Vagaro</option>
            <option>Mangomint</option>
            <option>GlossGenius</option>
            <option>Other</option>
          </select>
        </div>
        <div style={{ ...group, flex: '1 1 180px' }}>
          <label htmlFor="voix-locations" style={label}>Locations</label>
          <select id="voix-locations" name="locations" defaultValue="1" style={field}>
            <option>1</option>
            <option>2–3</option>
            <option>4 or more</option>
          </select>
        </div>
      </div>
      {/* Honeypot: hidden from people, often filled by bots. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="voix-website">Website</label>
        <input id="voix-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <button type="submit" disabled={status === 'sending'} style={{ font: 'inherit', fontSize: 15, fontWeight: 500, background: ink, color: '#FFFFFF', border: 0, borderRadius: 999, padding: '16px 24px', minHeight: 52, cursor: status === 'sending' ? 'wait' : 'pointer', marginTop: 8, opacity: status === 'sending' ? 0.7 : 1 }}>
        {status === 'sending' ? 'Sending…' : 'Apply for a founding spot'}
      </button>
      {status === 'error' && <p role="alert" style={{ margin: 0, fontSize: 13, color: '#B4232A' }}>{error}</p>}
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: muted }}>We’ll reply within one business day. We never share your details.</p>
    </form>
  )
}

const stepNum: CSSProperties = { flex: '0 0 auto', width: 28, height: 28, borderRadius: 999, background: '#EEF2FF', color: blue, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const small: CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.6, color: muted }
const h4: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 600 }

const NEXT_STEPS: [string, string][] = [
  ['We review your application', 'We reply by email within one business day, from a real person on our team.'],
  ['30-minute setup call', 'We learn your treatments, pricing, policies and how you like to sound. We do the setup.'],
  ['You approve every answer', 'You review what Voix will say. Nothing goes live until you approve it.'],
  ['Voix starts answering', 'You forward missed and after-hours calls to Voix. Your number stays the same, and you get a summary of every call.'],
]

/** Shown after a successful application: what happens next, what the pilot is, what happens after. */
function PilotSubmitted({ box, firstName }: { box: CSSProperties; firstName: string }) {
  return (
    <div role="status" style={{ ...box, gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Thanks{firstName ? `, ${firstName}` : ''}. Your application is in.</h3>
        <p style={small}>We sent a confirmation to your email. Here’s what happens next.</p>
      </div>

      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {NEXT_STEPS.map(([title, text], i) => (
          <li key={title} style={{ display: 'flex', gap: 14 }}>
            <span style={stepNum}>{i + 1}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={h4}>{title}</span>
              <span style={small}>{text}</span>
            </div>
          </li>
        ))}
      </ol>

      <div style={{ borderTop: '1px solid #ECEDF1', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={h4}>The pilot</span>
        <p style={small}>
          14 days free, no credit card. We do the full setup at no cost. We ask for the setup call, access to your booking software and
          a short weekly check-in so we can tune Voix with you.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={h4}>When the 14 days end</span>
        <p style={small}>
          You get a results report on what Voix handled. We share founding-spa pricing during your trial, so you can decide with real
          numbers. There’s no obligation to continue: if you stop, you simply stop forwarding calls to Voix.
        </p>
      </div>

      <p style={small}>If the 10 founding spots fill, we’ll offer you a place in the next group.</p>

      {DEMO_TEL ? (
        <a href={DEMO_TEL} style={{ alignSelf: 'flex-start', textDecoration: 'none', background: ink, color: '#FFFFFF', borderRadius: 999, padding: '13px 22px', fontSize: 15, fontWeight: 500 }}>
          Hear Voix now: call the spa demo
        </a>
      ) : null}
    </div>
  )
}
