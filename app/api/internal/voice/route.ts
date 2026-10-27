import { NextResponse } from 'next/server'
import { castCreatorById } from '@/lib/agents/contentPosting/creators'
import { buildCreatorVoiceTrack } from '@/lib/agents/videoGeneration/presenterVoice'
import { createServiceClient } from '@/lib/supabase/server'
import { getWorkspaceAuthContext, workspaceDataUserId } from '@/lib/profiles/workspaceSession'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import {
  designVoice,
  elevenLabsConfigured,
  listModels,
  pickSpeechModel,
  saveDesignedVoice,
  textToSpeech,
} from '@/lib/agents/voice/elevenlabs'
import { openRouterSpeech } from '@/lib/agents/voice/openRouterSpeech'

export const maxDuration = 120

const INTERNAL_EMAILS = new Set(['rovane@dursodesign.com', 'melissa@agent7even.com', 'rovdurs@gmail.com'])

/**
 * Internal ElevenLabs bench (internal emails only). Body { action, ... }:
 *  - check:  key works? returns usable speech models and the one we'd pick
 *  - design: { description, text? } → 3 voice previews stored as mp3 with signed URLs
 *  - save:   { name, description, generatedVoiceId } → voice_id
 *  - tts:    { voiceId, text, modelId? } → mp3 stored, signed URL (feeds Avatar IV audio_url)
 *  - track:  { creatorId, lines[] } → production creator voice track (no video), for listening tests
 *  - or_tts: { model, text, voice?, instructions?, inputReferences? } → OpenRouter speech, mp3 stored
 */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx?.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const profileId = workspaceDataUserId(ctx.session)
  const body = (await req.json().catch(() => ({}))) as Record<string, string | undefined> & {
    inputReferences?: Record<string, unknown>[]
    provider?: Record<string, unknown>
  }
  if (body.action !== 'or_tts' && body.action !== 'track' && !elevenLabsConfigured()) return NextResponse.json({ error: 'elevenlabs_not_configured' }, { status: 503 })

  async function store(bytes: Buffer, label: string) {
    const path = `${profileId}/voice-${Date.now()}-${label.replace(/[^a-z0-9-]/gi, '').slice(0, 40)}.mp3`
    const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(path, bytes, { contentType: 'audio/mpeg', upsert: true })
    if (error) throw new Error(`storage: ${error.message}`)
    return { path, url: await createPostAssetSignedUrl(path, 60 * 60 * 24) }
  }

  try {
    switch (body.action) {
      case 'check': {
        const models = await listModels().catch(() => null)
        return NextResponse.json({ ok: true, picked: await pickSpeechModel(), models: models ? models.map(m => m.model_id) : 'models_read not allowed for this key' })
      }
      case 'design': {
        if (!body.description) return NextResponse.json({ error: 'description_required' }, { status: 400 })
        const r = await designVoice({ description: body.description, text: body.text })
        const previews = await Promise.all(
          r.previews.map(async (p, i) => ({
            generatedVoiceId: p.generated_voice_id,
            durationSecs: p.duration_secs,
            ...(await store(Buffer.from(p.audio_base_64, 'base64'), `design-${i + 1}`)),
          })),
        )
        return NextResponse.json({ text: r.text, previews })
      }
      case 'save': {
        if (!body.name || !body.description || !body.generatedVoiceId) return NextResponse.json({ error: 'name_description_generatedVoiceId_required' }, { status: 400 })
        return NextResponse.json(await saveDesignedVoice({ name: body.name, description: body.description, generatedVoiceId: body.generatedVoiceId }))
      }
      case 'tts': {
        if (!body.voiceId || !body.text) return NextResponse.json({ error: 'voiceId_and_text_required' }, { status: 400 })
        const model = body.modelId || (await pickSpeechModel())
        const bytes = await textToSpeech({ voiceId: body.voiceId, text: body.text, modelId: model })
        return NextResponse.json({ model, bytes: bytes.length, ...(await store(bytes, 'tts')) })
      }
      case 'or_tts': {
        // OpenRouter speech: { model, text, voice?, instructions?, inputReferences?, provider? }
        if (!body.model || !body.text) return NextResponse.json({ error: 'model_and_text_required' }, { status: 400 })
        const bytes = await openRouterSpeech({
          model: body.model,
          input: body.text,
          voice: body.voice,
          instructions: body.instructions,
          inputReferences: body.inputReferences,
          provider: body.provider,
        })
        return NextResponse.json({ model: body.model, bytes: bytes.length, ...(await store(bytes, `or-${body.model.split('/')[1] ?? 'tts'}`)) })
      }
      case 'track': {
        // The production voice track (line by line, trimmed, sped up, joined) without any video job.
        const creator = castCreatorById(body.creatorId)
        const lines = (body as { lines?: string[] }).lines ?? []
        if (!creator || !lines.length) return NextResponse.json({ error: 'creatorId_and_lines_required' }, { status: 400 })
        const t = await buildCreatorVoiceTrack({ voiceSamplePath: creator.voiceSamplePath, lines })
        return NextResponse.json({ durationSec: t.durationSec, lineTimes: t.lineTimes, ...(await store(t.audio, `track-${creator.id}`)) })
      }
      default:
        return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: 'elevenlabs_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
