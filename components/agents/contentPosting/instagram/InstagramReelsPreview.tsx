'use client'

import Image from 'next/image'
import { Heart, MessageCircle, MoreHorizontal, Music2, Send } from 'lucide-react'

type Props = {
  imageSrc: string
  username: string
  headline: string
  hashtags?: string
  compact?: boolean
}

/** Mock Instagram Reels chrome — 9:16 frame with side action rail. */
export default function InstagramReelsPreview({
  imageSrc,
  username,
  headline,
  hashtags = '#BrandStrategy #MarketLaunch',
  compact = false,
}: Props) {
  const iconSize = compact ? 14 : 16

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-xl bg-black shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
      <Image src={imageSrc} alt="" fill className="object-cover object-center" sizes="220px" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30" />

      <div className="absolute bottom-3 left-3 right-12">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-6 w-6 rounded-full border border-white/80 bg-white/20" />
          <span className="text-[11px] font-semibold text-white">{username}</span>
          <span className="rounded-md border border-white/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
            Follow
          </span>
        </div>
        <p className="text-[11px] font-bold leading-snug text-white drop-shadow-sm">{headline}</p>
        <p className="mt-1 text-[9px] font-medium text-white/75">{hashtags}</p>
      </div>

      <div className="absolute bottom-20 right-2 flex flex-col items-center gap-3.5">
        <div className="h-7 w-7 rounded-full border border-white/70 bg-white/15" />
        <Heart size={iconSize} className="text-white" strokeWidth={2} />
        <MessageCircle size={iconSize} className="text-white" strokeWidth={2} />
        <Send size={iconSize} className="text-white" strokeWidth={2} />
        <MoreHorizontal size={iconSize} className="text-white" strokeWidth={2} />
      </div>

      <div className="absolute bottom-3 right-2 flex flex-col items-center gap-0.5">
        <Music2 size={12} className="text-white/80" />
        <div className="h-4 w-4 overflow-hidden rounded-sm border border-white/40">
          <Image src={imageSrc} alt="" width={16} height={16} className="h-full w-full object-cover" />
        </div>
      </div>
    </div>
  )
}
