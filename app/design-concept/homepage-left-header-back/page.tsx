import type { Metadata } from 'next'
import Link from 'next/link'
import HomepageLeftHeaderBack from './HomepageLeftHeaderBack'

export const metadata: Metadata = {
  title: 'Homepage — left hero + HeaderBack (preview)',
  description: 'Left-aligned hero layout with updated copy and HeaderBack.jpg. Not the production homepage.',
  robots: { index: false, follow: false },
}

export default function HomepageLeftHeaderBackPage() {
  return (
    <div>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
        Preview · same component as live homepage ·{' '}
        <Link href="/" className="underline underline-offset-2">
          Live homepage
        </Link>
        {' · '}
        <Link href="/lab5" className="underline underline-offset-2">
          /lab5
        </Link>
        {' · '}
        <Link href="/design-concept" className="underline underline-offset-2">
          Design concepts
        </Link>
      </div>
      <HomepageLeftHeaderBack />
    </div>
  )
}
