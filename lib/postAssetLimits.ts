import {
  IMAGE_CONTEXT_CAPABILITY,
  imageContextAllowedMimeTypes,
} from '@/lib/posts/imageContextCapabilities'

export const POST_ASSETS_BUCKET = 'post-assets'

export const POST_IMAGE_MIMES = new Set(imageContextAllowedMimeTypes())

/** Match Instagram-oriented publish limits (see posts/media route). */
export const POST_IMAGE_MAX_BYTES = IMAGE_CONTEXT_CAPABILITY.limits.maxBytes

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload.jpg'
}

export function mimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

export type PostMediaRef = {
  media_storage_path?: string
  media_mime?: string
}

export function readPostMediaRef(source: Record<string, unknown> | null | undefined): PostMediaRef {
  if (!source) return {}
  const path = typeof source.media_storage_path === 'string' ? source.media_storage_path : undefined
  const mime = typeof source.media_mime === 'string' ? source.media_mime : undefined
  return { media_storage_path: path, media_mime: mime }
}
