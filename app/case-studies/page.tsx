import type { Metadata } from 'next'
import { TRIAL_LABEL } from '@/lib/billing/trialPolicy'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import CaseStudiesPage from '../lab5/case-studies/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'Customer Stories | Agent7even Case Studies',
  description:
    `Agent7even customer stories with verified results — coming soon. Start a ${TRIAL_LABEL.toLowerCase()} and see Maya draft campaigns for your business today.`,
  path: '/case-studies',
})

export default CaseStudiesPage
