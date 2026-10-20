'use client'

import { MonitorSmartphone, Newspaper, Palette, Scissors, Sparkles, UserRound, type LucideIcon } from 'lucide-react'
import type { VideoTypeId, VideoTypeSpec } from '@/lib/agents/contentPosting/videoTypes'

export const VIDEO_TYPE_ICONS: Record<VideoTypeId, LucideIcon> = {
  presenter_tip: UserRound,
  product_showcase: MonitorSmartphone,
  editorial_explainer: Newspaper,
  animated_post: Sparkles,
  shorts_maker: Scissors,
  brandkit: Palette,
}

/** Example clip when we have one; otherwise an honest "example in production" poster. */
export function VideoTypePoster({
  type,
  size = 'tile',
  playing = true,
}: {
  type: VideoTypeSpec
  size?: 'tile' | 'thumb' | 'player'
  playing?: boolean
}) {
  const Icon = VIDEO_TYPE_ICONS[type.id]
  if (type.exampleUrl) {
    // Examples are 9:16. The player and thumbs are 9:16 too; the landscape gallery tile shows the
    // whole clip centered over a blurred copy, so faces, captions and cards are never cropped.
    if (size !== 'tile') {
      return (
        <video
          src={type.exampleUrl}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          loop
          playsInline
          autoPlay={playing}
          preload="metadata"
        />
      )
    }
    return (
      <div className="absolute inset-0 overflow-hidden bg-black">
        <video
          src={type.exampleUrl}
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
          muted
          loop
          playsInline
          autoPlay={playing}
          preload="metadata"
          aria-hidden
        />
        <video
          src={type.exampleUrl}
          className="absolute inset-y-0 left-1/2 h-full -translate-x-1/2 object-contain"
          muted
          loop
          playsInline
          autoPlay={playing}
          preload="metadata"
        />
      </div>
    )
  }
  const iconSize = size === 'thumb' ? 16 : size === 'player' ? 34 : 26
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: `radial-gradient(120% 100% at 30% 0%, ${type.poster[0]} 0%, ${type.poster[1]} 75%)` }}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-white/[0.08] text-white/80 ring-1 ring-white/10 ${
          size === 'thumb' ? 'h-8 w-8' : size === 'player' ? 'h-20 w-20' : 'h-14 w-14'
        }`}
      >
        <Icon size={iconSize} strokeWidth={1.6} />
      </span>
      {size !== 'thumb' && (
        <span className="absolute bottom-3 left-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white/70 backdrop-blur">
          Example in production
        </span>
      )}
    </div>
  )
}
