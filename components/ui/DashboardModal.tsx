'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const PANEL_BASE =
  'relative flex w-full max-h-[90dvh] flex-col overflow-hidden rounded-[24px] border border-border bg-surface shadow-2xl'

/** Centered dashboard modal — caps height on mobile and keeps body scrollable. */
export function DashboardModalShell({
  onClose,
  panelClassName,
  zIndex = 'z-50',
  backdropClassName,
  roundedClassName,
  children,
}: {
  onClose?: () => void
  panelClassName?: string
  zIndex?: string
  backdropClassName?: string
  /** Override when panel uses rounded-2xl instead of rounded-[24px]. */
  roundedClassName?: string
  children: ReactNode
}) {
  return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-4', zIndex)}>
      <div
        className={cn('absolute inset-0 bg-black/40', backdropClassName)}
        onClick={onClose}
        aria-hidden={onClose ? true : undefined}
      />
      <div
        className={cn(
          PANEL_BASE,
          roundedClassName,
          panelClassName ?? 'max-w-lg',
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}

export function DashboardModalScrollBody({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', className)}>
      {children}
    </div>
  )
}
