import { randomUUID } from 'crypto'
import { createPostAssetSignedUrl, downloadPostAsset, uploadPostAsset } from '@/lib/postAssets'
import { composeImageBriefs, briefComposeModel, defaultImageModel, imageOptionCount } from './briefCompose'
import {
  appendQaFixToBrief,
  prepareBriefForImageModel,
} from './briefValidation'
import {
  formatBrandKitBriefBlock,
  loadBrandKitGenerationSnapshot,
} from './brandKitSnapshot'
import {
  formatCreativeDirectionBlock,
  getOrComputeCreativeDirection,
} from '@/lib/agents/foundationCreativeDirection'
import { resolveImageGenerationModel, type ImageGenerationModelId } from './imageModelCatalog'
import { formatPostContextBriefBlock } from './postContextBrief'
import { postGroundingFromForm, type PostGroundingContext } from './postGrounding'
import { buildTextOnlyRegenBrief, detectImageEditMode, extractExpectedHeadline, TEXT_EDIT_QA_MAX_RETRIES, type ImageEditMode } from './editPrompt'
import { generateImageEditFromSource, generateImageFromBrief, isGoogleImageModel, type ImageAspectRatio } from './openRouterImage'
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
  aspectRatio?: ImageAspectRatio
}): Promise<GenerateImageOptionsResult> {
  const briefId = randomUUID()
  const modelEntry = resolveImageGenerationModel(opts.imageModelId)
  const imageModel = modelEntry.openRouterModel
  const count = imageOptionCount()

  if (!opts.postContext?.postGoal?.trim()) {
    throw new Error('post_goal_required')
  }

  const [creativeDirection, brandKitSnapshot] = await Promise.all([
    getOrComputeCreativeDirection({
      profileId: opts.profileId,
      companyName: opts.companyName,
    }),
    opts.useBrandKit
      ? loadBrandKitGenerationSnapshot(opts.profileId)
      : Promise.resolve(null),
  ])

  const creativeDirectionBlock = formatCreativeDirectionBlock(
    creativeDirection,
    opts.companyName,
  )

  let brandKitBlock: string | null = null
  if (brandKitSnapshot?.available) {
    brandKitBlock = formatBrandKitBriefBlock(brandKitSnapshot, {
      includeLogo: opts.includeLogo === true,
      companyName: opts.companyName,
    })
  }

  const postContext = postGroundingFromForm(opts.postContext)
  const aspectRatio: ImageAspectRatio = opts.aspectRatio ?? '4:5'

  const briefs = await composeImageBriefs({
    creativeDirectionBlock,
    companyName: opts.companyName,
    sceneDirection: opts.sceneDirection,
    count,
    brandKitBlock,
    postContextBlock: formatPostContextBriefBlock(opts.postContext),
    postContext,
    imageModelId: modelEntry.id,
  })

  const bytesList = await Promise.all(
    briefs.map(async (brief, index) => {
      try {
        return await generateImageFromBrief(imageModel, brief, aspectRatio)
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
        postContext,
        includeLogo: opts.includeLogo === true,
        briefId,
        optionIndex: index,
        brief: briefs[index]!,
        imageModel,
        imageModelId: modelEntry.id,
        initialBytes: bytes,
        aspectRatio,
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
  postContext?: PostGroundingContext
  includeLogo?: boolean
  briefId: string
  optionIndex: number
  brief: string
  imageModel: string
  imageModelId: ImageGenerationModelId
  initialBytes: Buffer
  aspectRatio: ImageAspectRatio
}): Promise<GenerateImageOptionsResult['options'][number]> {
  let brief = prepareBriefForImageModel(opts.brief, opts.imageModelId, opts.companyName, opts.postContext)
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
      postContext: opts.postContext,
      includeLogo: opts.includeLogo,
      brief: opts.brief,
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
      opts.postContext,
    )
    bytes = await generateImageFromBrief(opts.imageModel, brief, opts.aspectRatio)
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
  const bytes = await generateImageFromBrief(imageModel, opts.brief, '4:5')
  return uploadRegeneratedOption({
    ...opts,
    imageModel,
    filenameSuffix: 'r',
    bytes,
  })
}

/** User-directed edit — text-only always img2img on source; visual uses Gemini img2img when available. */
export async function editImageOption(opts: {
  profileId: string
  companyName: string
  briefId: string
  optionIndex: number
  brief: string
  editInstruction: string
  imageModel?: string
  sourceStoragePath: string
  editMode?: ImageEditMode
  postContext?: PostGroundingContext
  includeLogo?: boolean
}): Promise<GenerateImageOptionsResult['options'][number]> {
  const editMode = opts.editMode ?? detectImageEditMode(opts.editInstruction)
  const expectedHeadline = extractExpectedHeadline(opts.editInstruction)
  const revisedBrief =
    editMode === 'text-only'
      ? buildTextOnlyRegenBrief(opts.brief, opts.editInstruction)
      : `${opts.brief.trim()}\n\nREVISION (apply exactly; keep everything else the same):\n${opts.editInstruction.trim()}`

  const visualModel = opts.imageModel?.trim() || defaultImageModel()
  const img2imgModel = isGoogleImageModel(visualModel)
    ? visualModel
    : resolveImageGenerationModel('balanced').openRouterModel

  let bytes: Buffer
  let modelUsed: string
  const lastBrief = revisedBrief

  if (editMode === 'text-only') {
    const sourceBytes = await downloadPostAsset(opts.sourceStoragePath)
    if (!sourceBytes) throw new Error('source_image_not_found')
    const sourceMime = detectImageMime(sourceBytes)

    let lastOption: GenerateImageOptionsResult['options'][number] | null = null

    for (let attempt = 0; attempt <= TEXT_EDIT_QA_MAX_RETRIES; attempt++) {
      modelUsed = img2imgModel
      bytes = await generateImageEditFromSource({
        model: img2imgModel,
        sourceBytes,
        sourceMime,
        brief: opts.brief,
        editInstruction: opts.editInstruction,
        editMode: 'text-only',
        spellingRetry: attempt > 0,
      })

      const option = await uploadRegeneratedOption({
        profileId: opts.profileId,
        briefId: opts.briefId,
        optionIndex: opts.optionIndex,
        brief: lastBrief,
        imageModel: modelUsed,
        filenameSuffix: attempt === 0 ? 'edit' : `edit${attempt}`,
        bytes,
      })
      lastOption = option

      const qa = await runTextQaGate({
        profileId: opts.profileId,
        companyName: opts.companyName,
        storagePath: option.storagePath,
        postContext: opts.postContext,
        includeLogo: opts.includeLogo,
        expectedHeadline,
        brief: opts.brief,
      })
      if (qa.passed || attempt >= TEXT_EDIT_QA_MAX_RETRIES) {
        return option
      }
    }

    if (lastOption) return lastOption
    throw new Error('text_edit_failed')
  }

  if (isGoogleImageModel(visualModel)) {
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
  // Fail closed: empty ids must never authorize a storage download.
  if (!storagePath || !profileId) return false
  return storagePath.startsWith(`${profileId}/`)
}
