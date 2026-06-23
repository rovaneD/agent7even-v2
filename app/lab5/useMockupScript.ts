'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    __initMockups?: () => void
    __initUseCaseMockups?: () => void
  }
}

type MockupInitKey = '__initMockups' | '__initUseCaseMockups'

/** Load lab5 mockup scripts — Next.js Script tags don't run in client components (Next 16). */
export function useMockupScript(src: string, initKey: MockupInitKey) {
  useEffect(() => {
    const runInit = () => requestAnimationFrame(() => window[initKey]?.())

    if (window[initKey]) {
      runInit()
      return
    }

    const selector = `script[data-mockup-src="${src}"]`
    const existing = document.querySelector(selector) as HTMLScriptElement | null
    if (existing) {
      if (existing.dataset.loaded === '1') runInit()
      else existing.addEventListener('load', runInit, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.mockupSrc = src
    script.onload = () => {
      script.dataset.loaded = '1'
      runInit()
    }
    document.body.appendChild(script)
  }, [src, initKey])
}
