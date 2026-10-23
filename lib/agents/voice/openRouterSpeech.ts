import { openRouterHeaders } from '@/lib/agents/imageGeneration/openRouterImage'

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'

/**
 * OpenRouter text-to-speech (POST /api/v1/audio/speech). Models include ElevenLabs v3/v4, Fish Audio
 * Drama 3, Mistral Voxtral, Microsoft MAI-Voice, Gemini TTS, HeyGen Voice. `inputReferences` carries
 * reference audio for stateless voice cloning where the model supports it (shape passed through as-is).
 */
export async function openRouterSpeech(opts: {
  model: string
  input: string
  voice?: string
  instructions?: string
  inputReferences?: Record<string, unknown>[]
  provider?: Record<string, unknown>
}): Promise<Buffer> {
  const body: Record<string, unknown> = { model: opts.model, input: opts.input, response_format: 'mp3' }
  if (opts.voice) body.voice = opts.voice
  if (opts.instructions) body.instructions = opts.instructions
  if (opts.inputReferences?.length) body.input_references = opts.inputReferences
  if (opts.provider) body.provider = opts.provider
  const res = await fetch(`${OPENROUTER_API_BASE}/audio/speech`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`OpenRouter speech ${res.status}: ${(await res.text()).slice(0, 1200)}`)
  return Buffer.from(await res.arrayBuffer())
}
