import type { Metadata } from 'next'
import Link from 'next/link'
import HomepageSiteBrandStory from './HomepageSiteBrandStory'

export const metadata: Metadata = {
  title: 'Homepage Site Brand — design concept',
  description: 'Scroll-driven Maya story concept, ported from Claude Design. Not the production homepage.',
  robots: { index: false, follow: false },
}

/**
 * Ported from Claude Design project "Granola vs Agent7even comparison"
 * (d696db1f-b465-48cb-b623-12907bb16316), file "Homepage Site Brand.dc.html".
 * Sandbox preview only — does not replace the live homepage.
 * Open at /design-concept/homepage-site-brand
 */
export default function HomepageSiteBrandConceptPage() {
  return (
    <div>
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
      <HomepageSiteBrandStory />
    </div>
  )
}
