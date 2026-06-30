import type { Metadata } from 'next'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import CareersPage from '../lab5/careers/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'Careers at Agent7even',
  description:
    'Join the team building the AI marketing operating system for small business. View current openings and how to get in touch.',
  path: '/careers',
})

export default CareersPage
