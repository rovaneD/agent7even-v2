import type { Metadata } from 'next'
import Link from 'next/link'
import MayaOrb from '@/components/maya/MayaOrb'

export const metadata: Metadata = {
  title: 'Hero simplified — design concept',
  description: 'Non-live mobile-first hero experiment. Not the production homepage.',
  robots: { index: false, follow: false },
}

/**
 * Sandbox preview only — does not replace the live lab5 homepage.
 * Open at /design-concept/hero-simplified
 */
export default function HeroSimplifiedConceptPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
        Design concept preview · not live ·{' '}
        <Link href="/design-concept" className="underline underline-offset-2">
          Back to design-concept
        </Link>
        {' · '}
        <Link href="/" className="underline underline-offset-2">
          Live homepage
        </Link>
      </div>

      {/* Hero Section - Mobile-First, Simplified */}
      <section className="hero bg-gradient-to-br from-blue-50 to-white py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          {/* Subtle tagline */}
          <p className="mb-4 text-sm font-medium tracking-wide text-gray-600">
            FROM IDEA TO APPROVAL QUEUE, WITHOUT SWITCHING TOOLS
          </p>

          {/* Main Headline */}
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 md:text-6xl">
            Marketing,
            <br />
            managed.
          </h1>

          {/* Subheadline — MayaOrb matches marketing How it works / product mark */}
          <div className="mx-auto mb-10 flex max-w-2xl flex-col items-center gap-4">
            <div className="inline-flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5">
              <MayaOrb size={28} active />
              <span className="text-base font-semibold text-gray-900">Maya</span>
            </div>
            <p className="text-xl text-gray-600 md:text-2xl">
              Maya coordinates your AI agents.
              <br />
              You just approve.
            </p>
          </div>

          {/* Benefits (3 short, scannable) */}
          <div className="mx-auto mb-12 flex max-w-md flex-col justify-center gap-6 text-left md:max-w-3xl md:flex-row">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-sm text-green-700">
                ✓
              </div>
              <div>
                <p className="font-medium text-gray-900">One Foundation</p>
                <p className="text-sm text-gray-500">Your business context shared everywhere</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-sm text-green-700">
                ✓
              </div>
              <div>
                <p className="font-medium text-gray-900">Twelve specialist agents</p>
                <p className="text-sm text-gray-500">They handle the work</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-sm text-green-700">
                ✓
              </div>
              <div>
                <p className="font-medium text-gray-900">One approval queue</p>
                <p className="text-sm text-gray-500">Nothing publishes without you</p>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/pricing"
              className="inline-block rounded-2xl bg-blue-600 px-10 py-4 text-lg font-semibold text-white transition hover:bg-blue-700"
            >
              Start your free 3-day trial
            </a>

            <a
              href="/#how"
              className="inline-block rounded-2xl border border-gray-300 px-8 py-4 text-lg font-medium text-gray-900 transition hover:border-gray-400"
            >
              See how it works →
            </a>
          </div>

          {/* Trust line — concept copy as provided */}
          <p className="mt-6 text-sm text-gray-500">
            No credit card required • Cancel anytime
          </p>
        </div>
      </section>
    </div>
  )
}
