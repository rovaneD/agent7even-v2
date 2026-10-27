import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { hasPlatformAccess } from '@/lib/plans'
import { deductCredits } from '@/lib/credits'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { castCreatorById } from '@/lib/agents/contentPosting/creators'
import { videoTypeById } from '@/lib/agents/contentPosting/videoTypes'
import { buildCreatorVoiceTrack } from '@/lib/agents/videoGeneration/presenterVoice'
import { submitVideoJob } from '@/lib/agents/videoGeneration/openRouterVideo'
import { failVideoTask } from '@/lib/agents/videoGeneration/failVideoTask'
import {
  advancePresenterTask,
  PRESENTER_AGENT,
  PRESENTER_MODEL,
  presenterVideoUrl,
  type PresenterTaskInput,
} from '@/lib/agents/videoGeneration/presenterJob'

export const maxDuration = 300

const PRESENTER_TYPES = new Set(['presenter_tip', 'product_showcase'])
const MAX_WORDS_PER_SECOND = 3.5

/**
 * "Approve & create" for presenter videos. POST charges once (refunded automatically if anything
 * fails), speaks the approved lines in the creator's voice and starts the lip-sync. GET moves a task
 * forward and reports its status; when the lip-sync is done it runs the edit and puts the video in
 * Approvals.
 */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId, profile } = ws
  if (!hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt ?? false)) {
    return NextResponse.json({ error: 'active_plan_required', message: 'Video needs an active plan.' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    typeId?: string
    creatorId?: string
    lines?: string[]
    length?: number
    captions?: 'off' | 'serif' | 'sans'
    endCardText?: string
    formatId?: string
    title?: string
    caption?: string
  }
  const type = videoTypeById(body.typeId)
  if (!type || !PRESENTER_TYPES.has(type.id)) {
    return NextResponse.json({ error: 'type_not_available', message: 'This video type is not available yet.' }, { status: 400 })
  }
  const creator = castCreatorById(body.creatorId)
  if (!creator) return NextResponse.json({ error: 'creator_required', message: 'Choose a creator first.' }, { status: 422 })
  const lines = (body.lines ?? []).map(l => String(l).trim()).filter(Boolean)
  if (lines.length < 2 || lines.length > 8) {
    return NextResponse.json({ error: 'lines_required', message: 'Make a plan first.' }, { status: 422 })
  }
  const length = body.length === 30 ? 30 : 15
  const words = lines.join(' ').split(/\s+/).length
  if (words > length * MAX_WORDS_PER_SECOND) {
    return NextResponse.json(
      { error: 'script_too_long', message: `The script is ${words} words — too long for ${length}s. Shorten a line or choose ${length === 15 ? '30s' : 'fewer lines'}.` },
      { status: 422 },
    )
  }

  const actionType = length === 30 ? 'video_presenter_30' : 'video_presenter_15'
  const cost = ACTION_CREDIT_COST[actionType]
  const { data: bal } = await supabase.from('credit_balances').select('balance').eq('user_id', workspaceId).maybeSingle()
  if (Number(bal?.balance ?? 0) < cost) {
    return NextResponse.json(
      { error: 'insufficient_credits', message: `This video uses ${cost} credits and your balance is ${Number(bal?.balance ?? 0)}. Credits refresh with your plan each month.` },
      { status: 402 },
    )
  }

  const input: PresenterTaskInput = {
    profileId: workspaceId,
    typeId: type.id,
    creatorId: creator.id,
    lines,
    captions: body.captions === 'off' || body.captions === 'sans' ? body.captions : 'serif',
    endCardText: (body.endCardText ?? '').trim().slice(0, 80),
    formatId: body.formatId ?? null,
    title: (body.title ?? '').trim().slice(0, 80) || type.name,
    caption: (body.caption ?? '').trim().slice(0, 2200),
    stage: 'voice',
  }
  const { data: task, error: taskErr } = await supabase
    .from('agent_tasks')
    .insert({
      user_id: workspaceId,
      agent: PRESENTER_AGENT,
      job_type: 'video_presenter',
      action_type: actionType,
      model: PRESENTER_MODEL,
      input,
      status: 'running',
      started_at: new Date().toISOString(),
      trigger_type: 'user',
      priority: 'normal',
      requires_approval: true,
    })
    .select('id')
    .single()
  if (taskErr || !task) {
    console.error('[video-create] task insert', taskErr?.message)
    return NextResponse.json({ error: 'task_create_failed', message: 'Could not start the video. Nothing was charged.' }, { status: 500 })
  }
  const taskId = task.id as string

  try {
    await deductCredits(workspaceId, cost, `Video — ${type.name} (${length}s)`, taskId)
  } catch (err) {
    await supabase.from('agent_tasks').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', taskId)
    const insufficient = err instanceof Error && err.message === 'INSUFFICIENT_CREDITS'
    return NextResponse.json(
      { error: insufficient ? 'insufficient_credits' : 'charge_failed', message: insufficient ? `This video uses ${cost} credits.` : 'Could not start the video. Nothing was charged.' },
      { status: insufficient ? 402 : 500 },
    )
  }

  try {
    const track = await buildCreatorVoiceTrack({ voiceSamplePath: creator.voiceSamplePath, lines })
    const audioPath = `${workspaceId}/presenter-voice-${taskId}.mp3`
    const { error: upErr } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(audioPath, track.audio, { contentType: 'audio/mpeg', upsert: true })
    if (upErr) throw new Error(`storage: ${upErr.message}`)
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
    await supabase
      .from('agent_tasks')
      .update({ input: { ...input, stage: 'rendering', presenter_job_id: job.id, lineTimes: track.lineTimes, durationSec: track.durationSec, audioPath } })
      .eq('id', taskId)
    return NextResponse.json({ taskId, status: 'rendering', credits: cost })
  } catch (err) {
    console.error('[video-create] start failed', taskId, err instanceof Error ? err.message : err)
    await failVideoTask(supabase, taskId, workspaceId)
    return NextResponse.json({ error: 'start_failed', message: 'The video could not be started. Your credits were refunded.' }, { status: 502 })
  }
}

/** ?taskId= → status of one video (moves it forward). ?pending=1 → finish any of this workspace's videos still in progress. */
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
      .eq('agent', PRESENTER_AGENT)
      .eq('status', 'running')
      .limit(5)
    const results = []
    for (const t of tasks ?? []) results.push({ taskId: t.id, ...(await advancePresenterTask(supabase, t as never)) })
    return NextResponse.json({ results })
  }

  const taskId = params.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'taskId_required' }, { status: 400 })
  const { data: task } = await supabase
    .from('agent_tasks')
    .select('id,user_id,status,input,action_type')
    .eq('id', taskId)
    .eq('user_id', ws.workspaceId)
    .eq('agent', PRESENTER_AGENT)
    .maybeSingle()
  if (!task) return NextResponse.json({ status: 'unknown' }, { status: 404 })
  const r = await advancePresenterTask(supabase, task as never)
  return NextResponse.json({ ...r, videoUrl: r.status === 'completed' ? await presenterVideoUrl(supabase, taskId) : null })
}
