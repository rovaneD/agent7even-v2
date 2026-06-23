'use client'

import { useId } from 'react'
import type { ContentPlatform } from '@/lib/agents/contentPosting/platformFormats'
import { PLATFORM_BRAND_ICONS } from '@/lib/agents/contentPosting/platformBrandIcons'

type Props = {
  platform: ContentPlatform
  size?: number
  className?: string
}

/** Crisp platform logos — integer px, official Simple Icons paths. */
export default function PlatformBrandIcon({ platform, size = 26, className = '' }: Props) {
  const gradId = useId().replace(/:/g, '')
  const dim = Math.round(size)
  const icon = PLATFORM_BRAND_ICONS[platform]
  const fill = icon.gradient ? `url(#${gradId})` : `#${icon.hex}`

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: dim, height: dim }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        className="block"
      >
        {icon.gradient && (
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={icon.gradient[0]} />
              <stop offset="45%" stopColor={icon.gradient[1]} />
              <stop offset="100%" stopColor={icon.gradient[2]} />
            </linearGradient>
          </defs>
        )}
        <path d={icon.path} fill={fill} />
      </svg>
    </span>
  )
}
