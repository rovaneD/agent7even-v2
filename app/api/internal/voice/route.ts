import { NextResponse } from 'next/server'
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

export const maxDuration = 120

const INTERNAL_EMAILS = new Set(['rovane@dursodesign.com', 'melissa@agent7even.com', 'rovdurs@gmail.com'])

/**
 * Internal ElevenLabs bench (internal emails only). Body { action, ... }:
 *  - check:  key works? returns usable speech models and the one we'd pick
 *  - design: { description, text? } → 3 voice previews stored as mp3 with signed URLs
 *  - save:   { name, description, generatedVoiceId } → voice_id
 *  - tts:    { voiceId, text, modelId? } → mp3 stored, signed URL (feeds Avatar IV audio_url)
 */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx?.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const profileId = workspaceDataUserId(ctx.session)
  if (!elevenLabsConfigured()) return NextResponse.json({ error: 'elevenlabs_not_configured' }, { status: 503 })

  const body = (await req.json().catch(() => ({}))) as Record<string, string | undefined>

  async function store(bytes: Buffer, label: string) {
    const path = `${profileId}/voice-${Date.now()}-${label.replace(/[^a-z0-9-]/gi, '').slice(0, 40)}.mp3`
    const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(path, bytes, { contentType: 'audio/mpeg', upsert: true })
    if (error) throw new Error(`storage: ${error.message}`)
    return { path, url: await createPostAssetSignedUrl(path, 60 * 60 * 24) }
  }

  try {
    switch (body.action) {
      case 'check': {
        const models = await listModels()
        return NextResponse.json({ ok: true, picked: await pickSpeechModel(), models: models.map(m => m.model_id) })
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
      default:
        return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: 'elevenlabs_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
