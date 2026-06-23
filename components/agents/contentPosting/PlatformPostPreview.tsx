'use client'

import Image from 'next/image'
import { Heart, MessageCircle, MoreHorizontal, Repeat2, Send, Share } from 'lucide-react'
import type { PlatformFormatSpec } from '@/lib/agents/contentPosting/platformFormats'
import { previewAspectClassForStyle } from '@/lib/agents/contentPosting/platformFormats'
import InstagramFeedPostPreview from '@/components/agents/contentPosting/instagram/InstagramFeedPostPreview'
import InstagramReelsPreview from '@/components/agents/contentPosting/instagram/InstagramReelsPreview'

type Props = {
  format: PlatformFormatSpec
  imageSrc: string
  username: string
  caption: string
  headline?: string
  compact?: boolean
}

function GenericLandscapePreview({
  imageSrc,
  username,
  caption,
  aspectClass,
  platformLabel,
  compact,
}: {
  imageSrc: string
  username: string
  caption: string
  aspectClass: string
  platformLabel: string
  compact?: boolean
}) {
  const iconSize = compact ? 13 : 15
  return (
    <div className="flex h-full w-full flex-col bg-white text-left">
      <div className={`flex items-center gap-2 border-b border-gray-100 px-2.5 py-2 ${compact ? '' : 'px-3 py-2.5'}`}>
        <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gray-200" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-gray-900">{username}</p>
          <p className="text-[9px] text-gray-500">{platformLabel}</p>
        </div>
        <MoreHorizontal size={iconSize} className="text-gray-500" />
      </div>
      <div className={`relative w-full overflow-hidden bg-gray-100 ${aspectClass}`}>
        <Image src={imageSrc} alt="" fill className="object-cover object-center" sizes="320px" />
      </div>
      <div className="px-2.5 py-2">
        <p className="line-clamp-2 text-[10px] leading-snug text-gray-800">{caption}</p>
      </div>
    </div>
  )
}

function XPostPreview({ imageSrc, username, caption, compact }: Omit<Props, 'format' | 'headline'>) {
  const iconSize = compact ? 13 : 15
  return (
    <div className="flex h-full w-full flex-col bg-white text-left">
      <div className="flex gap-2 px-2.5 py-2">
        <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-900" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-gray-900">{username}</p>
          <p className="mt-0.5 line-clamp-2 text-[10px] text-gray-800">{caption}</p>
          <div className={`relative mt-2 w-full overflow-hidden rounded-xl border border-gray-200 ${previewAspectClassForStyle('x-post')}`}>
            <Image src={imageSrc} alt="" fill className="object-cover" sizes="280px" />
          </div>
          <div className="mt-2 flex items-center gap-4 text-gray-500">
            <MessageCircle size={iconSize} />
            <Repeat2 size={iconSize} />
            <Heart size={iconSize} />
            <Share size={iconSize} className="ml-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}

function XHeaderPreview({ imageSrc, username, compact }: Pick<Props, 'imageSrc' | 'username' | 'compact'>) {
  return (
    <div className="flex h-full w-full flex-col bg-white text-left">
      <div className={`relative w-full overflow-hidden bg-gray-200 ${previewAspectClassForStyle('x-header')}`}>
        <Image src={imageSrc} alt="" fill className="object-cover object-center" sizes="320px" />
      </div>
      <div className="relative px-3 pb-3 pt-8">
        <div className="absolute -top-5 left-3 h-10 w-10 rounded-full border-4 border-white bg-gray-300" />
        <p className="text-[12px] font-bold text-gray-900">{username}</p>
        <p className="text-[10px] text-gray-500">@{username}</p>
      </div>
    </div>
  )
}

function FacebookFeedPreview({ imageSrc, username, caption, compact }: Omit<Props, 'format' | 'headline'>) {
  return (
    <GenericLandscapePreview
      imageSrc={imageSrc}
      username={username}
      caption={caption}
      aspectClass={previewAspectClassForStyle('facebook-feed')}
      platformLabel="Facebook"
      compact={compact}
    />
  )
}

function FacebookCoverPreview({ imageSrc, username, compact }: Pick<Props, 'imageSrc' | 'username' | 'compact'>) {
  return (
    <div className="flex h-full w-full flex-col bg-white text-left">
      <div className={`relative w-full overflow-hidden bg-gray-200 ${previewAspectClassForStyle('facebook-cover')}`}>
        <Image src={imageSrc} alt="" fill className="object-cover object-center" sizes="320px" />
      </div>
      <div className="border-b border-gray-100 px-3 py-2">
        <p className="text-[12px] font-bold text-gray-900">{username}</p>
      </div>
    </div>
  )
}

function LinkedInFeedPreview({ imageSrc, username, caption, compact }: Omit<Props, 'format' | 'headline'>) {
  const iconSize = compact ? 13 : 15
  return (
    <div className="flex h-full w-full flex-col bg-white text-left">
      <div className="flex items-start gap-2 px-2.5 py-2">
        <div className="h-8 w-8 flex-shrink-0 rounded-full bg-[#0A66C2]/15 ring-1 ring-[#0A66C2]/30" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-gray-900">{username}</p>
          <p className="text-[9px] text-gray-500">Company · 1h</p>
          <p className="mt-1 line-clamp-2 text-[10px] text-gray-800">{caption}</p>
        </div>
      </div>
      <div className={`relative w-full overflow-hidden bg-gray-100 ${previewAspectClassForStyle('linkedin-feed')}`}>
        <Image src={imageSrc} alt="" fill className="object-cover" sizes="320px" />
      </div>
      <div className="flex items-center justify-around border-t border-gray-100 px-2 py-1.5 text-[9px] font-semibold text-gray-500">
        <span className="inline-flex items-center gap-1"><Heart size={iconSize} /> Like</span>
        <span className="inline-flex items-center gap-1"><MessageCircle size={iconSize} /> Comment</span>
        <span className="inline-flex items-center gap-1"><Repeat2 size={iconSize} /> Repost</span>
        <span className="inline-flex items-center gap-1"><Send size={iconSize} /> Send</span>
      </div>
    </div>
  )
}

function LinkedInBannerPreview({ imageSrc, username, compact }: Pick<Props, 'imageSrc' | 'username' | 'compact'>) {
  return (
    <div className="flex h-full w-full flex-col bg-white text-left">
      <div className={`relative w-full overflow-hidden bg-[#0A66C2]/10 ${previewAspectClassForStyle('linkedin-banner')}`}>
        <Image src={imageSrc} alt="" fill className="object-cover object-center" sizes="320px" />
      </div>
      <div className="relative px-3 pb-2 pt-7">
        <div className="absolute -top-4 left-3 h-9 w-9 rounded-full border-2 border-white bg-gray-200" />
        <p className="text-[11px] font-semibold text-gray-900">{username}</p>
      </div>
    </div>
  )
}

/** Switches mock platform chrome based on selected format. */
export default function PlatformPostPreview({
  format,
  imageSrc,
  username,
  caption,
  headline = 'Set your supply. Watch demand follow.',
  compact = true,
}: Props) {
  switch (format.previewStyle) {
    case 'instagram-feed':
      return (
        <InstagramFeedPostPreview
          imageSrc={imageSrc}
          username={username}
          caption={caption}
          aspectRatio={format.generationAspectRatio === '9:16' ? '9:16' : '4:5'}
          compact={compact}
        />
      )
    case 'instagram-reels':
      return (
        <InstagramReelsPreview
          imageSrc={imageSrc}
          username={username}
          headline={headline}
          compact={compact}
        />
      )
    case 'vertical-video':
      if (format.generationAspectRatio === '4:5') {
        return (
          <div className="mx-auto w-full max-w-[200px] overflow-hidden rounded-xl border border-white/10 shadow-lg">
            <InstagramFeedPostPreview
              imageSrc={imageSrc}
              username={username}
              caption={headline}
              aspectRatio="4:5"
              compact={compact}
            />
          </div>
        )
      }
      return (
        <div className="flex h-full items-center justify-center">
          <InstagramReelsPreview
            imageSrc={imageSrc}
            username={username}
            headline={headline}
            compact={compact}
          />
        </div>
      )
    case 'x-post':
      return <XPostPreview imageSrc={imageSrc} username={username} caption={caption} compact={compact} />
    case 'x-header':
      return <XHeaderPreview imageSrc={imageSrc} username={username} compact={compact} />
    case 'facebook-feed':
      return <FacebookFeedPreview imageSrc={imageSrc} username={username} caption={caption} compact={compact} />
    case 'facebook-cover':
      return <FacebookCoverPreview imageSrc={imageSrc} username={username} compact={compact} />
    case 'linkedin-feed':
      return <LinkedInFeedPreview imageSrc={imageSrc} username={username} caption={caption} compact={compact} />
    case 'linkedin-banner':
      return <LinkedInBannerPreview imageSrc={imageSrc} username={username} compact={compact} />
    default:
      return (
        <InstagramFeedPostPreview
          imageSrc={imageSrc}
          username={username}
          caption={caption}
          compact={compact}
        />
      )
  }
}
