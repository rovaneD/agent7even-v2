'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const PANEL_BASE =
  'relative flex w-full max-h-[90dvh] flex-col overflow-hidden rounded-[24px] border border-border bg-surface shadow-2xl'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

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
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Escape closes; Tab is trapped inside the panel; focus moves into the
  // dialog on open and returns to the opener on close.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    if (!panel.contains(document.activeElement)) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(first ?? panel).focus()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(el => el.offsetParent !== null || el === document.activeElement)
      if (!focusables.length) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-4', zIndex)}>
      <div
        className={cn('absolute inset-0 bg-black/40', backdropClassName)}
        onClick={onClose}
        aria-hidden={onClose ? true : undefined}
      />
      <div
        ref={panelRef}
        className={cn(
          PANEL_BASE,
          roundedClassName,
          panelClassName ?? 'max-w-lg',
        )}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
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
