'use client'

import { useEffect, useMemo } from 'react'
import { serializeMayaPageContext, type MayaPageContext } from '@/lib/maya/contextTypes'

/** CustomEvent name DashboardShell listens for (DashboardShell.tsx ~290). */
export const MAYA_CANVAS_EVENT = 'maya:canvas-context'

function dispatchMayaContext(context: string) {
  window.dispatchEvent(new CustomEvent(MAYA_CANVAS_EVENT, { detail: { context } }))
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
