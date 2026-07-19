import { ImageResponse } from 'next/og'

// Default sitewide OG image — route segments can override with their own
// opengraph-image file if a page ever needs bespoke share art.
export const alt = 'Agent7even — Your AI marketing team'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#FFFFFF',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 9999,
              background: '#F5349B',
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Agent7even
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: '#0F172A',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
            }}
          >
            Your AI marketing team
          </div>
          <div style={{ fontSize: 34, color: '#475569', letterSpacing: '-0.01em' }}>
            One foundation. Twelve specialist agents. One approval queue.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#3B82F6',
              color: '#FFFFFF',
              fontSize: 26,
              fontWeight: 600,
              padding: '18px 36px',
              borderRadius: 9999,
            }}
          >
            Start your free trial
          </div>
          <div style={{ fontSize: 26, color: '#94A3B8' }}>agent7even.ai</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
