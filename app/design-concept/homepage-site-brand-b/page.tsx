import type { Metadata } from 'next'
import Link from 'next/link'
import HomepageSiteBrandStoryB from './HomepageSiteBrandStoryB'

export const metadata: Metadata = {
  title: 'Homepage Site Brand — variant B (design concept)',
  description: 'A/B hero variant of the scroll-driven Maya story. Not the production homepage.',
  robots: { index: false, follow: false },
}

/**
 * Variant B of /design-concept/homepage-site-brand for hero A/B testing.
 * Same scroll-driven stage; the hero is rearranged: eyebrow → bold sans
 * headline → Maya subline → body → blue CTA → trust line, with metaball
 * blobs bleeding off the page edges in two places.
 * Open at /design-concept/homepage-site-brand-b
 */
export default function HomepageSiteBrandVariantBPage() {
  return (
    <div>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
        Design concept preview · hero variant B ·{' '}
        <Link href="/design-concept/homepage-site-brand" className="underline underline-offset-2">
          Variant A
        </Link>
        {' · '}
        <Link href="/design-concept" className="underline underline-offset-2">
          Back to design-concept
        </Link>
        {' · '}
        <Link href="/" className="underline underline-offset-2">
          Live homepage
        </Link>
      </div>
      <HomepageSiteBrandStoryB />
    </div>
  )
}
