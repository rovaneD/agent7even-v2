import { randomUUID } from 'node:crypto'
import type { createServiceClient } from '@/lib/supabase/server'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { openRouterHeaders } from '@/lib/agents/imageGeneration/openRouterImage'
import { recordAgentTaskCost } from '@/lib/agents/taskInstrumentation'
import type { ActionCreditKey } from '@/lib/credits/actionCosts'
import { assembleVideo, type TimedText } from './assemble'
import { claimFailedVideo } from './claimFailedVideo'
import { pollVideoJob } from './openRouterVideo'
import { voiceStartAbandoned } from './videoJobResume'

type Supabase = ReturnType<typeof createServiceClient>

export const PRESENTER_AGENT = 'video_presenter'
export const PRESENTER_MODEL = 'heygen/avatar-iv'
const HEYGEN_USD_PER_SECOND = 0.05

export type PresenterTaskInput = {
  profileId: string
  typeId: string
  creatorId: string
  lines: string[]
  captions: 'off' | 'serif' | 'sans'
  endCardText: string
  formatId: string | null
  /** Platform the owner picked (Instagram, TikTok, …) so approval drafts the right account. */
  platform?: string
  title: string
  /** Social caption for the post (the spoken script is `lines`). */
  caption?: string
  stage: 'voice' | 'rendering' | 'editing' | 'done'
  presenter_job_id?: string
  lineTimes?: TimedText[]
  durationSec?: number
  audioPath?: string
  editingSince?: string
}

async function fetchBytes(url: string, headers?: Record<string, string>): Promise<Buffer | null> {
  try {
    const r = await fetch(url, headers ? { headers } : undefined)
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null
  } catch {
    return null
  }
}

/**
 * Move one presenter task forward: poll the lip-sync job; when it is done, claim the edit step (only
 * one caller wins), add captions + end card with the exact line times, store the final video and put
 * it in Approvals. Failed renders are refunded. Safe to call repeatedly (status polling, page loads).
 */
export async function advancePresenterTask(
  supabase: Supabase,
  task: { id: string; user_id: string; status: string; input: unknown; action_type?: string | null; started_at?: string | null },
): Promise<{ status: 'rendering' | 'editing' | 'completed' | 'failed' }> {
  if (task.status === 'completed') return { status: 'completed' }
  if (task.status === 'failed') return { status: 'failed' }
  const input = task.input as PresenterTaskInput
  if (input.stage === 'voice') {
    // The start route sets stage to voice before it has a provider job. Once that request is
    // dead, keep polling only if it already stored the job — otherwise the charge is stuck.
    if (!input.presenter_job_id && voiceStartAbandoned(task.started_at)) {
      await claimFailedVideo(supabase, task.id, task.user_id)
      return { status: 'failed' }
    }
    return { status: 'rendering' }
  }
  if (input.stage === 'editing') {
    // A crashed edit (function timeout) is retried after 6 minutes.
    const since = input.editingSince ? Date.parse(input.editingSince) : 0
    if (Date.now() - since < 6 * 60_000) return { status: 'editing' }
  }
  if (!input.presenter_job_id) {
    await claimFailedVideo(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }

  const poll = await pollVideoJob(input.presenter_job_id)
  if (poll.status === 'failed') {
    await claimFailedVideo(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }
  if (poll.status !== 'completed') return { status: 'rendering' }

  // Claim the edit: only the caller whose update matches the previous stage proceeds.
  const claimed = { ...input, stage: 'editing' as const, editingSince: new Date().toISOString() }
  // A retry stays on stage 'editing', so the stage filter alone lets two pollers both edit.
  // Match the editingSince each caller observed; the first write changes it and the other loses.
  const claimQuery = supabase
    .from('agent_tasks')
    .update({ input: claimed })
    .eq('id', task.id)
    .eq('status', 'running')
    .eq('input->>stage', input.stage)
  const { data: won } = await (input.stage === 'editing' && input.editingSince
    ? claimQuery.eq('input->>editingSince', input.editingSince)
    : claimQuery
  ).select('id')
  if (!won?.length) return { status: 'editing' }

  try {
    const src = poll.unsigned_urls?.[0]
    const raw = src ? await fetchBytes(src, openRouterHeaders()) : null
    if (!raw) throw new Error('could not download the lip-sync video')

    const out = await assembleVideo({
      video: raw,
      lines: input.lines,
      subtitles: input.captions !== 'off',
      captionStyle: input.captions === 'sans' ? 'sans' : 'serif',
      lineTimes: input.lineTimes ?? null,
      // Owner decision 2026-10-24: presenter videos end on the creator's last line — no logo, no end card.
      endCard: null,
    })

    const storagePath = `${input.profileId}/${randomUUID()}.mp4`
    const { error: upErr } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(storagePath, out.video, { contentType: 'video/mp4', upsert: false })
    if (upErr) throw new Error(`storage: ${upErr.message}`)

    const { data: existingOutput } = await supabase
      .from('agent_outputs')
      .select('id')
      .eq('task_id', task.id)
      .eq('user_id', task.user_id)
      .eq('status', 'pending_approval')
      .limit(1)
    if (!existingOutput?.length) {
      const { error: outputErr } = await supabase.from('agent_outputs').insert({
        task_id: task.id,
        user_id: task.user_id,
        agent: 'video_generation',
        output_type: 'social_post',
        title: input.title || 'Presenter video',
        content: {
          raw: input.caption?.trim() || input.lines.join(' '),
          script: input.lines,
          media_storage_path: storagePath,
          media_mime: 'video/mp4',
          generated: {
            model: PRESENTER_MODEL,
            video_type: input.typeId,
            creator: input.creatorId,
            job_id: input.presenter_job_id,
            captions: input.captions,
            exact_timing: out.exactTiming,
            duration_sec: out.durationSec,
          },
        },
        status: 'pending_approval',
        lifecycle_stage: 'review',
      })
      if (outputErr) throw new Error(`output: ${outputErr.message}`)
    }

    await recordAgentTaskCost(task.id, {
      action_type: (task.action_type as ActionCreditKey) ?? 'video_presenter_15',
      cost_usd: Math.round(((input.durationSec ?? out.durationSec) * HEYGEN_USD_PER_SECOND + 0.02) * 100) / 100,
      add_cost_usd: true,
      model: PRESENTER_MODEL,
    })
    await supabase
      .from('agent_tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString(), input: { ...claimed, stage: 'done' } })
      .eq('id', task.id)
    return { status: 'completed' }
  } catch (err) {
    console.error('[presenter] edit failed', task.id, err instanceof Error ? err.message : err)
    const { data: saved } = await supabase
      .from('agent_outputs')
      .select('id')
      .eq('task_id', task.id)
      .eq('user_id', task.user_id)
      .eq('status', 'pending_approval')
      .limit(1)
    if (saved?.length) {
      await supabase
        .from('agent_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString(), input: { ...claimed, stage: 'done' } })
        .eq('id', task.id)
        .eq('status', 'running')
      return { status: 'completed' }
    }
    await claimFailedVideo(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }
}

export async function presenterVideoUrl(supabase: Supabase, taskId: string): Promise<string | null> {
  const { data } = await supabase
    .from('agent_outputs')
    .select('content')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const path = (data?.content as { media_storage_path?: string } | null)?.media_storage_path
  if (!path) return null
  return createPostAssetSignedUrl(path, 60 * 60)
}
