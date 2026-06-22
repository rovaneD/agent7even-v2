import { randomUUID } from 'crypto'
import { createPostAssetSignedUrl, downloadPostAsset, uploadPostAsset } from '@/lib/postAssets'
import { composeImageBriefs, briefComposeModel, defaultImageModel, imageOptionCount } from './briefCompose'
import {
  appendQaFixToBrief,
  prepareBriefForImageModel,
} from './briefValidation'
import { buildFoundationSnapshotMarkdown } from './foundationSnapshot'
import {
  formatBrandKitBriefBlock,
  loadBrandKitGenerationSnapshot,
} from './brandKitSnapshot'
import { resolveImageGenerationModel, type ImageGenerationModelId } from './imageModelCatalog'
import { formatPostContextBriefBlock } from './postContextBrief'
import { buildTextOnlyRegenBrief, detectImageEditMode, type ImageEditMode } from './editPrompt'
import { generateImageEditFromSource, generateImageFromBrief, isGoogleImageModel } from './openRouterImage'
import { runTextQaGate } from './textQaGate'
import { GENERATION_OPTION_QA_MAX_RETRIES, type GenerateImageOptionsResult } from './types'

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
  useBrandKit?: boolean
  includeLogo?: boolean
  imageModelId?: ImageGenerationModelId | string | null
  postContext?: Record<string, string>
}): Promise<GenerateImageOptionsResult> {
  const briefId = randomUUID()
  const modelEntry = resolveImageGenerationModel(opts.imageModelId)
  const imageModel = modelEntry.openRouterModel
  const count = imageOptionCount()

  if (!opts.postContext?.postGoal?.trim()) {
    throw new Error('post_goal_required')
  }

  const foundationMarkdown = await buildFoundationSnapshotMarkdown(opts.profileId, opts.companyName)

  let brandKitBlock: string | null = null
  if (opts.useBrandKit) {
    const snapshot = await loadBrandKitGenerationSnapshot(opts.profileId)
    if (snapshot.available) {
      brandKitBlock = formatBrandKitBriefBlock(snapshot, {
        includeLogo: opts.includeLogo === true,
        companyName: opts.companyName,
      })
    }
  }

  const briefs = await composeImageBriefs({
    foundationMarkdown,
    companyName: opts.companyName,
    sceneDirection: opts.sceneDirection,
    count,
    brandKitBlock,
    postContextBlock: formatPostContextBriefBlock(opts.postContext),
    imageModelId: modelEntry.id,
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
    bytesList.map((bytes, index) =>
      ensureOptionPassesQa({
        profileId: opts.profileId,
        companyName: opts.companyName,
        postGoal: opts.postContext?.postGoal?.trim(),
        briefId,
        optionIndex: index,
        brief: briefs[index]!,
        imageModel,
        imageModelId: modelEntry.id,
        initialBytes: bytes,
      }),
    ),
  )

  return {
    briefId,
    briefModel: briefComposeModel(),
    imageModel,
    imageModelId: modelEntry.id,
    imageModelLabel: modelEntry.label,
    options,
  }
}

async function uploadRegeneratedOption(opts: {
  profileId: string
  briefId: string
  optionIndex: number
  brief: string
  imageModel?: string
  filenameSuffix?: string
  bytes: Buffer
}): Promise<GenerateImageOptionsResult['options'][number]> {
  const imageModel = opts.imageModel?.trim() || defaultImageModel()
  const mime = detectImageMime(opts.bytes)
  const ext = extForMime(mime)
  const base = `generated-${opts.briefId.slice(0, 8)}-opt-${opts.optionIndex + 1}`
  const filename = opts.filenameSuffix ? `${base}-${opts.filenameSuffix}.${ext}` : `${base}.${ext}`
  const { storagePath } = await uploadPostAsset({
    profileId: opts.profileId,
    filename,
    mime,
    bytes: opts.bytes,
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

/** Run vision QA and auto-regenerate options that leak design specs or fail text checks. */
async function ensureOptionPassesQa(opts: {
  profileId: string
  companyName: string
  postGoal?: string
  briefId: string
  optionIndex: number
  brief: string
  imageModel: string
  imageModelId: ImageGenerationModelId
  initialBytes: Buffer
}): Promise<GenerateImageOptionsResult['options'][number]> {
  let brief = prepareBriefForImageModel(opts.brief, opts.imageModelId, opts.companyName)
  let bytes = opts.initialBytes

  for (let attempt = 0; attempt <= GENERATION_OPTION_QA_MAX_RETRIES; attempt++) {
    const option = await uploadRegeneratedOption({
      profileId: opts.profileId,
      briefId: opts.briefId,
      optionIndex: opts.optionIndex,
      brief,
      imageModel: opts.imageModel,
      filenameSuffix: attempt === 0 ? undefined : `qa${attempt}`,
      bytes,
    })

    const qa = await runTextQaGate({
      profileId: opts.profileId,
      companyName: opts.companyName,
      storagePath: option.storagePath,
    })
    if (qa.passed) return option

    if (attempt >= GENERATION_OPTION_QA_MAX_RETRIES) {
      return option
    }

    brief = appendQaFixToBrief(
      brief,
      qa.issues,
      opts.imageModelId,
      opts.companyName,
      opts.postGoal,
    )
    bytes = await generateImageFromBrief(opts.imageModel, brief)
  }

  throw new Error('qa_finalize_failed')
}

/** Regenerate one option after QA fail (bounded retries in UI). */
export async function regenerateImageOption(opts: {
  profileId: string
  briefId: string
  optionIndex: number
  brief: string
  imageModel?: string
}): Promise<GenerateImageOptionsResult['options'][number]> {
  const imageModel = opts.imageModel?.trim() || defaultImageModel()
  const bytes = await generateImageFromBrief(imageModel, opts.brief)
  return uploadRegeneratedOption({
    ...opts,
    imageModel,
    filenameSuffix: 'r',
    bytes,
  })
}

/** User-directed edit — text-only uses Recraft regen; visual uses Gemini img2img when available. */
export async function editImageOption(opts: {
  profileId: string
  briefId: string
  optionIndex: number
  brief: string
  editInstruction: string
  imageModel?: string
  sourceStoragePath: string
  editMode?: ImageEditMode
}): Promise<GenerateImageOptionsResult['options'][number]> {
  const editMode = opts.editMode ?? detectImageEditMode(opts.editInstruction)
  const revisedBrief =
    editMode === 'text-only'
      ? buildTextOnlyRegenBrief(opts.brief, opts.editInstruction)
      : `${opts.brief.trim()}\n\nREVISION (apply exactly; keep everything else the same):\n${opts.editInstruction.trim()}`

  const textEditModel = resolveImageGenerationModel('sharp-text').openRouterModel
  const visualModel = opts.imageModel?.trim() || defaultImageModel()

  let bytes: Buffer
  let modelUsed: string

  if (editMode === 'text-only') {
    modelUsed = textEditModel
    bytes = await generateImageFromBrief(textEditModel, revisedBrief)
  } else if (isGoogleImageModel(visualModel)) {
    modelUsed = visualModel
    const sourceBytes = await downloadPostAsset(opts.sourceStoragePath)
    if (!sourceBytes) throw new Error('source_image_not_found')
    bytes = await generateImageEditFromSource({
      model: visualModel,
      sourceBytes,
      sourceMime: detectImageMime(sourceBytes),
      brief: opts.brief,
      editInstruction: opts.editInstruction,
      editMode,
    })
  } else {
    modelUsed = visualModel
    bytes = await generateImageFromBrief(visualModel, revisedBrief)
  }

  return uploadRegeneratedOption({
    profileId: opts.profileId,
    briefId: opts.briefId,
    optionIndex: opts.optionIndex,
    brief: revisedBrief,
    imageModel: modelUsed,
    filenameSuffix: 'edit',
    bytes,
  })
}

export function assertPostAssetOwnedByProfile(storagePath: string, profileId: string): boolean {
  return storagePath.startsWith(`${profileId}/`)
}
