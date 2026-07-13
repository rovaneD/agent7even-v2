'use client'

import dynamic from 'next/dynamic'

const AskMaya = dynamic(() => import('./AskMaya'), { ssr: false })

export default function AskMayaLazy() {
  return <AskMaya />
}
