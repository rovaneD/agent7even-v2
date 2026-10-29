import { createServiceClient } from '@/lib/supabase/server'
import {
  POST_ASSETS_BUCKET,
  POST_IMAGE_MIMES,
  POST_IMAGE_MAX_BYTES,
  sanitizeFilename,
} from '@/lib/postAssetLimits'

export {
  POST_ASSETS_BUCKET,
  POST_IMAGE_MIMES,
  POST_IMAGE_MAX_BYTES,
  sanitizeFilename,
  mimeFromFilename,
  readPostMediaRef,
  type PostMediaRef,
} from '@/lib/postAssetLimits'

export function buildPostAssetPath(profileId: string, filename: string): string {
  return `${profileId}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`
}

export async function ensurePostAssetsBucket(supabase: ReturnType<typeof createServiceClient>) {
  const { error } = await supabase.storage.createBucket(POST_ASSETS_BUCKET, {
    public: false,
    fileSizeLimit: POST_IMAGE_MAX_BYTES,
    allowedMimeTypes: Array.from(POST_IMAGE_MIMES),
  })
  if (error && !/already exists/i.test(error.message)) {
    console.error('[postAssets] bucket create error:', error.message)
  }
}

export async function uploadPostAsset(params: {
  profileId: string
  filename: string
  mime: string
  bytes: Buffer
}): Promise<{ storagePath: string }> {
  if (!POST_IMAGE_MIMES.has(params.mime)) {
    throw new Error('unsupported_type')
  }
  if (params.bytes.byteLength > POST_IMAGE_MAX_BYTES) {
    throw new Error('file_too_large')
  }

  const supabase = createServiceClient()
  await ensurePostAssetsBucket(supabase)
  const storagePath = buildPostAssetPath(params.profileId, params.filename)

  const { error } = await supabase.storage
    .from(POST_ASSETS_BUCKET)
    .upload(storagePath, params.bytes, { contentType: params.mime, upsert: false })

  if (error) throw new Error(error.message)
  return { storagePath }
}

/**
 * Reuse a signed URL while it still has most of its life left. Every new signature is a new URL, so the
 * browser can't use its cache and re-downloads the file: the Approvals page re-signed every video on its
 * 45s refresh, which used ~20 GB of Supabase egress in one day (2026-10-27). Per warm function instance.
 */
const signedCache = new Map<string, { url: string; until: number }>()

export async function createPostAssetSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const key = `${storagePath}|${expiresInSeconds}`
  const hit = signedCache.get(key)
  if (hit && hit.until > Date.now()) return hit.url
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage
    .from(POST_ASSETS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    console.error('[postAssets] signed URL failed:', error?.message)
    return null
  }
  if (signedCache.size > 2000) signedCache.clear()
  // Hand out the same URL for the first half of its life; callers always get >= half the expiry left.
  signedCache.set(key, { url: data.signedUrl, until: Date.now() + (expiresInSeconds * 1000) / 2 })
  return data.signedUrl
}

export async function downloadPostAsset(storagePath: string): Promise<Buffer | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage.from(POST_ASSETS_BUCKET).download(storagePath)
  if (error || !data) {
    console.error('[postAssets] download failed:', error?.message)
    return null
  }
  return Buffer.from(await data.arrayBuffer())
}
