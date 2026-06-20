import { randomUUID } from 'crypto'
import { createPostAssetSignedUrl, uploadPostAsset } from '@/lib/postAssets'
import { composeImageBriefs, briefComposeModel, defaultImageModel, imageOptionCount } from './briefCompose'
import { buildFoundationSnapshotMarkdown } from './foundationSnapshot'
import { generateImageFromBrief } from './openRouterImage'
import type { GenerateImageOptionsResult } from './types'

function detectImageMime(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'
  if (buf.slice(0, 4).toString('ascii') === 'RIFF') return 'image/webp'
  return 'image/png'
}

function extForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  return 'png'
}

/**
 * Pre-queue compose step 2: gate passed → briefs → 3 image model calls → upload to post-assets.
 * Does not insert agent_outputs (steps 4–6). Credits deferred to handoff §9 step 7.
 */
export async function generateImageOptions(opts: {
  profileId: string
  companyName: string
  sceneDirection?: string
}): Promise<GenerateImageOptionsResult> {
  const briefId = randomUUID()
  const imageModel = defaultImageModel()
  const count = imageOptionCount()

  const foundationMarkdown = await buildFoundationSnapshotMarkdown(opts.profileId, opts.companyName)
  const briefs = await composeImageBriefs({
    foundationMarkdown,
    companyName: opts.companyName,
    sceneDirection: opts.sceneDirection,
    count,
  })

  const bytesList = await Promise.all(
    briefs.map(async (brief, index) => {
      try {
        return await generateImageFromBrief(imageModel, brief)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new Error(`Image option ${index + 1} failed: ${msg}`)
      }
    }),
  )

  const options = await Promise.all(
    bytesList.map(async (bytes, index) => {
      const mime = detectImageMime(bytes)
      const ext = extForMime(mime)
      const { storagePath } = await uploadPostAsset({
        profileId: opts.profileId,
        filename: `generated-${briefId.slice(0, 8)}-opt-${index + 1}.${ext}`,
        mime,
        bytes,
      })
      const previewUrl = await createPostAssetSignedUrl(storagePath)
      return {
        index,
        brief: briefs[index]!,
        storagePath,
        mime,
        previewUrl,
        model: imageModel,
      }
    }),
  )

  return {
    briefId,
    briefModel: briefComposeModel(),
    imageModel,
    options,
  }
}

/** Regenerate one option after QA fail (bounded retries in UI). */
export async function regenerateImageOption(opts: {
  profileId: string
  briefId: string
  optionIndex: number
  brief: string
}): Promise<GenerateImageOptionsResult['options'][number]> {
  const imageModel = defaultImageModel()
  const bytes = await generateImageFromBrief(imageModel, opts.brief)
  const mime = detectImageMime(bytes)
  const ext = extForMime(mime)
  const { storagePath } = await uploadPostAsset({
    profileId: opts.profileId,
    filename: `generated-${opts.briefId.slice(0, 8)}-opt-${opts.optionIndex + 1}-r.${ext}`,
    mime,
    bytes,
  })
  const previewUrl = await createPostAssetSignedUrl(storagePath)
  return {
    index: opts.optionIndex,
    brief: opts.brief,
    storagePath,
    mime,
    previewUrl,
    model: imageModel,
  }
}

export function assertPostAssetOwnedByProfile(storagePath: string, profileId: string): boolean {
  return storagePath.startsWith(`${profileId}/`)
}
