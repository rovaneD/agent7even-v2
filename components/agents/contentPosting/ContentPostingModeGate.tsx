'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ContentPostingFlowClient from '@/components/agents/contentPosting/ContentPostingFlowClient'
import ContentPostingFormatPicker from '@/components/agents/contentPosting/ContentPostingFormatPicker'
import ContentPostingLightPanel from '@/components/agents/contentPosting/ContentPostingLightPanel'
import VideoGallery from '@/components/agents/contentPosting/video/VideoGallery'
import {
  isImageFormatId,
  isVideoFormatId,
} from '@/lib/agents/contentPosting/platformFormats'
import type { ContentPostingMode } from '@/lib/agents/contentPosting/uiConfig'

type Props = {
  mode: Extract<ContentPostingMode, 'image' | 'video'>
  profileId: string
  companyName: string
  brandKitAvailable: boolean
  hasUploadedLogo: boolean
  activeTasks: Array<{ id: string; agent: string; status: string; input: Record<string, unknown> }>
}

function ContentPostingModeGateInner(props: Props) {
  const searchParams = useSearchParams()
  const formatParam = searchParams.get('format')
  const hasValidFormat =
    props.mode === 'image' ? isImageFormatId(formatParam) : isVideoFormatId(formatParam)

  if (!hasValidFormat) {
    return <ContentPostingFormatPicker mode={props.mode} companyName={props.companyName} />
  }

  if (props.mode === 'video') {
    return <VideoGallery formatId={formatParam} companyName={props.companyName} />
  }

  // Image setup keeps the current form until it moves to the gallery pattern (decision D3).
  return (
    <ContentPostingLightPanel>
      <ContentPostingFlowClient {...props} />
    </ContentPostingLightPanel>
  )
}

export default function ContentPostingModeGate(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-[#8A8D95]">Loading…</p>}>
      <ContentPostingModeGateInner {...props} />
    </Suspense>
  )
}
