'use client'

import { useEffect, useState } from 'react'
import { MonitorSmartphone, Newspaper, Palette, Scissors, Sparkles, UserRound, type LucideIcon, Clapperboard } from 'lucide-react'
import type { VideoTypeId, VideoTypeSpec } from '@/lib/agents/contentPosting/videoTypes'

export const VIDEO_TYPE_ICONS: Record<VideoTypeId, LucideIcon> = {
  presenter_tip: UserRound,
  cinematic_broll: Clapperboard,
  product_showcase: MonitorSmartphone,
  editorial_explainer: Newspaper,
  animated_post: Sparkles,
  shorts_maker: Scissors,
  brandkit: Palette,
}

// Signed example clips + their poster frames, fetched once per page (GET /api/posts/video-types).
type Examples = { examples: Record<string, string>; posters: Record<string, string> }
let examplesCache: Examples | null = null
let examplesPromise: Promise<Examples> | null = null
function loadExamples(): Promise<Examples> {
  if (examplesCache) return Promise.resolve(examplesCache)
  examplesPromise ??= fetch('/api/posts/video-types')
    .then(r => (r.ok ? r.json() : {}))
    .then((d: Partial<Examples>) => (examplesCache = { examples: d.examples ?? {}, posters: d.posters ?? {} }))
    .catch(() => (examplesCache = { examples: {}, posters: {} }))
  return examplesPromise
}

function useExample(type: VideoTypeSpec): { url: string | null; poster: string | null } {
  const [v, setV] = useState<{ url: string | null; poster: string | null }>({
    url: type.exampleUrl ?? examplesCache?.examples[type.id] ?? null,
    poster: examplesCache?.posters[type.id] ?? null,
  })
  useEffect(() => {
    if (type.exampleUrl || !type.examplePath) return
    let live = true
    void loadExamples().then(m => live && setV({ url: m.examples[type.id] ?? null, poster: m.posters[type.id] ?? null }))
    return () => {
      live = false
    }
  }, [type])
  return v
}

export function useExampleUrl(type: VideoTypeSpec): string | null {
  return useExample(type).url
}

export function useExamplePoster(type: VideoTypeSpec): string | null {
  return useExample(type).poster
}

/**
 * Example clip when we have one; otherwise an honest "example in production" poster.
 * Egress (2026-10-29): tiles and thumbs show the still frame and only load the clip while hovered;
 * only the big player plays it.
 */
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
  const { url: exampleUrl, poster } = useExample(type)
  const [hover, setHover] = useState(false)
  if (exampleUrl) {
    if (size === 'player') {
      return (
        <video
          src={exampleUrl}
          poster={poster ?? undefined}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          loop
          playsInline
          autoPlay={playing}
          preload="metadata"
        />
      )
    }
    const still = poster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={poster} alt="" className={size === 'tile' ? 'absolute inset-y-0 left-1/2 h-full -translate-x-1/2 object-contain' : 'absolute inset-0 h-full w-full object-cover'} />
    ) : null
    if (size === 'thumb') return <div className="absolute inset-0 bg-black">{still}</div>
    return (
      <div className="absolute inset-0 overflow-hidden bg-black" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
        )}
        {still}
        {hover && playing && (
          <video
            src={exampleUrl}
            className="absolute inset-y-0 left-1/2 h-full -translate-x-1/2 object-contain"
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
          />
        )}
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
