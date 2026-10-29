'use client'

import { useEffect, useState } from 'react'
import { Play, X } from 'lucide-react'

/**
 * Small video thumbnail that opens the video at full size in a modal (play, pause, close).
 * Used in Approvals so a 9:16 post is reviewed at a real viewing size, not inside a 68px tile.
 */
export default function VideoThumbnailModal({
  src,
  poster,
  width = 68,
  height = 120,
  label = 'Play video',
}: {
  src: string
  /** Still frame. Without one the tile stays dark: the video only downloads when someone opens it. */
  poster?: string | null
  width?: number
  height?: number
  label?: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className="group relative block overflow-hidden rounded-[12px] border border-[#f0f0f0] bg-black"
        style={{ width, height }}
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-end justify-center bg-gradient-to-b from-[#2a2d33] to-[#0E1116] pb-2 text-[10px] font-medium text-white/70">
            Video
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#0E1116] shadow">
            <Play size={15} className="ml-0.5" fill="currentColor" />
          </span>
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Video preview"
          onClick={() => setOpen(false)}
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            <video
              src={src}
              poster={poster ?? undefined}
              controls
              autoPlay
              playsInline
              className="block max-h-[88vh] max-w-[92vw] rounded-[16px] bg-black"
              style={{ aspectRatio: '9 / 16', height: '88vh' }}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close video"
              className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0E1116] shadow-lg hover:bg-[#f2f2f2]"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
