import type { CSSProperties } from 'react'

export const ink = '#1B2236'
export const body = '#4A5061'
export const muted = '#5B6070'
export const line = '#ECEDF1'
export const blue = '#3355D6'
export const serif = 'var(--voix-serif), Georgia, serif'
export const sans = 'var(--voix-sans), system-ui, sans-serif'

export const wrap: CSSProperties = { maxWidth: 1320, margin: '0 auto', paddingLeft: 'clamp(20px, 3vw, 40px)', paddingRight: 'clamp(20px, 3vw, 40px)' }
export const h2: CSSProperties = { margin: 0, fontFamily: serif, fontWeight: 400, fontSize: 'clamp(42px, 5vw, 64px)', lineHeight: 1, letterSpacing: '-0.02em' }
export const eyebrow: CSSProperties = { margin: 0, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted }
export const pillDark: CSSProperties = { textDecoration: 'none', background: ink, color: '#FFFFFF', borderRadius: 999, padding: '16px 26px', fontSize: 16, fontWeight: 500, display: 'inline-block' }
export const pillLight: CSSProperties = { textDecoration: 'none', border: '1px solid #D5D8E0', background: '#FFFFFF', color: ink, borderRadius: 999, padding: '16px 26px', fontSize: 16, display: 'inline-block' }

/** Set NEXT_PUBLIC_VOIX_DEMO_PHONE (e.g. +14805550123) in Vercel to show the "Call" buttons. */
const demoPhone = process.env.NEXT_PUBLIC_VOIX_DEMO_PHONE?.trim()
export const DEMO_TEL: string | null = demoPhone ? `tel:${demoPhone}` : null
