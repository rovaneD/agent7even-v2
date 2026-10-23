import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getWorkspaceAuthContext, workspaceDataUserId } from '@/lib/profiles/workspaceSession'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { castCreatorById } from '@/lib/agents/contentPosting/creators'
import { buildCreatorVoiceTrack } from '@/lib/agents/videoGeneration/presenterVoice'
import { submitVideoJob } from '@/lib/agents/videoGeneration/openRouterVideo'

export const maxDuration = 180

const INTERNAL_EMAILS = new Set(['rovane@dursodesign.com', 'melissa@agent7even.com', 'rovdurs@gmail.com'])
const PRESENTER_MODEL = 'heygen/avatar-iv'

/**
 * Internal: the presenter pipeline as a user's "Approve & create" will run it (steps 2–3):
 * script lines → creator's voice line by line (exact line times) → HeyGen Avatar IV lip-sync job.
 * Poll with GET /api/internal/video-bakeoff?ids=<jobId>, then edit with /api/internal/video-assemble
 * passing these lineTimes. Body: { creatorId, lines[] }.
 */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx?.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const profileId = workspaceDataUserId(ctx.session)

  const body = (await req.json().catch(() => ({}))) as { creatorId?: string; lines?: string[] }
  const creator = castCreatorById(body.creatorId)
  const lines = (body.lines ?? []).map(l => String(l).trim()).filter(Boolean)
  if (!creator) return NextResponse.json({ error: 'unknown_creator' }, { status: 400 })
  if (!lines.length || lines.length > 12) return NextResponse.json({ error: 'lines_required' }, { status: 400 })

  const started = Date.now()
  try {
    const track = await buildCreatorVoiceTrack({ voiceSamplePath: creator.voiceSamplePath, lines })
    const audioPath = `${profileId}/presenter-voice-${creator.id}-${Date.now()}.mp3`
    const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(audioPath, track.audio, { contentType: 'audio/mpeg', upsert: true })
    if (error) throw new Error(`storage: ${error.message}`)
    const [audioUrl, photoUrl] = await Promise.all([
      createPostAssetSignedUrl(audioPath, 60 * 60 * 6),
      createPostAssetSignedUrl(creator.photoPath, 60 * 60 * 6),
    ])
    if (!audioUrl || !photoUrl) throw new Error('could not sign the voice or photo')

    const job = await submitVideoJob({
      model: PRESENTER_MODEL,
      prompt: lines.join(' '),
      aspectRatio: '9:16',
      duration: 0,
      resolution: '1080p',
      referenceUrls: [photoUrl],
      extraReferences: [{ type: 'audio_url', audio_url: { url: audioUrl } }],
    })
    return NextResponse.json({
      jobId: job.id,
      creator: creator.id,
      lineTimes: track.lineTimes,
      durationSec: track.durationSec,
      audioPath,
      audioUrl,
      ms: Date.now() - started,
    })
  } catch (err) {
    return NextResponse.json({ error: 'presenter_render_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
