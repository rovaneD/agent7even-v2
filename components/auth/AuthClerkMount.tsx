'use client'

import { useEffect, useState, type ReactNode } from 'react'

type MountState = 'loading' | 'ready' | 'error'

function readClerkState(): MountState {
  if (typeof window === 'undefined') return 'loading'
  const clerk = (window as Window & { Clerk?: { loaded?: boolean; status?: string } }).Clerk
  if (!clerk) return 'loading'
  if (clerk.loaded) return 'ready'
  if (clerk.status === 'error') return 'error'
  return 'loading'
}

export default function AuthClerkMount({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MountState>('loading')

  useEffect(() => {
    let cancelled = false
    const sync = () => {
      const next = readClerkState()
      if (!cancelled) setState(next)
      return next === 'ready' || next === 'error'
    }

    if (sync()) return

    const interval = window.setInterval(() => {
      if (sync()) window.clearInterval(interval)
    }, 200)

    const timeout = window.setTimeout(() => {
      if (!cancelled && readClerkState() === 'loading') setState('error')
    }, 10_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-[#9AA0AA]">
        Loading sign-in…
      </div>
    )
  }

  if (state === 'error') {
    const host = typeof window !== 'undefined' ? window.location.host : ''
    const isPreview = host.includes('vercel.app')
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
        <p className="font-semibold">Sign-in could not load</p>
        <p className="mt-2 leading-relaxed text-amber-900/90">
          {isPreview
            ? 'Clerk Production keys (pk_live_) do not work on *.vercel.app preview URLs. Use www.agent7even.ai for production smoke tests, or set Clerk Development keys on Vercel Preview only.'
            : 'Clerk failed to initialize on this domain. Check publishable key and Domains under Configure in the Clerk dashboard.'}
        </p>
        {isPreview && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-900/85">
            <li>
              <strong>Preview deploys:</strong> Vercel → Preview env →{' '}
              <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> /{' '}
              <code className="rounded bg-amber-100 px-1">CLERK_SECRET_KEY</code> = Development{' '}
              <code className="rounded bg-amber-100 px-1">pk_test_</code> /{' '}
              <code className="rounded bg-amber-100 px-1">sk_test_</code> (Clerk Dashboard → Development → API Keys).
            </li>
            <li>
              <strong>Production smoke:</strong>{' '}
              <a href="https://www.agent7even.ai/sign-in" className="font-semibold text-[#3286FE] underline">
                www.agent7even.ai/sign-in
              </a>
            </li>
          </ul>
        )}
      </div>
    )
  }

  return <>{children}</>
}
