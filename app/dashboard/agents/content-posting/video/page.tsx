import ContentPostingModeGate from '@/components/agents/contentPosting/ContentPostingModeGate'
import ContentPostingShell from '@/components/agents/contentPosting/ContentPostingShell'
import { loadContentPostingPageData } from '@/lib/agents/contentPosting/loadPageData'

export default async function ContentPostingVideoPage() {
  const data = await loadContentPostingPageData()

  return (
    <ContentPostingShell mode="video">
      <ContentPostingModeGate
        mode="video"
        profileId={data.profileId}
        companyName={data.companyName}
        brandKitAvailable={data.brandKitAvailable}
        hasUploadedLogo={data.hasUploadedLogo}
        activeTasks={data.activeTasks}
      />
    </ContentPostingShell>
  )
}
