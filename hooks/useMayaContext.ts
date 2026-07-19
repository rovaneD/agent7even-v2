'use client'

import { useEffect, useMemo } from 'react'
import { serializeMayaPageContext, type MayaPageContext } from '@/lib/maya/contextTypes'

/** CustomEvent name DashboardShell listens for (DashboardShell.tsx ~290). */
export const MAYA_CANVAS_EVENT = 'maya:canvas-context'

declare global {
  interface Window {
    /** Latest dispatched Maya page context — lets late listeners catch up. */
    __MAYA_CANVAS_CONTEXT__?: string
  }
}

function dispatchMayaContext(context: string) {
  // On initial page load the page's dispatcher effect runs BEFORE
  // DashboardShell attaches its event listener (child effects fire first),
  // so also snapshot the value for the shell to read on attach.
  window.__MAYA_CANVAS_CONTEXT__ = context
  window.dispatchEvent(new CustomEvent(MAYA_CANVAS_EVENT, { detail: { context } }))
}

/** Latest context for listeners that attach after the page dispatched. */
export function currentMayaContext(): string {
  return typeof window === 'undefined' ? '' : (window.__MAYA_CANVAS_CONTEXT__ ?? '')
}

/**
 * Drop-in replacement for hand-rolled `window.dispatchEvent(new CustomEvent(...))`.
 * Re-dispatches whenever the payload changes; clears on unmount.
 */
export function useMayaContext(payload: MayaPageContext | null | undefined) {
  const payloadKey = payload ? JSON.stringify(payload) : ''

  const contextString = useMemo(() => {
    if (!payload) return ''
    return serializeMayaPageContext(payload)
  }, [payloadKey]) // eslint-disable-line react-hooks/exhaustive-deps -- stable via JSON key

  useEffect(() => {
    dispatchMayaContext(contextString)
    return () => dispatchMayaContext('')
  }, [contextString])
}
