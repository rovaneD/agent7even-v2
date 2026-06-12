/** Platform caption limits, post types, and pre-submit validation for Zernio posts. */

export type PostType = 'feed' | 'reel' | 'story'

export type PlatformPostTarget = {
  platform: string
  accountId: string
  postType: PostType
  customContent?: string
}

export type PostMediaInput = { type: string }

export type PostValidationInput = {
  content: string
  mediaItems: PostMediaInput[]
  mode: 'schedule' | 'now' | 'queue' | 'draft' | string
  platforms: PlatformPostTarget[]
}

export const PLATFORM_CAPTION_LIMITS: Record<string, number> = {
  instagram: 2200,
  facebook: 63206,
  twitter: 280,
  x: 280,
  threads: 500,
  linkedin: 3000,
  tiktok: 2200,
  pinterest: 500,
  youtube: 5000,
  reddit: 40000,
  bluesky: 300,
  telegram: 4096,
  snapchat: 250,
  gbp: 1500,
  googlebusiness: 1500,
}

const STORY_PLATFORMS = new Set(['instagram', 'facebook'])
const REEL_PLATFORMS = new Set(['instagram', 'facebook'])

export function supportedPostTypes(platform: string): PostType[] {
  const p = platform.toLowerCase()
  if (STORY_PLATFORMS.has(p)) return ['feed', 'reel', 'story']
  return ['feed']
}

export function captionLimitForPlatform(platform: string): number {
  return PLATFORM_CAPTION_LIMITS[platform.toLowerCase()] ?? 5000
}

/** First platform from agent task input (platform / platforms fields). */
export function primaryPlatformFromTaskInput(input: Record<string, unknown>): string {
  const fromPlatforms = typeof input.platforms === 'string' ? input.platforms : ''
  const fromPlatform = typeof input.platform === 'string' ? input.platform : ''
  const raw = fromPlatforms || fromPlatform
  const first = raw.split(/[,/|]/)[0]?.trim()
  return first || 'Instagram'
}

export function buildPlatformSpecificData(
  platform: string,
  postType: PostType,
): Record<string, unknown> | undefined {
  if (postType === 'feed') return undefined
  const p = platform.toLowerCase()
  if (postType === 'story' && STORY_PLATFORMS.has(p)) {
    return { contentType: 'story' }
  }
  if (postType === 'reel') {
    if (p === 'instagram') return { contentType: 'reels' }
    if (p === 'facebook') return { contentType: 'reel' }
  }
  return undefined
}

export function captionForPlatform(target: PlatformPostTarget, defaultContent: string): string {
  const custom = target.customContent?.trim()
  return custom || defaultContent.trim()
}

export function validatePost(input: PostValidationInput): string[] {
  const errors: string[] = []
  const { content, mediaItems, mode, platforms } = input
  const hasMedia = mediaItems.length > 0
  const hasVideo = mediaItems.some(m => m.type === 'video')
  const trimmed = content.trim()

  if (mode !== 'draft' && platforms.length === 0) {
    errors.push('Select at least one platform to post to.')
  }

  if (mode !== 'draft' && !trimmed && !hasMedia) {
    errors.push('Add a caption or at least one media file.')
  }

  for (const target of platforms) {
    const p = target.platform.toLowerCase()
    const caption = captionForPlatform(target, content)
    const limit = captionLimitForPlatform(p)
    const postType = target.postType

    if (postType === 'story' && !STORY_PLATFORMS.has(p)) {
      errors.push(`${p}: Stories are not supported on this platform.`)
    }

    if (postType === 'reel' && !REEL_PLATFORMS.has(p)) {
      errors.push(`${p}: Reels are not supported on this platform.`)
    }

    if (postType === 'reel' && !hasVideo) {
      errors.push(`${p}: Reels require a video upload.`)
    }

    if (postType === 'story' && !hasMedia) {
      errors.push(`${p}: Stories require an image or video.`)
    }

    if (postType === 'feed' && p === 'instagram' && mediaItems.length > 10) {
      errors.push('Instagram carousels support up to 10 images.')
    }

    if (postType !== 'story' && caption && caption.length > limit) {
      const label = target.customContent?.trim() ? 'Custom caption' : 'Caption'
      errors.push(`${label} for ${p} exceeds ${limit.toLocaleString()} characters (${caption.length.toLocaleString()}).`)
    }

    if (postType === 'story' && p === 'instagram' && caption) {
      // IG stories don't display captions — warn but don't block
    }
  }

  if (mode === 'schedule' && !trimmed && hasMedia && platforms.every(t => t.postType === 'story' && t.platform === 'instagram')) {
    // media-only IG story is fine
  }

  return errors
}

export function tightestCaptionLimit(platforms: PlatformPostTarget[]): number | null {
  if (platforms.length === 0) return null
  return Math.min(...platforms.map(t => captionLimitForPlatform(t.platform)))
}

export function buildZernioPlatformTargets(
  targets: PlatformPostTarget[],
): Array<{
  platform: string
  accountId: string
  customContent?: string
  platformSpecificData?: Record<string, unknown>
}> {
  return targets.map((target) => {
    const custom = target.customContent?.trim()
    const platformSpecificData = buildPlatformSpecificData(target.platform, target.postType)
    return {
      platform: target.platform,
      accountId: target.accountId,
      ...(custom ? { customContent: custom } : {}),
      ...(platformSpecificData ? { platformSpecificData } : {}),
    }
  })
}

export function parsePlatformTargets(raw: unknown[]): PlatformPostTarget[] {
  const targets: PlatformPostTarget[] = []
  for (const item of raw) {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const accountId = typeof row.accountId === 'string' ? row.accountId : ''
    const platform = typeof row.platform === 'string' ? row.platform : ''
    if (!accountId || !platform) continue
    const postTypeRaw = String(row.postType ?? 'feed').toLowerCase()
    const postType: PostType =
      postTypeRaw === 'reel' || postTypeRaw === 'story' ? postTypeRaw : 'feed'
    targets.push({
      platform,
      accountId,
      postType,
      ...(typeof row.customContent === 'string' ? { customContent: row.customContent } : {}),
    })
  }
  return targets
}

export function postTypeLabel(type: PostType): string {
  if (type === 'feed') return 'Feed'
  if (type === 'reel') return 'Reel'
  return 'Story'
}
