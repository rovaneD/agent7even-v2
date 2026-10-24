'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import PlatformBrandIcon from '@/components/agents/contentPosting/PlatformBrandIcon'
import { contentPostingModeHref, resolveVideoFormat } from '@/lib/agents/contentPosting/platformFormats'
import { VIDEO_TYPES, type VideoTypeId } from '@/lib/agents/contentPosting/videoTypes'
import VideoCreatePanel from './VideoCreatePanel'
import CreatorsSheet, { readSavedCreator, saveCreator } from './CreatorsSheet'
import { VIDEO_TYPE_ICONS, VideoTypePoster } from './videoTypeVisuals'

type Props = {
  formatId: string | null
  companyName: string
}

/** Video Post, step 3: pick a video type from examples (2 rows × 3), then the create panel opens. */
export default function VideoGallery({ formatId }: Props) {
  const format = resolveVideoFormat(formatId)
  const [openId, setOpenId] = useState<VideoTypeId | null>(null)
  const [creatorsOpen, setCreatorsOpen] = useState(false)
  const [creatorName, setCreatorName] = useState<string | null>(null)
  const [creatorId, setCreatorId] = useState<string | null>(null)
  useEffect(() => {
    const c = readSavedCreator()
    setCreatorName(c?.name ?? null)
    setCreatorId(c?.id ?? null)
  }, [creatorsOpen, openId])

  // Finish any presenter video that was still recording when its page was closed.
  useEffect(() => {
    fetch('/api/posts/video-create?pending=1').catch(() => {})
    fetch('/api/posts/video-broll?pending=1').catch(() => {})
  }, [])

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[#8A8D95]">
          <span className="font-medium text-[#E6E7EA]">{VIDEO_TYPES.length} video types</span> · pick one to see how it works
        </p>
        <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCreatorsOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#17181B] py-1 pl-1 pr-3 text-[12.5px] text-[#C9CBD1] transition-colors hover:border-white/20 hover:text-white"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.1]">
            <Users size={13} />
          </span>
          {creatorName ? `Creator: ${creatorName}` : 'Creators'}
        </button>
        <Link
          href={contentPostingModeHref('video')}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#17181B] py-1 pl-1 pr-3 text-[12.5px] text-[#C9CBD1] transition-colors hover:border-white/20 hover:text-white"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
            <PlatformBrandIcon platform={format.platform} size={13} />
          </span>
          {format.label} · {format.aspectRatio}
          <span className="text-[#7FB0FF]">Change</span>
        </Link>
        </div>
      </div>

      <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {VIDEO_TYPES.map(type => {
          const Icon = VIDEO_TYPE_ICONS[type.id]
          return (
            <div key={type.id} className="group">
              <div
                className="relative aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-[12px] ring-1 ring-white/[0.06] transition-shadow group-hover:ring-white/20"
                onClick={() => setOpenId(type.id)}
              >
                <VideoTypePoster type={type} />
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/75 to-black/40 p-3 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
                  <p className="mb-2.5 text-[12.5px] leading-snug text-white/90">{type.tagline}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setOpenId(type.id)
                      }}
                      className="flex-1 rounded-[8px] bg-brand-primary py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1D62D6]"
                    >
                      Recreate
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setOpenId(type.id)
                      }}
                      className="rounded-[8px] bg-white/[0.12] px-3.5 py-2 text-[13px] font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
                    >
                      Learn more
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2 px-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] bg-white/[0.08] text-[#C9CBD1]">
                    <Icon size={13} />
                  </span>
                  <span className="truncate text-[13.5px] font-medium text-[#E6E7EA]">{type.name}</span>
                </span>
                <span className="flex-shrink-0 text-[11.5px] text-[#6B6E76]">{type.tag}</span>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-8 text-[12.5px] text-[#6B6E76]">
        Nothing is made or charged until you approve a plan with its price.
      </p>

      <CreatorsSheet
        open={creatorsOpen}
        onClose={() => setCreatorsOpen(false)}
        selectedId={creatorId}
        onPick={c => {
          saveCreator(c)
          setCreatorName(c.name)
          setCreatorId(c.id)
        }}
      />

      {openId && (
        <VideoCreatePanel
          key={openId}
          typeId={openId}
          format={format}
          onClose={() => setOpenId(null)}
          onSwitch={setOpenId}
        />
      )}
    </div>
  )
}
