import ContentPostingModeGate from '@/components/agents/contentPosting/ContentPostingModeGate'
import ContentPostingShell from '@/components/agents/contentPosting/ContentPostingShell'
import { loadContentPostingPageData } from '@/lib/agents/contentPosting/loadPageData'

export default async function ContentPostingImagePage() {
  const data = await loadContentPostingPageData()

  return (
    <ContentPostingShell mode="image">
      <ContentPostingModeGate
        mode="image"
        profileId={data.profileId}
        companyName={data.companyName}
        brandKitAvailable={data.brandKitAvailable}
        hasUploadedLogo={data.hasUploadedLogo}
        activeTasks={data.activeTasks}
      />
    </ContentPostingShell>
  )
}
