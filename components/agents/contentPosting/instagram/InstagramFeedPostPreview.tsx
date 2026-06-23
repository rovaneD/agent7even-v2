'use client'

import Image from 'next/image'
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from 'lucide-react'
import type { InstagramAspectRatio } from '@/lib/agents/contentPosting/instagramFormats'

type Props = {
  imageSrc: string
  username: string
  caption: string
  aspectRatio?: InstagramAspectRatio
  compact?: boolean
}

const ASPECT_CLASS: Record<InstagramAspectRatio, string> = {
  '4:5': 'aspect-[4/5]',
  '9:16': 'aspect-[9/16]',
}

/** Mock Instagram feed post chrome for hub cards and previews. */
export default function InstagramFeedPostPreview({
  imageSrc,
  username,
  caption,
  aspectRatio = '4:5',
  compact = false,
}: Props) {
  const iconSize = compact ? 14 : 16
  const headerPad = compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
  const actionPad = compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
  const captionPad = compact ? 'px-2.5 pb-2.5' : 'px-3 pb-3'

  return (
    <div className="flex h-full w-full flex-col bg-white text-left">
      <div className={`flex items-center gap-2 border-b border-gray-100 ${headerPad}`}>
        <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] p-[1.5px]">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[9px] font-bold uppercase text-gray-700">
            {username.slice(0, 1)}
          </div>
        </div>
        <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-gray-900">{username}</p>
        <MoreHorizontal size={iconSize} className="flex-shrink-0 text-gray-900" strokeWidth={2} />
      </div>

      <div className={`relative w-full overflow-hidden bg-gray-100 ${ASPECT_CLASS[aspectRatio]}`}>
        <Image src={imageSrc} alt="" fill className="object-cover object-center" sizes="360px" />
      </div>

      <div className={`flex items-center gap-3 ${actionPad}`}>
        <Heart size={iconSize} className="text-gray-900" strokeWidth={2} />
        <MessageCircle size={iconSize} className="text-gray-900" strokeWidth={2} />
        <Send size={iconSize} className="text-gray-900" strokeWidth={2} />
        <Bookmark size={iconSize} className="ml-auto text-gray-900" strokeWidth={2} />
      </div>

      <div className={captionPad}>
        <p className="line-clamp-2 text-[11px] leading-[1.45] text-gray-900">
          <span className="font-semibold">{username}</span>{' '}
          <span className="font-normal text-gray-800">{caption}</span>
        </p>
      </div>
    </div>
  )
}
