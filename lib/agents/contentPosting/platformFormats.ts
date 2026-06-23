import type { ImageAspectRatio } from '@/lib/agents/imageGeneration/openRouterImage'

/** Platforms available in Content Posting image/video flows */
export type ContentPlatform = 'Instagram' | 'Facebook' | 'X' | 'LinkedIn' | 'TikTok' | 'YouTube'

export type PlatformPreviewStyle =
  | 'instagram-feed'
  | 'instagram-reels'
  | 'facebook-feed'
  | 'facebook-cover'
  | 'x-post'
  | 'x-header'
  | 'linkedin-feed'
  | 'linkedin-banner'
  | 'vertical-video'

export interface PlatformFormatSpec {
  id: string
  platform: ContentPlatform
  label: string
  dimensions: string
  width: number
  height: number
  /** Human-readable ratio shown in UI badges */
  aspectRatio: string
  /** Closest ratio accepted by the image generation API */
  generationAspectRatio: ImageAspectRatio
  placement: string
  previewStyle: PlatformPreviewStyle
}

export type ImageFormatId =
  | 'ig-feed-post'
  | 'ig-story'
  | 'fb-post'
  | 'fb-cover'
  | 'x-post'
  | 'x-header'
  | 'linkedin-post'
  | 'linkedin-banner'

export type VideoFormatId =
  | 'ig-reels'
  | 'ig-story'
  | 'fb-reels'
  | 'tiktok'
  | 'youtube-shorts'
  | 'linkedin-video'

export type ImageFormatSpec = PlatformFormatSpec & { id: ImageFormatId }
export type VideoFormatSpec = PlatformFormatSpec & { id: VideoFormatId }

export const IMAGE_POST_FORMATS: ImageFormatSpec[] = [
  {
    id: 'ig-feed-post',
    platform: 'Instagram',
    label: 'Instagram post',
    dimensions: '1080 × 1350',
    width: 1080,
    height: 1350,
    aspectRatio: '4:5',
    generationAspectRatio: '4:5',
    placement: 'Instagram feed post',
    previewStyle: 'instagram-feed',
  },
  {
    id: 'ig-story',
    platform: 'Instagram',
    label: 'Instagram story',
    dimensions: '1080 × 1920',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    generationAspectRatio: '9:16',
    placement: 'Instagram story',
    previewStyle: 'instagram-feed',
  },
  {
    id: 'fb-post',
    platform: 'Facebook',
    label: 'Facebook post',
    dimensions: '1200 × 630',
    width: 1200,
    height: 630,
    aspectRatio: '1.91:1',
    generationAspectRatio: '16:9',
    placement: 'Facebook feed post',
    previewStyle: 'facebook-feed',
  },
  {
    id: 'fb-cover',
    platform: 'Facebook',
    label: 'Facebook cover',
    dimensions: '820 × 312',
    width: 820,
    height: 312,
    aspectRatio: '2.63:1',
    generationAspectRatio: '21:9',
    placement: 'Facebook cover photo',
    previewStyle: 'facebook-cover',
  },
  {
    id: 'x-post',
    platform: 'X',
    label: 'X post',
    dimensions: '1200 × 675',
    width: 1200,
    height: 675,
    aspectRatio: '16:9',
    generationAspectRatio: '16:9',
    placement: 'X post',
    previewStyle: 'x-post',
  },
  {
    id: 'x-header',
    platform: 'X',
    label: 'X header',
    dimensions: '1500 × 500',
    width: 1500,
    height: 500,
    aspectRatio: '3:1',
    generationAspectRatio: '21:9',
    placement: 'X profile header',
    previewStyle: 'x-header',
  },
  {
    id: 'linkedin-post',
    platform: 'LinkedIn',
    label: 'LinkedIn post',
    dimensions: '1200 × 627',
    width: 1200,
    height: 627,
    aspectRatio: '1.91:1',
    generationAspectRatio: '16:9',
    placement: 'LinkedIn feed post',
    previewStyle: 'linkedin-feed',
  },
  {
    id: 'linkedin-banner',
    platform: 'LinkedIn',
    label: 'LinkedIn banner',
    dimensions: '1584 × 396',
    width: 1584,
    height: 396,
    aspectRatio: '4:1',
    generationAspectRatio: '21:9',
    placement: 'LinkedIn profile banner',
    previewStyle: 'linkedin-banner',
  },
]

export const VIDEO_POST_FORMATS: VideoFormatSpec[] = [
  {
    id: 'ig-reels',
    platform: 'Instagram',
    label: 'Instagram Reels',
    dimensions: '1080 × 1920',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    generationAspectRatio: '9:16',
    placement: 'Instagram Reels',
    previewStyle: 'instagram-reels',
  },
  {
    id: 'ig-story',
    platform: 'Instagram',
    label: 'Instagram story',
    dimensions: '1080 × 1920',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    generationAspectRatio: '9:16',
    placement: 'Instagram story',
    previewStyle: 'instagram-reels',
  },
  {
    id: 'fb-reels',
    platform: 'Facebook',
    label: 'Facebook Reels',
    dimensions: '1080 × 1920',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    generationAspectRatio: '9:16',
    placement: 'Facebook Reels',
    previewStyle: 'vertical-video',
  },
  {
    id: 'tiktok',
    platform: 'TikTok',
    label: 'TikTok video',
    dimensions: '1080 × 1920',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    generationAspectRatio: '9:16',
    placement: 'TikTok video',
    previewStyle: 'vertical-video',
  },
  {
    id: 'youtube-shorts',
    platform: 'YouTube',
    label: 'YouTube Shorts',
    dimensions: '1080 × 1920',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    generationAspectRatio: '9:16',
    placement: 'YouTube Shorts',
    previewStyle: 'vertical-video',
  },
  {
    id: 'linkedin-video',
    platform: 'LinkedIn',
    label: 'LinkedIn video',
    dimensions: '1080 × 1350',
    width: 1080,
    height: 1350,
    aspectRatio: '4:5',
    generationAspectRatio: '4:5',
    placement: 'LinkedIn vertical video',
    previewStyle: 'vertical-video',
  },
]

const IMAGE_BY_ID = Object.fromEntries(IMAGE_POST_FORMATS.map(f => [f.id, f])) as Record<
  ImageFormatId,
  ImageFormatSpec
>

const VIDEO_BY_ID = Object.fromEntries(VIDEO_POST_FORMATS.map(f => [f.id, f])) as Record<
  VideoFormatId,
  VideoFormatSpec
>

export const DEFAULT_IMAGE_FORMAT = IMAGE_POST_FORMATS[0]!
export const DEFAULT_VIDEO_FORMAT = VIDEO_POST_FORMATS[0]!

export function isImageFormatId(value: string | null | undefined): value is ImageFormatId {
  return value != null && value in IMAGE_BY_ID
}

export function isVideoFormatId(value: string | null | undefined): value is VideoFormatId {
  return value != null && value in VIDEO_BY_ID
}

export function resolveImageFormat(id: string | null | undefined): ImageFormatSpec {
  if (isImageFormatId(id)) return IMAGE_BY_ID[id]
  return DEFAULT_IMAGE_FORMAT
}

export function resolveVideoFormat(id: string | null | undefined): VideoFormatSpec {
  if (isVideoFormatId(id)) return VIDEO_BY_ID[id]
  return DEFAULT_VIDEO_FORMAT
}

export function platformUsernameFromCompany(companyName: string): string {
  const slug = companyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)
  return slug || 'yourbrand'
}

export function contentPostingFlowHref(mode: 'image' | 'video', formatId: string): string {
  return `/dashboard/agents/content-posting/${mode}?format=${formatId}`
}

export function contentPostingModeHref(mode: 'image' | 'video'): string {
  return `/dashboard/agents/content-posting/${mode}`
}

export const IMAGE_PLATFORMS: ContentPlatform[] = ['Instagram', 'Facebook', 'X', 'LinkedIn']
export const VIDEO_PLATFORMS: ContentPlatform[] = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'LinkedIn']

export function platformsForMode(mode: 'image' | 'video'): ContentPlatform[] {
  return mode === 'image' ? IMAGE_PLATFORMS : VIDEO_PLATFORMS
}

export function formatsForPlatform<T extends PlatformFormatSpec>(
  formats: T[],
  platform: ContentPlatform,
): T[] {
  return formats.filter(f => f.platform === platform)
}

/** CSS aspect-ratio class for hub preview frames */
export function previewAspectClassForStyle(
  style: PlatformPreviewStyle,
  generationAspectRatio?: ImageAspectRatio,
): string {
  switch (style) {
    case 'instagram-feed':
      return generationAspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-[4/5]'
    case 'instagram-reels':
    case 'vertical-video':
      return 'aspect-[9/16]'
    case 'facebook-feed':
    case 'linkedin-feed':
    case 'x-post':
      return 'aspect-[16/9]'
    case 'facebook-cover':
      return 'aspect-[820/312]'
    case 'x-header':
      return 'aspect-[3/1]'
    case 'linkedin-banner':
      return 'aspect-[4/1]'
    default:
      return 'aspect-[4/5]'
  }
}
