'use client'

import { useMayaContext } from '@/hooks/useMayaContext'
import type { MayaPageContext } from '@/lib/maya/contextTypes'

export default function CanvasContextDispatcher({ payload }: { payload: MayaPageContext }) {
  useMayaContext(payload)
  return null
}
