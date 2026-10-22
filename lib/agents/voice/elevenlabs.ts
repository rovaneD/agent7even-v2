/**
 * ElevenLabs: designed voices for creators and speech for presenter takes. The speech track is then
 * lip-synced by HeyGen Avatar IV (audio_url reference, proven 2026-10-21).
 * The SDK convention is the ELEVENLABS_API_KEY env var; the key never appears in code or logs.
 */

const EL_BASE = 'https://api.elevenlabs.io'

export function elevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY)
}

async function el(path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('elevenlabs_not_configured')
  return fetch(`${EL_BASE}${path}`, {
    ...init,
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

async function elJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await el(path, init)
  const text = await res.text()
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${text.slice(0, 600)}`)
  return JSON.parse(text) as T
}

export type ElevenModel = { model_id: string; name: string; can_do_text_to_speech?: boolean }

/** Models this key can use (ids change as ElevenLabs ships new versions). */
export async function listModels(): Promise<ElevenModel[]> {
  return elJson<ElevenModel[]>('/v1/models')
}

/** Speech model for creator lines: env override, else the newest expressive model the key offers. */
export async function pickSpeechModel(): Promise<string> {
  if (process.env.ELEVENLABS_TTS_MODEL) return process.env.ELEVENLABS_TTS_MODEL
  let ids: string[]
  try {
    ids = (await listModels()).filter(m => m.can_do_text_to_speech !== false).map(m => m.model_id)
  } catch {
    // Restricted keys may lack models_read; v3 is the expressive model Voice Design previews use.
    return 'eleven_v3'
  }
  for (const pref of ['eleven_v4', 'eleven_v3', 'eleven_multilingual_v2']) {
    if (ids.includes(pref)) return pref
  }
  return ids[0] ?? 'eleven_multilingual_v2'
}

export type VoicePreview = { generated_voice_id: string; audio_base_64: string; media_type?: string; duration_secs?: number }

/** Voice Design: 3 previews of a new voice from a description (POST /v1/text-to-voice/design). */
export async function designVoice(opts: { description: string; text?: string; modelId?: string; seed?: number }): Promise<{ previews: VoicePreview[]; text: string }> {
  const body: Record<string, unknown> = {
    voice_description: opts.description,
    model_id: opts.modelId ?? 'eleven_ttv_v3',
  }
  if (opts.text && opts.text.length >= 100) body.text = opts.text
  else body.auto_generate_text = true
  if (opts.seed !== undefined) body.seed = opts.seed
  return elJson('/v1/text-to-voice/design?output_format=mp3_44100_128', { method: 'POST', body: JSON.stringify(body) })
}

/** Save a designed preview as a permanent voice in the account (POST /v1/text-to-voice). */
export async function saveDesignedVoice(opts: { name: string; description: string; generatedVoiceId: string }): Promise<{ voice_id: string }> {
  return elJson('/v1/text-to-voice', {
    method: 'POST',
    body: JSON.stringify({ voice_name: opts.name, voice_description: opts.description, generated_voice_id: opts.generatedVoiceId }),
  })
}

/** Speak a line in a voice. Returns MP3 bytes (44.1 kHz, 128 kbps). */
export async function textToSpeech(opts: { voiceId: string; text: string; modelId?: string }): Promise<Buffer> {
  const model = opts.modelId ?? (await pickSpeechModel())
  const res = await el(`/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: opts.text, model_id: model }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 600)}`)
  return Buffer.from(await res.arrayBuffer())
}
