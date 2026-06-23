'use client'

import Image from 'next/image'
import { Play } from 'lucide-react'

/** 9:16 video frame preview for hub cards — local asset, no external fetch. */
export default function MarketingVideoPreview() {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(59,130,246,0.35)_0%,transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_100%,rgba(245,52,155,0.12)_0%,transparent_50%)]" />

      <div className="relative flex h-full items-center justify-center px-3 py-4">
        <div className="relative aspect-[9/16] h-[88%] max-h-[228px] overflow-hidden rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/15">
          <Image
            src="/lab5/uc-creators.jpg"
            alt=""
            fill
            className="object-cover object-center"
            sizes="180px"
            priority={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />

          <div className="absolute left-1/2 top-[42%] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 p-2 backdrop-blur-sm">
            <Play size={14} className="fill-white text-white" strokeWidth={0} />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="text-left text-[11px] font-bold leading-snug tracking-tight text-white drop-shadow-sm">
              Set your supply.
              <br />
              Watch demand follow.
            </p>
            <p className="mt-1.5 text-[8px] font-medium uppercase tracking-wider text-white/55">
              9:16 · Reels / TikTok
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
