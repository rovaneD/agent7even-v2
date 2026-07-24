'use client'

/**
 * Design-concept Maya mark — same sunburst as marketing (How it works / product MayaOrb).
 * Keeps size + state wrappers so GSAP story beats can still target .dc-maya.
 */

import MayaOrb from '@/components/maya/MayaOrb'

export type MayaPresenceState =
  | 'idle'
  | 'listening'
  | 'reading'
  | 'coordinating'
  | 'routing'
  | 'complete'

type Props = {
  state?: MayaPresenceState
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  fragmented?: boolean
  ariaHidden?: boolean
  label?: string
}

const SIZE_MAP = {
  sm: 56,
  md: 80,
  lg: 112,
  xl: 148,
} as const

const ACTIVE_STATES: MayaPresenceState[] = [
  'listening',
  'reading',
  'coordinating',
  'routing',
]

export default function MayaPresence({
  state = 'idle',
  size = 'md',
  className = '',
  fragmented = false,
  ariaHidden = true,
  label = 'Maya',
}: Props) {
  const px = SIZE_MAP[size]
  const active = ACTIVE_STATES.includes(state)

  return (
    <div
      className={`dc-maya dc-maya--orb dc-maya--${state}${fragmented ? ' dc-maya--fragmented' : ''} dc-maya--${size} ${className}`.trim()}
      style={{ width: px, height: px }}
      aria-hidden={ariaHidden}
      role={ariaHidden ? undefined : 'img'}
      aria-label={ariaHidden ? undefined : label}
    >
      <MayaOrb size={px} active={active} />
    </div>
  )
}
