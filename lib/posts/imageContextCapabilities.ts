import { isImageGenerationEnabled } from '@/lib/posts/imageGenerationFlag'
import { isVideoGenerationEnabled } from '@/lib/posts/videoGenerationFlag'

/**
 * Post media capability (upload + optional generation behind flag).
 * Source of truth for Maya chat prompts and agent constraint copy.
 */

export const IMAGE_CONTEXT_CAPABILITY = {
  id: 'image_context_caption',
  version: 'v1',
  supported: [
    'Owner uploads a ready-to-post still image',
    'In-platform crop to platform aspect before caption run',
    'Maya reads the attached image via vision and writes caption copy in context',
    'Caption and image stay paired through approval and publish',
  ],
  unsupported: [
    'Image generation',
    'Filters, stickers, or full image editing beyond crop',
    'Carousels (multi-image posts)',
    'Video generation',
  ],
  limits: {
    maxImagesPerPost: 1,
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const,
    maxBytes: 20 * 1024 * 1024,
  },
} as const

const GENERATION_SUPPORTED =
  'Generate post images in Agents → Single post → Generate with Maya (Foundation-grounded brief, 3 options, text QA before approval); saved options live in Assets'

const VIDEO_GENERATION_SUPPORTED =
  'Generate short-form video (9:16 Reels/TikTok) in Agents → Single post → Generate video (Creative Direction brief, async job, review in Approvals)'

/** Upload/caption baseline — generation removed when flags are on. */
function effectiveUnsupportedList(): string[] {
  let base = [...IMAGE_CONTEXT_CAPABILITY.unsupported]
  if (isImageGenerationEnabled()) {
    base = base.filter(item => item !== 'Image generation')
  }
  if (isVideoGenerationEnabled()) {
    base = base.filter(item => item !== 'Video generation')
  }
  return base
}

function effectiveSupportedList(): string[] {
  const base: string[] = [...IMAGE_CONTEXT_CAPABILITY.supported]
  if (isImageGenerationEnabled()) base.push(GENERATION_SUPPORTED)
  if (isVideoGenerationEnabled()) base.push(VIDEO_GENERATION_SUPPORTED)
  return base
}

export type ImageContextUploadError =
  | 'unsupported_type'
  | 'file_too_large'
  | 'video_not_supported'
  | 'carousel_not_supported'

const ALLOWED_MIMES = new Set<string>(IMAGE_CONTEXT_CAPABILITY.limits.allowedMimeTypes)

export function imageContextAllowedMimeTypes(): readonly string[] {
  return IMAGE_CONTEXT_CAPABILITY.limits.allowedMimeTypes
}

export function imageContextAcceptHeader(): string {
  return IMAGE_CONTEXT_CAPABILITY.limits.allowedMimeTypes
    .filter(m => m !== 'image/jpg')
    .join(',')
}

export function buildImageContextCapabilityPrompt(): string {
  const supported = effectiveSupportedList().join('; ')
  const unsupported = effectiveUnsupportedList().join('; ')
  const imageNote = isImageGenerationEnabled()
    ? 'If asked to create a new post image in chat, direct them to Agents → Single post → Generate with Maya (you cannot run the image model from chat). Targeted edits on a picked generated option happen in that same flow.'
    : null
  const videoNote = isVideoGenerationEnabled()
    ? 'If asked to generate a short video in chat, direct them to Agents → Single post → Generate video (async — review in Approvals when ready).'
    : null
  const fallbackNote =
    !isImageGenerationEnabled() && !isVideoGenerationEnabled()
      ? 'If asked to generate, edit beyond crop, build a carousel, or use video, refuse and explain the owner must supply a still image (they may crop before upload) — Maya writes the caption to match the final frame.'
      : [imageNote, videoNote].filter(Boolean).join(' ')

  const flagSuffix = [
    isImageGenerationEnabled() ? ' + image gen' : '',
    isVideoGenerationEnabled() ? ' + video gen' : '',
  ].join('')

  return `POST MEDIA CAPABILITY (v1${flagSuffix}):
Supported: ${supported}.
Not supported: ${unsupported}.
${fallbackNote}`
}

export function buildImageContextAgentConstraints(): string {
  const unsupported = effectiveUnsupportedList()
    .map(item => item.toLowerCase())
    .join(', ')
  const parts: string[] = []
  if (isImageGenerationEnabled()) {
    parts.push('generate post images in Agents → Single post → Generate with Maya (not in this chat)')
  }
  if (isVideoGenerationEnabled()) {
    parts.push('generate short video in Agents → Single post → Generate video (not in this chat)')
  }
  if (parts.length > 0) {
    return `Post media: user may upload a still for vision captions, or ${parts.join('; ')}. Saved image generations are in Assets. You must never ${unsupported}. One image per post only.`
  }
  return `Image-context captions: you may read a user-supplied still image and write matching copy. The owner may crop before upload; always assume you see the final exported frame. You must never ${unsupported}. One image per post only.`
}

export function validateImageContextUpload(
  mime: string,
  sizeBytes: number,
): { ok: true } | { ok: false; code: ImageContextUploadError; message: string } {
  if (mime.startsWith('video/')) {
    return {
      ok: false,
      code: 'video_not_supported',
      message: 'Video is not supported in image-context captions (v1).',
    }
  }
  if (!ALLOWED_MIMES.has(mime)) {
    return {
      ok: false,
      code: 'unsupported_type',
      message: 'Only JPEG, PNG, and WebP images are supported.',
    }
  }
  if (sizeBytes > IMAGE_CONTEXT_CAPABILITY.limits.maxBytes) {
    return {
      ok: false,
      code: 'file_too_large',
      message: 'Image must be under 20 MB.',
    }
  }
  return { ok: true }
}

export function assertSingleImageContextMedia(mediaCount: number): string | null {
  if (mediaCount <= IMAGE_CONTEXT_CAPABILITY.limits.maxImagesPerPost) return null
  return 'Carousels are not supported — one image per post in image-context caption mode (v1).'
}
