'use client'

/**
 * BEFORE: mockups.js injected on mount for the whole homepage.
 * AFTER: optional IntersectionObserver gate so mobile LCP isn't blocked by
 * mockup script parse/execute until the showpiece nears the viewport.
 */

import { useEffect } from 'react'

declare global {
  interface Window {
    __initMockups?: () => void
    __initUseCaseMockups?: () => void
  }
}

type MockupInitKey = '__initMockups' | '__initUseCaseMockups'

type Options = {
  /** Wait until `watchSelector` is near viewport before loading the script. */
  lazy?: boolean
  watchSelector?: string
}

function injectAndInit(src: string, initKey: MockupInitKey) {
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
}

/** Load lab5 mockup scripts — Next.js Script tags don't run in client components (Next 16). */
export function useMockupScript(src: string, initKey: MockupInitKey, options: Options = {}) {
  // Prefer first non-SSR mockup so hero dashboard HTML is never a load gate.
  const { lazy = false, watchSelector = '.lab5 [data-mk]:not([data-mk-ssr])' } = options

  useEffect(() => {
    if (!lazy) {
      injectAndInit(src, initKey)
      return
    }

    const target = document.querySelector(watchSelector)
    if (!target) {
      const timer = window.setTimeout(() => injectAndInit(src, initKey), 2500)
      return () => window.clearTimeout(timer)
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          io.disconnect()
          injectAndInit(src, initKey)
        }
      },
      { rootMargin: '240px 0px' },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [src, initKey, lazy, watchSelector])
}
