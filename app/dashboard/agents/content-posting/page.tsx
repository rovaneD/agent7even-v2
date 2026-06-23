import ContentPostingShell from '@/components/agents/contentPosting/ContentPostingShell'
import ContentPostingHubCards from '@/components/agents/contentPosting/ContentPostingHubCards'
import { loadContentPostingPageData } from '@/lib/agents/contentPosting/loadPageData'

export default async function ContentPostingHubPage() {
  await loadContentPostingPageData()

  return (
    <ContentPostingShell mode={null}>
      <ContentPostingHubCards />
    </ContentPostingShell>
  )
}
