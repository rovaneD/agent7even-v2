import ContentPostingFlowClient from '@/components/agents/contentPosting/ContentPostingFlowClient'
import ContentPostingShell from '@/components/agents/contentPosting/ContentPostingShell'
import { loadContentPostingPageData } from '@/lib/agents/contentPosting/loadPageData'

export default async function ContentPostingWeeklyPage() {
  const data = await loadContentPostingPageData()

  return (
    <ContentPostingShell mode="weekly">
      <ContentPostingFlowClient
        mode="weekly"
        profileId={data.profileId}
        companyName={data.companyName}
        brandKitAvailable={data.brandKitAvailable}
        hasUploadedLogo={data.hasUploadedLogo}
        activeTasks={data.activeTasks}
      />
    </ContentPostingShell>
  )
}
