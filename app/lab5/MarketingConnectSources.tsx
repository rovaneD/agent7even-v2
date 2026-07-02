'use client'

import PlatformBrandIcon from '@/components/agents/contentPosting/PlatformBrandIcon'
import type { ContentPlatform } from '@/lib/agents/contentPosting/platformFormats'

type ConnectSource =
  | { kind: 'platform'; platform: ContentPlatform; label: string }
  | { kind: 'google-analytics'; label: string }

const CONNECT_SOURCES: ConnectSource[] = [
  { kind: 'platform', platform: 'Instagram', label: 'Instagram' },
  { kind: 'platform', platform: 'Facebook', label: 'Facebook' },
  { kind: 'platform', platform: 'LinkedIn', label: 'LinkedIn' },
  { kind: 'platform', platform: 'X', label: 'X (Growth+)' },
  { kind: 'platform', platform: 'YouTube', label: 'YouTube' },
  { kind: 'google-analytics', label: 'Google Analytics' },
]

/** Official GA mark (Simple Icons googleanalytics, MIT). */
const GOOGLE_ANALYTICS_ICON = {
  path: 'M22.84 2.9982v17.9987c.0086 1.6473-1.3197 2.9897-2.967 2.9984a2.9808 2.9808 0 0 1-.3677-.0208c-1.528-.226-2.6477-1.5558-2.6105-3.1V3.1204c-.0369-1.5458 1.0856-2.8762 2.6157-3.1 1.6361-.1915 3.1178.9796 3.3093 2.6158.014.1201.0208.241.0202.3619zM4.1326 18.0548c-1.6417 0-2.9726 1.331-2.9726 2.9726C1.16 22.6691 2.4909 24 4.1326 24s2.9726-1.3309 2.9726-2.9726-1.331-2.9726-2.9726-2.9726zm7.8728-9.0098c-.0171 0-.0342 0-.0513.0003-1.6495.0904-2.9293 1.474-2.891 3.1256v7.9846c0 2.167.9535 3.4825 2.3505 3.763 1.6118.3266 3.1832-.7152 3.5098-2.327.04-.1974.06-.3983.0593-.5998v-8.9585c.003-1.6474-1.33-2.9852-2.9773-2.9882z',
  hex: 'E37400',
}

function GoogleAnalyticsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="block shrink-0"
    >
      <path d={GOOGLE_ANALYTICS_ICON.path} fill={`#${GOOGLE_ANALYTICS_ICON.hex}`} />
    </svg>
  )
}

export default function MarketingConnectSources() {
  return (
    <div className="sources reveal">
      <span className="lead-in">Connect via Agent7even</span>
      {CONNECT_SOURCES.map(source => (
        <div key={source.label} className="source">
          <span className="source-icon" aria-hidden>
            {source.kind === 'platform'
              ? <PlatformBrandIcon platform={source.platform} size={18} />
              : <GoogleAnalyticsIcon size={18} />}
          </span>
          <span>{source.label}</span>
        </div>
      ))}
    </div>
  )
}
