import { randomUUID } from 'node:crypto'
import type { createServiceClient } from '@/lib/supabase/server'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { openRouterHeaders } from '@/lib/agents/imageGeneration/openRouterImage'
import { loadBrandLogoReference } from '@/lib/agents/imageGeneration/postStyles'
import { recordAgentTaskCost } from '@/lib/agents/taskInstrumentation'
import type { ActionCreditKey } from '@/lib/credits/actionCosts'
import { assembleVideo, type TimedText } from './assemble'
import { failVideoTask } from './failVideoTask'
import { pollVideoJob } from './openRouterVideo'

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
  title: string
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
  task: { id: string; user_id: string; status: string; input: unknown; action_type?: string | null },
): Promise<{ status: 'rendering' | 'editing' | 'completed' | 'failed' }> {
  if (task.status === 'completed') return { status: 'completed' }
  if (task.status === 'failed') return { status: 'failed' }
  const input = task.input as PresenterTaskInput
  if (input.stage === 'voice') return { status: 'rendering' }
  if (input.stage === 'editing') {
    // A crashed edit (function timeout) is retried after 6 minutes.
    const since = input.editingSince ? Date.parse(input.editingSince) : 0
    if (Date.now() - since < 6 * 60_000) return { status: 'editing' }
  }
  if (!input.presenter_job_id) {
    await failVideoTask(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }

  const poll = await pollVideoJob(input.presenter_job_id)
  if (poll.status === 'failed') {
    await failVideoTask(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }
  if (poll.status !== 'completed') return { status: 'rendering' }

  // Claim the edit: only the caller whose update matches the previous stage proceeds.
  const claimed = { ...input, stage: 'editing' as const, editingSince: new Date().toISOString() }
  const { data: won } = await supabase
    .from('agent_tasks')
    .update({ input: claimed })
    .eq('id', task.id)
    .eq('status', 'running')
    .eq('input->>stage', input.stage)
    .select('id')
  if (!won?.length) return { status: 'editing' }

  try {
    const src = poll.unsigned_urls?.[0]
    const raw = src ? await fetchBytes(src, openRouterHeaders()) : null
    if (!raw) throw new Error('could not download the lip-sync video')

    const logoUrl = await loadBrandLogoReference(input.profileId)
    const logo = logoUrl ? await fetchBytes(logoUrl) : null
    const out = await assembleVideo({
      video: raw,
      lines: input.lines,
      subtitles: input.captions !== 'off',
      captionStyle: input.captions === 'sans' ? 'sans' : 'serif',
      lineTimes: input.lineTimes ?? null,
      endCard: input.endCardText ? { text: input.endCardText, logo } : null,
    })

    const storagePath = `${input.profileId}/${randomUUID()}.mp4`
    const { error: upErr } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(storagePath, out.video, { contentType: 'video/mp4', upsert: false })
    if (upErr) throw new Error(`storage: ${upErr.message}`)

    await supabase.from('agent_outputs').insert({
      task_id: task.id,
      user_id: task.user_id,
      agent: 'video_generation',
      output_type: 'social_post',
      title: input.title || 'Presenter video',
      content: {
        raw: input.lines.join(' '),
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
    await failVideoTask(supabase, task.id, task.user_id)
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
