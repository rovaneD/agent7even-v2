import GuidedCampaignFlow from '@/components/campaigns/GuidedCampaignFlow'
import OpenCanvasFlow from '@/components/campaigns/OpenCanvasFlow'

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const { mode } = await searchParams
  return mode === 'open' ? <OpenCanvasFlow /> : <GuidedCampaignFlow />
}
