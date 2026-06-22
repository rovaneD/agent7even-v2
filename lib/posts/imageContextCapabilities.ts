/**
 * Post media capability (upload + optional generation behind flag).
 * Source of truth for Maya chat prompts and agent constraint copy.
 */

import { isImageGenerationEnabled } from '@/lib/posts/imageGenerationFlag'

export const IMAGE_CONTEXT_CAPABILITY = {
  id: 'image_context_caption',
  version: 'v1',
  supported: [
    'Owner uploads a ready-to-post still image',
    'Maya reads the attached image via vision and writes caption copy in context',
    'Caption and image stay paired through approval and publish',
  ],
  unsupported: [
    'Image generation',
    'Cropping or in-platform image editing',
    'Carousels (multi-image posts)',
    'Video',
  ],
  limits: {
    maxImagesPerPost: 1,
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const,
    maxBytes: 20 * 1024 * 1024,
  },
} as const

const GENERATION_SUPPORTED =
  'Generate post images in Agents → Single post → Generate with Maya (Foundation-grounded brief, 3 options, text QA before approval); saved options live in Assets'

/** Upload/caption baseline — generation removed when flag is on. */
function effectiveUnsupportedList(): string[] {
  const base = [...IMAGE_CONTEXT_CAPABILITY.unsupported]
  if (!isImageGenerationEnabled()) return base
  return base.filter(item => item !== 'Image generation')
}

function effectiveSupportedList(): string[] {
  const base: string[] = [...IMAGE_CONTEXT_CAPABILITY.supported]
  if (isImageGenerationEnabled()) base.push(GENERATION_SUPPORTED)
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
  const generationNote = isImageGenerationEnabled()
    ? 'If asked to create a new post image in chat, direct them to Agents → Single post → Generate with Maya (you cannot run the image model from chat). Targeted edits on a picked generated option happen in that same flow.'
    : 'If asked to generate, crop, edit, build a carousel, or use video, refuse and explain the owner must supply a ready-to-post still image — Maya writes the caption to match it.'
  return `POST MEDIA CAPABILITY (v1${isImageGenerationEnabled() ? ' + generation' : ''}):
Supported: ${supported}.
Not supported: ${unsupported}.
${generationNote}`
}

export function buildImageContextAgentConstraints(): string {
  const unsupported = effectiveUnsupportedList()
    .map(item => item.toLowerCase())
    .join(', ')
  if (isImageGenerationEnabled()) {
    return `Post media: user may upload a still for vision captions, or generate options in Agents → Single post → Generate with Maya (not in this chat). Saved generations are in Assets. You must never ${unsupported}. One image per post only.`
  }
  return `Image-context captions: you may read a user-supplied still image and write matching copy. You must never ${unsupported}. One image per post only.`
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
