'use client'

import { cn } from '@/lib/utils'
import './maya-orb.css'

const BAR_COUNT = 24
const CENTER = 16
const INNER_R = 10.5
const OUTER_R = 15.5
const INNER_RING_R = 9.25

type Props = {
  size?: number
  /** Faster pulse — panel open, streaming, thinking */
  active?: boolean
  className?: string
  /** Light bars for dark backgrounds (sidebar Maya button when open) */
  inverted?: boolean
}

function ringColor(inverted: boolean): string {
  return inverted ? '#93C5FD' : '#6366F1'
}

function barColor(index: number, inverted: boolean): string {
  if (inverted) {
    return index % 5 === 0 ? '#F9A8D4' : '#BFDBFE'
  }
  return index % 5 === 0 ? '#F5349B' : '#3B82F6'
}

export default function MayaOrb({
  size = 16,
  active = false,
  className,
  inverted = false,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        'maya-orb',
        active && 'maya-orb--active',
        inverted && 'maya-orb--inverted',
        className,
      )}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      aria-hidden
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={INNER_RING_R}
        stroke={ringColor(inverted)}
        strokeWidth={1.35}
        className="maya-orb-inner-ring"
      />

      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const angle = (i / BAR_COUNT) * 360
        const rad = (angle * Math.PI) / 180
        const x1 = CENTER + INNER_R * Math.sin(rad)
        const y1 = CENTER - INNER_R * Math.cos(rad)
        const x2 = CENTER + OUTER_R * Math.sin(rad)
        const y2 = CENTER - OUTER_R * Math.cos(rad)

        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={barColor(i, inverted)}
            strokeWidth={2.25}
            strokeLinecap="round"
            className="maya-orb-bar"
            style={{ animationDelay: `${(i / BAR_COUNT) * 1.2}s` }}
          />
        )
      })}
    </svg>
  )
}
