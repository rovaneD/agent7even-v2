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

type ImageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

async function requestImageGeneration(model: string, content: ImageContentPart[] | string): Promise<Buffer> {
  const modalities = model.startsWith('recraft/') || model.includes('flux')
    ? ['image']
    : ['image', 'text']

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content }],
    modalities,
    stream: false,
    image_config: {
      aspect_ratio: '4:5',
      image_size: '1K',
    },
  }

  if (model.includes('recraft')) {
    body.image_config = {
      aspect_ratio: '4:5',
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
export async function generateImageFromBrief(model: string, prompt: string): Promise<Buffer> {
  return requestImageGeneration(model, prompt)
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
}): Promise<Buffer> {
  const { bytes: payloadBytes, mime: payloadMime } = await compressImageForApiPayload(opts.sourceBytes)
  const dataUrl = `data:${payloadMime};base64,${payloadBytes.toString('base64')}`
  const mode = opts.editMode ?? detectImageEditMode(opts.editInstruction)
  const instruction = buildImageEditPrompt({
    editInstruction: opts.editInstruction,
    brief: opts.brief,
    mode,
  })

  return requestImageGeneration(opts.model, [
    { type: 'image_url', image_url: { url: dataUrl } },
    { type: 'text', text: instruction },
  ])
}
