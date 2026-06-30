import type { Metadata } from 'next'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import VsSchedulingToolsPage from '../lab5/vs-scheduling-tools/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing OS vs Scheduling Tools | Agent7even',
  description:
    'Compare Agent7even to social scheduling tools — Maya drafts campaigns and content in your voice with approval-first workflows, not just publish queues.',
  path: '/vs-scheduling-tools',
})

export default VsSchedulingToolsPage
