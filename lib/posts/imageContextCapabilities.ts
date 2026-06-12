/**
 * Image-context caption capability (v1).
 * Source of truth for what this flow supports and explicitly does not do.
 */

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
  const supported = IMAGE_CONTEXT_CAPABILITY.supported.join('; ')
  const unsupported = IMAGE_CONTEXT_CAPABILITY.unsupported.join('; ')
  return `IMAGE-CONTEXT CAPABILITY (v1):
Supported: ${supported}.
Not supported: ${unsupported}.
If asked to generate, crop, edit, build a carousel, or use video, refuse and explain the owner must supply a ready-to-post still image — Maya writes the caption to match it.`
}

export function buildImageContextAgentConstraints(): string {
  const unsupported = IMAGE_CONTEXT_CAPABILITY.unsupported
    .map(item => item.toLowerCase())
    .join(', ')
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
