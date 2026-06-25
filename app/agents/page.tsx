import type { Metadata } from 'next'
import '../lab5/styles.css'

export const metadata: Metadata = {
  title: 'Agents — Agent7even',
  description:
    'Twelve marketing agents — campaigns, content, creative, SEO, email, and ads — orchestrated by Maya, with a real approval framework.',
}

export { default } from '../lab5/agents/page'
