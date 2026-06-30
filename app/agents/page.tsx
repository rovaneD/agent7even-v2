import type { Metadata } from 'next'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing Features & Agents | Agent7even',
  description:
    'Twelve AI marketing automation features — campaigns, content, creative, SEO, email, and ads — orchestrated by Maya with a real approval framework.',
  path: '/agents',
})

export { default } from '../lab5/agents/page'
