import type { Metadata } from 'next'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import AboutPage from '../lab5/about/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'About Agent7even — AI Marketing OS for Small Business',
  description:
    'Agent7even is an AI marketing operating system for small business — Maya coordinates twelve specialist agents with approval-first workflows.',
  path: '/about',
})

export default AboutPage
