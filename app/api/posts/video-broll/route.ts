import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { hasPlatformAccess } from '@/lib/plans'
import { deductCredits } from '@/lib/credits'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { castCreatorById } from '@/lib/agents/contentPosting/creators'
import { resolveVideoFormat } from '@/lib/agents/contentPosting/platformFormats'
import { buildCreatorVoiceTrack } from '@/lib/agents/videoGeneration/presenterVoice'
import { submitVideoJob } from '@/lib/agents/videoGeneration/openRouterVideo'
import { failVideoTask } from '@/lib/agents/videoGeneration/failVideoTask'
import { presenterVideoUrl } from '@/lib/agents/videoGeneration/presenterJob'
import {
  advanceBrollTask,
  BROLL_AGENT,
  BROLL_MODEL,
  BROLL_REDOS,
  brollMotionPrompt,
  brollStillPrompt,
  LIPSYNC_MODEL,
  makeStill,
  onCameraLineIndexes,
  onCameraStillPrompt,
  signedStills,
  type BrollTaskInput,
} from '@/lib/agents/videoGeneration/brollJob'

export const maxDuration = 300

const TYPE_ID = 'cinematic_broll'
const MAX_WORDS_PER_SECOND = 3.2

type Body = {
  action?: 'stills' | 'redo' | 'create'
  taskId?: string
  // stills
  creatorId?: string
  length?: number
  lines?: string[]
  onCameraMoments?: number
  onCameraSetting?: string
  scenes?: string[]
  outfit?: string
  captions?: 'off' | 'serif' | 'sans'
  captionPos?: 'center' | 'lower'
  cta?: string
  logo?: boolean
  formatId?: string
  title?: string
  caption?: string
  // redo
  which?: 'onCamera' | number
  scene?: string
}

const clean = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max)

/**
 * Cinematic B-roll video, in two paid steps so nobody pays to animate a setting they did not want:
 *  - action 'stills' (5 credits): on-camera still + B-roll stills to review
 *  - action 'redo' (free, up to 3 per video): remake one still, optionally with an edited scene
 *  - action 'create' (40 / 75 credits): voice, lip-sync and B-roll animation; GET finishes the edit
 * Any failure refunds everything the task was charged.
 */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId, profile } = ws
  if (!hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt ?? false)) {
    return NextResponse.json({ error: 'active_plan_required', message: 'Video needs an active plan.' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as Body

  if (body.action === 'redo' || body.action === 'create') {
    const { data: task } = await supabase
      .from('agent_tasks')
      .select('id,user_id,status,input,action_type')
      .eq('id', body.taskId ?? '')
      .eq('user_id', workspaceId)
      .eq('agent', BROLL_AGENT)
      .maybeSingle()
    if (!task || task.status !== 'running') return NextResponse.json({ error: 'not_found', message: 'This video is no longer open. Make the stills again.' }, { status: 404 })
    const input = task.input as BrollTaskInput
    if (input.stage !== 'review') return NextResponse.json({ error: 'wrong_stage', message: 'This video is already being made.' }, { status: 409 })
    const creator = castCreatorById(input.creatorId)
    if (!creator) return NextResponse.json({ error: 'creator_required' }, { status: 422 })

    if (body.action === 'redo') {
      if (input.redosLeft <= 0) return NextResponse.json({ error: 'no_redos', message: 'No redos left for this video.' }, { status: 429 })
      const photoUrl = await createPostAssetSignedUrl(creator.photoPath, 60 * 60)
      if (!photoUrl) return NextResponse.json({ error: 'sign_failed' }, { status: 500 })
      try {
        const next = { ...input, stills: { onCamera: input.stills.onCamera, broll: [...input.stills.broll] }, scenes: [...input.scenes] }
        if (body.which === 'onCamera') {
          if (body.scene) next.onCameraSetting = clean(body.scene, 300)
          next.stills.onCamera = await makeStill(supabase, workspaceId, onCameraStillPrompt(next.onCameraSetting, next.outfit), [photoUrl])
        } else {
          const i = Number(body.which)
          if (!Number.isInteger(i) || i < 0 || i >= next.scenes.length) return NextResponse.json({ error: 'bad_index' }, { status: 400 })
          if (body.scene) next.scenes[i] = clean(body.scene, 300)
          const camUrl = await createPostAssetSignedUrl(next.stills.onCamera, 60 * 60)
          next.stills.broll[i] = await makeStill(supabase, workspaceId, brollStillPrompt(next.scenes[i]!, next.outfit), [photoUrl, camUrl!])
        }
        next.redosLeft = input.redosLeft - 1
        await supabase.from('agent_tasks').update({ input: next }).eq('id', task.id)
        return NextResponse.json({ taskId: task.id, stills: await signedStills(next.stills), scenes: next.scenes, onCameraSetting: next.onCameraSetting, redosLeft: next.redosLeft })
      } catch (err) {
        console.error('[video-broll] redo failed', err instanceof Error ? err.message : err)
        return NextResponse.json({ error: 'redo_failed', message: 'That still could not be remade. Try again.' }, { status: 502 })
      }
    }

    // create — claim review → voice before charging so a double-click cannot debit this task twice.
    const { data: fresh } = await supabase
      .from('agent_tasks')
      .select('input')
      .eq('id', task.id)
      .eq('user_id', workspaceId)
      .eq('status', 'running')
      .eq('input->>stage', 'review')
      .maybeSingle()
    if (!fresh) return NextResponse.json({ error: 'wrong_stage', message: 'This video is already being made.' }, { status: 409 })
    const freshInput = fresh.input as BrollTaskInput
    const lines = (body.lines?.length ? body.lines : freshInput.lines).map(l => clean(l, 400)).filter(Boolean)
    if (lines.length !== freshInput.lines.length) return NextResponse.json({ error: 'lines_changed', message: 'Keep the same number of lines as the plan.' }, { status: 422 })
    const words = lines.join(' ').split(/\s+/).length
    if (words > freshInput.length * MAX_WORDS_PER_SECOND) {
      return NextResponse.json({ error: 'script_too_long', message: `The script is ${words} words, too long for ${freshInput.length}s. Shorten a line.` }, { status: 422 })
    }
    const actionType = freshInput.length >= 30 ? 'video_broll_30' : 'video_broll_15'
    const cost = ACTION_CREDIT_COST[actionType]
    const caption = body.caption !== undefined ? clean(body.caption, 2200) : freshInput.caption
    const voiceStartedAt = new Date().toISOString()
    const claimedInput: BrollTaskInput = { ...freshInput, lines, caption, stage: 'voice', voiceStartedAt }
    const { data: won } = await supabase
      .from('agent_tasks')
      .update({ action_type: actionType, input: claimedInput })
      .eq('id', task.id)
      .eq('user_id', workspaceId)
      .eq('status', 'running')
      .eq('input->>stage', 'review')
      .select('id')
    if (!won?.length) return NextResponse.json({ error: 'wrong_stage', message: 'This video is already being made.' }, { status: 409 })
    try {
      await deductCredits(workspaceId, cost, `Video — Cinematic B-roll (${freshInput.length}s)`, task.id)
    } catch (err) {
      await supabase
        .from('agent_tasks')
        .update({ action_type: 'video_broll_stills', input: freshInput })
        .eq('id', task.id)
        .eq('input->>stage', 'voice')
        .eq('input->>voiceStartedAt', voiceStartedAt)
      const insufficient = err instanceof Error && err.message === 'INSUFFICIENT_CREDITS'
      return NextResponse.json(
        { error: insufficient ? 'insufficient_credits' : 'charge_failed', message: insufficient ? `Making the video uses ${cost} credits.` : 'Could not start the video. Nothing was charged.' },
        { status: insufficient ? 402 : 500 },
      )
    }
    try {
      const track = await buildCreatorVoiceTrack({ voiceSamplePath: creator.voiceSamplePath, lines })
      const audioPath = `${workspaceId}/broll-voice-${task.id}.mp3`
      const { error: upErr } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(audioPath, track.audio, { contentType: 'audio/mpeg', upsert: true })
      if (upErr) throw new Error(`storage: ${upErr.message}`)
      const [audioUrl, camUrl, ...brollUrls] = await Promise.all(
        [audioPath, claimedInput.stills.onCamera, ...claimedInput.stills.broll].map(p => createPostAssetSignedUrl(p, 60 * 60 * 6)),
      )
      if (!audioUrl || !camUrl || brollUrls.some(u => !u)) throw new Error('could not sign the voice or stills')
      const [lipsync, ...brollJobs] = await Promise.all([
        submitVideoJob({
          model: LIPSYNC_MODEL,
          prompt: lines.join(' '),
          aspectRatio: '9:16',
          duration: 0,
          resolution: '1080p',
          referenceUrls: [camUrl],
          extraReferences: [{ type: 'audio_url', audio_url: { url: audioUrl } }],
        }),
        ...claimedInput.scenes.map((scene, i) =>
          submitVideoJob({ model: BROLL_MODEL, prompt: brollMotionPrompt(scene), aspectRatio: '9:16', duration: 5, resolution: '1080p', referenceUrls: [brollUrls[i]!], generateAudio: false }),
        ),
      ])
      const { data: saved } = await supabase
        .from('agent_tasks')
        .update({
          input: { ...claimedInput, stage: 'rendering', lipsync_job_id: lipsync.id, broll_job_ids: brollJobs.map(b => b.id), lineTimes: track.lineTimes, durationSec: track.durationSec },
        })
        .eq('id', task.id)
        .eq('input->>voiceStartedAt', voiceStartedAt)
        .select('id')
      if (!saved?.length) throw new Error('task moved on before the jobs were saved')
      return NextResponse.json({ taskId: task.id, status: 'rendering', credits: cost })
    } catch (err) {
      console.error('[video-broll] create failed', task.id, err instanceof Error ? err.message : err)
      await failVideoTask(supabase, task.id, workspaceId)
      return NextResponse.json({ error: 'start_failed', message: 'The video could not be started. Your credits were refunded.' }, { status: 502 })
    }
  }

  // action: 'stills'
  const creator = castCreatorById(body.creatorId)
  if (!creator) return NextResponse.json({ error: 'creator_required', message: 'Choose one of our creators first.' }, { status: 422 })
  const length = body.length === 30 ? 30 : 15
  const lines = (body.lines ?? []).map(l => clean(l, 400)).filter(Boolean)
  if (lines.length < 3 || lines.length > 8) return NextResponse.json({ error: 'lines_required', message: 'Make a plan first.' }, { status: 422 })
  const scenes = (body.scenes ?? []).map(s => clean(s, 300)).filter(Boolean)
  const wantScenes = length === 30 ? 4 : 2
  if (scenes.length !== wantScenes) return NextResponse.json({ error: 'scenes_required', message: 'Make the plan again.' }, { status: 422 })
  const moments = length === 30 && body.onCameraMoments === 2 ? 2 : length === 30 ? 3 : 2

  const cost = ACTION_CREDIT_COST.video_broll_stills
  const total = cost + ACTION_CREDIT_COST[length === 30 ? 'video_broll_30' : 'video_broll_15']
  const { data: bal } = await supabase.from('credit_balances').select('balance').eq('user_id', workspaceId).maybeSingle()
  if (Number(bal?.balance ?? 0) < total) {
    return NextResponse.json(
      { error: 'insufficient_credits', message: `This video uses ${total} credits in total and your balance is ${Number(bal?.balance ?? 0)}.` },
      { status: 402 },
    )
  }

  const input: BrollTaskInput = {
    profileId: workspaceId,
    typeId: TYPE_ID,
    creatorId: creator.id,
    length,
    lines,
    onCamLines: onCameraLineIndexes(lines.length, moments),
    onCameraSetting: clean(body.onCameraSetting, 300),
    scenes,
    outfit: clean(body.outfit, 200),
    captions: body.captions === 'off' || body.captions === 'serif' ? body.captions : 'sans',
    captionPos: body.captionPos === 'lower' ? 'lower' : 'center',
    cta: clean(body.cta, 70),
    logo: body.logo === true,
    formatId: body.formatId ?? null,
    platform: resolveVideoFormat(body.formatId).platform,
    title: clean(body.title, 80) || 'Cinematic B-roll',
    caption: clean(body.caption, 2200),
    stills: { onCamera: '', broll: [] },
    redosLeft: BROLL_REDOS,
    stage: 'stills',
  }
  const { data: task, error: taskErr } = await supabase
    .from('agent_tasks')
    .insert({
      user_id: workspaceId,
      agent: BROLL_AGENT,
      job_type: 'video_broll',
      action_type: 'video_broll_stills',
      model: BROLL_MODEL,
      input,
      status: 'running',
      started_at: new Date().toISOString(),
      trigger_type: 'user',
      priority: 'normal',
      requires_approval: true,
    })
    .select('id')
    .single()
  if (taskErr || !task) return NextResponse.json({ error: 'task_create_failed', message: 'Could not start. Nothing was charged.' }, { status: 500 })
  const taskId = task.id as string
  try {
    await deductCredits(workspaceId, cost, 'Video — Cinematic B-roll stills', taskId)
  } catch (err) {
    await supabase.from('agent_tasks').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', taskId)
    const insufficient = err instanceof Error && err.message === 'INSUFFICIENT_CREDITS'
    return NextResponse.json({ error: insufficient ? 'insufficient_credits' : 'charge_failed', message: 'Could not start. Nothing was charged.' }, { status: insufficient ? 402 : 500 })
  }
  try {
    const photoUrl = await createPostAssetSignedUrl(creator.photoPath, 60 * 60)
    if (!photoUrl) throw new Error('could not sign the creator photo')
    const onCamera = await makeStill(supabase, workspaceId, onCameraStillPrompt(input.onCameraSetting, input.outfit), [photoUrl])
    const camUrl = await createPostAssetSignedUrl(onCamera, 60 * 60)
    const broll = await Promise.all(scenes.map(s => makeStill(supabase, workspaceId, brollStillPrompt(s, input.outfit), [photoUrl, camUrl!])))
    const next = { ...input, stills: { onCamera, broll }, stage: 'review' as const }
    await supabase.from('agent_tasks').update({ input: next }).eq('id', taskId)
    return NextResponse.json({ taskId, stills: await signedStills(next.stills), scenes, onCameraSetting: input.onCameraSetting, redosLeft: BROLL_REDOS, credits: cost })
  } catch (err) {
    console.error('[video-broll] stills failed', taskId, err instanceof Error ? err.message : err)
    await failVideoTask(supabase, taskId, workspaceId)
    return NextResponse.json({ error: 'stills_failed', message: 'The stills could not be made. Your credits were refunded.' }, { status: 502 })
  }
}

/** ?taskId= → status (moves it forward). ?pending=1 → finish this workspace's B-roll videos in progress. */
export async function GET(req: Request) {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = new URL(req.url).searchParams
  if (params.get('pending')) {
    const { data: tasks } = await supabase
      .from('agent_tasks')
      .select('id,user_id,status,input,action_type')
      .eq('user_id', ws.workspaceId)
      .eq('agent', BROLL_AGENT)
      .eq('status', 'running')
      .in('input->>stage', ['voice', 'rendering', 'editing'])
      .limit(5)
    const results = []
    for (const t of tasks ?? []) results.push({ taskId: t.id, ...(await advanceBrollTask(supabase, t as never)) })
    return NextResponse.json({ results })
  }
  const taskId = params.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'taskId_required' }, { status: 400 })
  const { data: task } = await supabase
    .from('agent_tasks')
    .select('id,user_id,status,input,action_type')
    .eq('id', taskId)
    .eq('user_id', ws.workspaceId)
    .eq('agent', BROLL_AGENT)
    .maybeSingle()
  if (!task) return NextResponse.json({ status: 'unknown' }, { status: 404 })
  const r = await advanceBrollTask(supabase, task as never)
  return NextResponse.json({ ...r, videoUrl: r.status === 'completed' ? await presenterVideoUrl(supabase, taskId) : null })
}
