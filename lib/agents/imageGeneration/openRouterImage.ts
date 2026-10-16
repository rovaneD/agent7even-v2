import { compressImageForApiPayload } from '@/lib/postAssetsImagePayload'
import { buildImageEditPrompt, detectImageEditMode, type ImageEditMode } from './editPrompt'

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'

export function openRouterHeaders(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://agent7even-v2.vercel.app',
    'X-Title': 'Agent7even',
  }
}

type ImageGenResponse = {
  choices?: Array<{
    message?: {
      images?: Array<{ image_url?: { url?: string }; imageUrl?: { url?: string } }>
    }
  }>
}

export type ImageAspectRatio = '1:1' | '4:5' | '9:16' | '16:9' | '3:2' | '2:3' | '3:4' | '4:3' | '5:4' | '21:9'

type ImageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

async function requestImageGeneration(
  model: string,
  content: ImageContentPart[] | string,
  aspectRatio: ImageAspectRatio = '4:5',
  modalitiesOverride?: string[],
): Promise<Buffer> {
  const modalities = modalitiesOverride ?? (model.startsWith('recraft/') || model.includes('flux')
    ? ['image']
    : ['image', 'text'])

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content }],
    modalities,
    stream: false,
    image_config: {
      aspect_ratio: aspectRatio,
      image_size: '1K',
    },
  }

  if (model.includes('recraft')) {
    body.image_config = {
      aspect_ratio: aspectRatio,
      rgb_colors: [[59, 130, 246], [255, 255, 255]],
      background_rgb_color: [255, 255, 255],
    }
  }

  const res = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`OpenRouter image ${res.status}: ${text.slice(0, 400)}`)
  }

  const data = JSON.parse(text) as ImageGenResponse
  const images = data.choices?.[0]?.message?.images ?? []
  const url = images[0]?.image_url?.url ?? images[0]?.imageUrl?.url
  if (!url) throw new Error(`No image in OpenRouter response for ${model}`)

  if (url.startsWith('data:')) {
    const b64 = url.split(',')[1]
    if (!b64) throw new Error('Invalid data URL from image model')
    return Buffer.from(b64, 'base64')
  }

  const imgRes = await fetch(url)
  if (!imgRes.ok) throw new Error(`Failed to download generated image: ${imgRes.status}`)
  return Buffer.from(await imgRes.arrayBuffer())
}

/** Generate one still image from a text brief (ported from spikes/foundation-creative-ab). */
export async function generateImageFromBrief(
  model: string,
  prompt: string,
  aspectRatio: ImageAspectRatio = '4:5',
): Promise<Buffer> {
  return requestImageGeneration(model, prompt, aspectRatio)
}

export function isGoogleImageModel(model: string): boolean {
  return model.startsWith('google/') && model.includes('image')
}

/** Edit an existing still using the source image + instruction (Gemini image models). */
export async function generateImageEditFromSource(opts: {
  model: string
  sourceBytes: Buffer
  sourceMime: string
  brief: string
  editInstruction: string
  editMode?: ImageEditMode
  spellingRetry?: boolean
}): Promise<Buffer> {
  const { bytes: payloadBytes, mime: payloadMime } = await compressImageForApiPayload(opts.sourceBytes)
  const dataUrl = `data:${payloadMime};base64,${payloadBytes.toString('base64')}`
  const mode = opts.editMode ?? detectImageEditMode(opts.editInstruction)
  const instruction = buildImageEditPrompt({
    editInstruction: opts.editInstruction,
    brief: opts.brief,
    mode,
    spellingRetry: opts.spellingRetry,
  })

  return requestImageGeneration(opts.model, [
    { type: 'image_url', image_url: { url: dataUrl } },
    { type: 'text', text: instruction },
  ])
}

/** Providers clamp to their own ratio sets; OpenAI image models reject 4:5 (accept 3:4, 2:3, …). */
function imagesAspect(model: string, aspectRatio: ImageAspectRatio): string {
  if (model.startsWith('openai/')) {
    const map: Partial<Record<ImageAspectRatio, string>> = { '4:5': '3:4', '5:4': '4:3', '9:16': '2:3', '21:9': '16:9' }
    return map[aspectRatio] ?? aspectRatio
  }
  return aspectRatio
}

/** OpenRouter's dedicated Image API — required by GPT Image, FLUX 3, Seedream and others. */
export async function requestImagesEndpoint(
  model: string,
  prompt: string,
  aspectRatio: ImageAspectRatio = '4:5',
  referenceUrls: string[] = [],
  resolution: '1K' | '2K' = '1K',
): Promise<{ bytes: Buffer; costUsd: number | null }> {
  const body: Record<string, unknown> = { model, prompt, n: 1, aspect_ratio: imagesAspect(model, aspectRatio), resolution }
  if (referenceUrls.length > 0) {
    body.input_references = referenceUrls.map(url => ({ type: 'image_url', image_url: { url } }))
  }
  const res = await fetch(`${OPENROUTER_API_BASE}/images`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`OpenRouter images ${res.status}: ${text.slice(0, 400)}`)
  const data = JSON.parse(text) as { data?: Array<{ b64_json?: string }>; usage?: { cost?: number } }
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error(`No image in OpenRouter images response for ${model}`)
  return { bytes: Buffer.from(b64, 'base64'), costUsd: typeof data.usage?.cost === 'number' ? data.usage.cost : null }
}

/**
 * Model comparison helper (internal bake-off). Gemini answers on chat/completions; newer image
 * models only on /images. Tries the likely route first, then the other. Reference images (a real
 * logo, product photos) go in as image parts / input_references so nothing is invented.
 */
export async function generateImageForComparison(
  model: string,
  prompt: string,
  aspectRatio: ImageAspectRatio = '4:5',
  referenceUrls: string[] = [],
): Promise<{ bytes: Buffer; costUsd: number | null; route: 'chat' | 'images' }> {
  const chatFirst = model.startsWith('google/')
  const content: ImageContentPart[] | string = referenceUrls.length > 0
    ? [...referenceUrls.map(url => ({ type: 'image_url' as const, image_url: { url } })), { type: 'text' as const, text: prompt }]
    : prompt
  const viaChat = async () => ({ bytes: await requestImageGeneration(model, content, aspectRatio), costUsd: null, route: 'chat' as const })
  const viaImages = async () => ({ ...(await requestImagesEndpoint(model, prompt, aspectRatio, referenceUrls)), route: 'images' as const })
  try {
    return chatFirst ? await viaChat() : await viaImages()
  } catch (first) {
    try {
      return chatFirst ? await viaImages() : await viaChat()
    } catch {
      throw first
    }
  }
}
