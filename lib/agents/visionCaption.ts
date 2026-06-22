import { AGENT_MODELS } from '@/lib/agents/cost'
import { buildImageContextCapabilityPrompt } from '@/lib/posts/imageContextCapabilities'
import { downloadPostAsset } from '@/lib/postAssets'
import { compressImageForApiPayload } from '@/lib/postAssetsImagePayload'

export const VISION_CAPTION_MODEL = AGENT_MODELS.sonnet

export async function loadPostAssetDataUrl(
  storagePath: string,
): Promise<{ dataUrl: string; mime: string; bytes: Buffer } | null> {
  const bytes = await downloadPostAsset(storagePath)
  if (!bytes) return null
  try {
    const compressed = await compressImageForApiPayload(bytes)
    const dataUrl = `data:${compressed.mime};base64,${compressed.bytes.toString('base64')}`
    return { dataUrl, mime: compressed.mime, bytes: compressed.bytes }
  } catch {
    return null
  }
}

export function buildImageCaptionSystemAddon(params: {
  companyName: string
  platform: string
  charLimit: number
}): string {
  return `${buildImageContextCapabilityPrompt()}

IMAGE-CONTEXT CAPTION MODE — A post image is attached. This is the exact visual that will be published.

Write ONE social caption for ${params.companyName}. The image is attached — reference what is actually shown, match the mood, and complement it. Do not describe the image literally or list every object.

Channel: ${params.platform}. Keep within ${params.charLimit} characters. Return ONLY the caption text — no headings, no quotes, no markdown.`
}

export {
  captionLimitForPlatform as platformCharLimit,
  primaryPlatformFromTaskInput as primaryPlatformFromInput,
} from '@/lib/social/postConstraints'

export function buildVisionUserMessage(params: {
  textInstruction: string
  imageUrl: string
}): Array<{ type: 'text'; text: string } | { type: 'image'; image: URL }> {
  return [
    { type: 'image', image: new URL(params.imageUrl) },
    { type: 'text', text: params.textInstruction },
  ]
}

/** Prefer this for private post-assets — OpenRouter/Google reject raw HTTPS URLs in image parts. */
export async function buildVisionUserMessageFromStorage(params: {
  textInstruction: string
  storagePath: string
}): Promise<Array<{ type: 'text'; text: string } | { type: 'image'; image: URL }>> {
  const loaded = await loadPostAssetDataUrl(params.storagePath)
  if (!loaded) throw new Error('image_download_failed')
  return buildVisionUserMessage({
    textInstruction: params.textInstruction,
    imageUrl: loaded.dataUrl,
  })
}
