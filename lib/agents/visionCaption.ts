import { AGENT_MODELS } from '@/lib/agents/cost'
import { buildImageContextCapabilityPrompt } from '@/lib/posts/imageContextCapabilities'
import { downloadPostAsset } from '@/lib/postAssets'

export const VISION_CAPTION_MODEL = AGENT_MODELS.sonnet

export async function loadPostAssetDataUrl(
  storagePath: string,
): Promise<{ dataUrl: string; mime: string; bytes: Buffer } | null> {
  const bytes = await downloadPostAsset(storagePath)
  if (!bytes) return null
  try {
    const { compressImageForApiPayload } = await import('@/lib/postAssetsImagePayload')
    const compressed = await compressImageForApiPayload(bytes)
    const dataUrl = `data:${compressed.mime};base64,${compressed.bytes.toString('base64')}`
    return { dataUrl, mime: compressed.mime, bytes: compressed.bytes }
  } catch (err) {
    // Compression (sharp) failed. Log it, and send the original image when it is
    // already small enough for the vision API instead of failing the whole step.
    console.error('[visionCaption] image compression failed:', err instanceof Error ? err.message : err)
    const mime = sniffImageMime(bytes)
    if (mime && bytes.byteLength <= ORIGINAL_IMAGE_MAX_BYTES) {
      return { dataUrl: `data:${mime};base64,${bytes.toString('base64')}`, mime, bytes }
    }
    return null
  }
}

/** Matches API_IMAGE_PAYLOAD_MAX_BYTES in postAssetsImagePayload (kept local so a sharp load failure cannot break it). */
const ORIGINAL_IMAGE_MAX_BYTES = 3_800_000

function sniffImageMime(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
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
