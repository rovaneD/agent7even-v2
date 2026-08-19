import * as publisher from '@/lib/social/publisher'
import {
  downloadPostAsset,
  readPostMediaRef,
} from '@/lib/postAssets'
import { deductCredits, refundCredits } from '@/lib/credits'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'
import { createServiceClient } from '@/lib/supabase/server'
import { primaryPlatformFromInput } from '@/lib/agents/visionCaption'

const PUBLISH_CREDIT_COST = ACTION_CREDIT_COST.publish

/** Expected skips — keep the local approval; do not send back to the queue. */
export const NON_RETRYABLE_PUBLISH_SKIP_DETAILS = [
  'no_media',
  'video_not_supported',
  'zernio_not_configured',
  'not_connected',
  'no_account_for_platform',
] as const

/**
 * After the approve route CAS-claims a pending output, a failed Zernio
 * publish must restore `pending_approval` or the owner gets `409 not_pending`
 * and cannot retry. Configuration skips (not connected, no account) stay approved.
 */
export function shouldRevertApprovalAfterPublish(opts: {
  intendedToPublish: boolean
  publish: { scheduled: boolean; detail?: string } | null
}): boolean {
  if (!opts.intendedToPublish) return false
  if (opts.publish?.scheduled) return false
  const detail = opts.publish?.detail
  if (!detail) return true
  return !(NON_RETRYABLE_PUBLISH_SKIP_DETAILS as readonly string[]).includes(detail)
}

function normalizePlatform(value: string): string {
  const v = value.toLowerCase().trim()
  if (v.includes('instagram') || v === 'ig') return 'instagram'
  if (v.includes('facebook') || v === 'fb') return 'facebook'
  if (v.includes('linkedin')) return 'linkedin'
  if (v === 'x' || v.includes('twitter')) return 'x'
  return v
}

/** After approval, schedule a single-image post through Zernio when media is attached. */
export async function publishApprovedImageCaption(opts: {
  profileId: string
  outputId?: string
  taskInput: Record<string, unknown>
  outputContent: Record<string, unknown>
  caption: string
  taskId: string
}): Promise<{ scheduled: boolean; detail?: string; postId?: string }> {
  const media = readPostMediaRef(opts.outputContent)
  if (!media.media_storage_path) {
    return { scheduled: false, detail: 'no_media' }
  }

  if (media.media_mime?.startsWith('video/')) {
    return { scheduled: false, detail: 'video_not_supported' }
  }

  if (!process.env.ZERNIO_API_KEY) {
    return { scheduled: false, detail: 'zernio_not_configured' }
  }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('zernio_profile_id')
    .eq('id', opts.profileId)
    .single()

  const zernioProfileId = (profile?.zernio_profile_id as string | null) ?? null
  if (!zernioProfileId) {
    return { scheduled: false, detail: 'not_connected' }
  }

  const platformLabel = primaryPlatformFromInput(opts.taskInput)
  const platform = normalizePlatform(platformLabel)
  let accounts: Array<{ id: string; platform: string; username: string }>
  try {
    accounts = await publisher.withZernioUsageContext(
      { userId: opts.profileId, zernioProfileId },
      () => publisher.getProfileAccountsStrict(zernioProfileId),
    )
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'accounts_fetch_failed'
    console.error('[publishApprovedImageCaption] accounts fetch failed:', detail)
    return { scheduled: false, detail: 'accounts_fetch_failed' }
  }
  const account = accounts.find(a => a.platform.toLowerCase() === platform)
    ?? accounts.find(a => platformLabel.toLowerCase().includes(a.platform.toLowerCase()))
    ?? accounts[0]

  if (!account) {
    return { scheduled: false, detail: 'no_account_for_platform' }
  }

  const bytes = await downloadPostAsset(media.media_storage_path)
  if (!bytes) {
    return { scheduled: false, detail: 'media_download_failed' }
  }

  const mime = media.media_mime ?? 'image/jpeg'
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'

  return publisher.withZernioUsageContext(
    { userId: opts.profileId, zernioProfileId },
    async () => {
  const presign = await publisher.presignMedia({
    filename: `approved-post.${ext}`,
    contentType: mime,
    size: bytes.byteLength,
  })
  if (!presign) {
    return { scheduled: false, detail: 'presign_failed' }
  }

  const body = new Uint8Array(bytes).buffer
  const uploaded = await publisher.uploadToPresignedUrl(presign.uploadUrl, body, mime)
  if (!uploaded) {
    return { scheduled: false, detail: 'zernio_upload_failed' }
  }

  try {
    await deductCredits(
      opts.profileId,
      PUBLISH_CREDIT_COST,
      'Social publish — image caption post',
      opts.taskId,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'INSUFFICIENT_CREDITS') {
      return { scheduled: false, detail: 'insufficient_credits' }
    }
    throw err
  }

  try {
    const raw = await publisher.createPost({
      profileId: zernioProfileId,
      content: opts.caption.trim(),
      platforms: [{ platform: account.platform, accountId: account.id }],
      isDraft: true,
      mediaItems: [{ type: presign.mediaType, url: presign.publicUrl, title: 'post-image' }],
      requestId: `approve-${opts.taskId}`,
    })

    const postId = typeof raw === 'object' && raw !== null
      ? String((raw as Record<string, unknown>).id ?? (raw as Record<string, unknown>)._id ?? '')
      : undefined

    return { scheduled: true, postId: postId || undefined }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'create_failed'
    console.error('[publishApprovedImageCaption]', detail)
    refundCredits(
      opts.profileId,
      PUBLISH_CREDIT_COST,
      'Refund - image caption post publish failed',
      opts.taskId,
    ).catch(refundErr => {
      console.error('[publishApprovedImageCaption] refund failed:', refundErr)
    })
    return { scheduled: false, detail }
  }
    },
  )
}
