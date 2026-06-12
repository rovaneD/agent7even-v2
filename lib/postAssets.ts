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

export async function createPostAssetSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage
    .from(POST_ASSETS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    console.error('[postAssets] signed URL failed:', error?.message)
    return null
  }
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
