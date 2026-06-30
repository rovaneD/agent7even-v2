import type { Metadata } from 'next'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import AiVsAgencyPage from '../lab5/ai-vs-agency/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing vs Traditional Agency | Cost & Speed | Agent7even',
  description:
    'Compare AI marketing vs a traditional agency — retainers vs $49/mo Starter, same-day drafts vs weeks of kickoff, and approval-first control before anything publishes.',
  path: '/ai-vs-agency',
})

export default AiVsAgencyPage
