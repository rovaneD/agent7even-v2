import { randomUUID } from 'node:crypto'
import type { createServiceClient } from '@/lib/supabase/server'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { generateImageForComparison, openRouterHeaders } from '@/lib/agents/imageGeneration/openRouterImage'
import { loadBrandLogoReference } from '@/lib/agents/imageGeneration/postStyles'
import { recordAgentTaskCost } from '@/lib/agents/taskInstrumentation'
import type { ActionCreditKey } from '@/lib/credits/actionCosts'
import { assembleVideo, type TimedText } from './assemble'
import { failVideoTask } from './failVideoTask'
import { pollVideoJob } from './openRouterVideo'

/**
 * Cinematic B-roll video (owner-approved recipe, test 2 2026-10-24; project doc
 * claude/cinematic_broll_format.md):
 *  1. on-camera still of the creator in a cinematic setting (creator's locked photo as reference)
 *  2. B-roll stills in matching light and outfit (locked photo + on-camera still as references)
 *     → the user reviews the stills and can redo a few before anything is animated
 *  3. creator's voice line by line → Avatar IV lip-sync from the on-camera still; Kling animates
 *     each B-roll still (no audio)
 *  4. edit: B-roll covers the off-camera lines in ~2.5s shots, captions, optional CTA and logo.
 */

type Supabase = ReturnType<typeof createServiceClient>

export const BROLL_AGENT = 'video_broll'
export const STILL_MODEL = 'google/gemini-3-pro-image'
export const BROLL_MODEL = 'kwaivgi/kling-v3.0-pro'
export const LIPSYNC_MODEL = 'heygen/avatar-iv'
const USD = { still: 0.09, kling5s: 0.56, lipsyncPerSec: 0.05 }
export const BROLL_REDOS = 3

/** One shared grade so every shot looks like the same shoot (test 1 failed on mismatched looks). */
const GRADE =
  'Shot on a cinema camera with a 35mm lens, soft natural daylight, muted natural colors, gentle contrast, subtle film grain, real skin texture with visible pores, no beauty filter. Photoreal footage frame, not an illustration. No text, no logos, no watermark.'

function lookLine(outfit: string): string {
  const clothes = outfit.trim()
    ? `wearing ${outfit.trim()}`
    : 'wearing exactly the same clothes and jewelry as in the reference photo, same colors'
  return `The person from the reference image: exactly the same face, skin tone, eyes, nose, lips, hair and age, ${clothes}.`
}

export function onCameraStillPrompt(setting: string, outfit: string): string {
  return [
    'Vertical 9:16 cinematic frame.',
    lookLine(outfit),
    `Setting: ${setting.trim() || 'beside a large window in a bright modern apartment'}.`,
    'Framed from mid-chest up, centered, looking straight into the lens mid-sentence with a relaxed natural expression, mouth slightly open as if talking, hands out of frame or resting.',
    GRADE,
  ].join(' ')
}

export function brollStillPrompt(scene: string, outfit: string): string {
  return [
    'Vertical 9:16 cinematic frame.',
    lookLine(outfit).replace('the reference image', 'the reference images'),
    'Same outfit and same light as the second reference image.',
    `Scene: ${scene.trim()}.`,
    'Candid moment: the person is busy with the action and never looks at the camera.',
    GRADE,
  ].join(' ')
}

export function brollMotionPrompt(scene: string): string {
  return `${scene.trim()}. Keep the person's face, hair and clothes exactly as in the image. One continuous shot, slow subtle handheld push-in, natural movement at real-time speed. The person never looks at the camera and does not talk. No text, no music.`
}

/** Generate one 9:16 still and store it; returns the storage path. */
export async function makeStill(supabase: Supabase, profileId: string, prompt: string, refUrls: string[]): Promise<string> {
  const { bytes } = await generateImageForComparison(STILL_MODEL, prompt, '9:16', refUrls)
  const path = `${profileId}/broll-still-${randomUUID()}.png`
  const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(path, bytes, { contentType: 'image/png', upsert: false })
  if (error) throw new Error(`storage: ${error.message}`)
  return path
}

export type BrollTaskInput = {
  profileId: string
  typeId: string
  creatorId: string
  length: number
  lines: string[]
  /** Indexes of lines spoken on camera; the rest are covered by B-roll. */
  onCamLines: number[]
  onCameraSetting: string
  scenes: string[]
  outfit: string
  captions: 'off' | 'serif' | 'sans'
  captionPos: 'center' | 'lower'
  cta: string
  logo: boolean
  formatId: string | null
  title: string
  caption?: string
  stills: { onCamera: string; broll: string[] }
  redosLeft: number
  stage: 'stills' | 'review' | 'voice' | 'rendering' | 'editing' | 'done'
  lipsync_job_id?: string
  broll_job_ids?: string[]
  lineTimes?: TimedText[]
  durationSec?: number
  editingSince?: string
}

/** Which lines are on camera: first and last, plus the middle one when there are 3 on-camera moments. */
export function onCameraLineIndexes(lineCount: number, moments: number): number[] {
  if (lineCount <= 2) return [0, lineCount - 1].filter((v, i, a) => a.indexOf(v) === i)
  const out = [0, lineCount - 1]
  if (moments >= 3 && lineCount >= 5) out.splice(1, 0, Math.floor(lineCount / 2))
  return out
}

/** Spread the B-roll clips over the off-camera lines, ~2.5s per shot, each clip used once. */
export function brollWindows(lineTimes: TimedText[], onCam: number[], clips: number): Array<{ clip: number; start: number; end: number }> {
  const off = lineTimes.map((t, i) => ({ i, t })).filter(x => !onCam.includes(x.i))
  if (!off.length || !clips) return []
  const spans = off.map(({ i, t }) => {
    const next = lineTimes[i + 1]
    return { start: Math.max(0, t.start - 0.06), end: next ? next.start - 0.02 : t.end + 0.1 }
  })
  const total = spans.reduce((s, x) => s + (x.end - x.start), 0)
  // At least one clip per span; the rest by length.
  const counts = spans.map(() => 1)
  for (let left = clips - spans.length; left > 0; left--) {
    let best = 0
    for (let k = 1; k < spans.length; k++) {
      const per = (spans[k]!.end - spans[k]!.start) / counts[k]!
      if (per > (spans[best]!.end - spans[best]!.start) / counts[best]!) best = k
    }
    counts[best]!++
  }
  void total
  const out: Array<{ clip: number; start: number; end: number }> = []
  let clip = 0
  spans.forEach((s, k) => {
    const n = counts[k]!
    const step = (s.end - s.start) / n
    for (let j = 0; j < n && clip < clips; j++) {
      out.push({ clip: clip++, start: s.start + j * step, end: s.start + (j + 1) * step })
    }
  })
  return out
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
 * Move a B-roll task forward. 'review' waits for the user; 'rendering' polls the lip-sync and every
 * Kling job; when all are done one caller claims the edit, assembles and puts the video in Approvals.
 * Any failed render fails the task and refunds everything it was charged.
 */
export async function advanceBrollTask(
  supabase: Supabase,
  task: { id: string; user_id: string; status: string; input: unknown; action_type?: string | null },
): Promise<{ status: 'review' | 'rendering' | 'editing' | 'completed' | 'failed' }> {
  if (task.status === 'completed') return { status: 'completed' }
  if (task.status === 'failed') return { status: 'failed' }
  const input = task.input as BrollTaskInput
  if (input.stage === 'stills' || input.stage === 'review') return { status: 'review' }
  if (input.stage === 'voice') return { status: 'rendering' }
  if (input.stage === 'editing') {
    const since = input.editingSince ? Date.parse(input.editingSince) : 0
    if (Date.now() - since < 6 * 60_000) return { status: 'editing' }
  }
  const ids = [input.lipsync_job_id, ...(input.broll_job_ids ?? [])]
  if (ids.some(id => !id)) {
    await failVideoTask(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }
  const polls = await Promise.all(ids.map(id => pollVideoJob(id!)))
  if (polls.some(p => p.status === 'failed')) {
    await failVideoTask(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }
  if (polls.some(p => p.status !== 'completed')) return { status: 'rendering' }

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
    const videos = await Promise.all(polls.map(p => {
      const src = p.unsigned_urls?.[0]
      return src ? fetchBytes(src, openRouterHeaders()) : Promise.resolve(null)
    }))
    if (videos.some(v => !v)) throw new Error('could not download a rendered clip')
    const [main, ...clips] = videos as Buffer[]
    const lineTimes = input.lineTimes ?? []
    const windows = brollWindows(lineTimes, input.onCamLines, clips.length)
    const logoUrl = input.logo ? await loadBrandLogoReference(input.profileId) : null
    const logo = logoUrl ? await fetchBytes(logoUrl) : null

    const out = await assembleVideo({
      video: main!,
      lines: input.lines,
      subtitles: input.captions !== 'off',
      captionStyle: input.captions === 'serif' ? 'serif' : 'sans',
      captionY: input.captionPos === 'lower' ? 0.73 : 0.52,
      lineTimes: lineTimes.length ? lineTimes : null,
      broll: windows.map(w => ({ video: clips[w.clip]!, start: w.start, end: w.end })),
      cta: input.cta.trim() || null,
      endCard: logo ? { text: '', logo, background: '#000000', seconds: 1.6 } : null,
    })

    const storagePath = `${input.profileId}/${randomUUID()}.mp4`
    const { error: upErr } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(storagePath, out.video, { contentType: 'video/mp4', upsert: false })
    if (upErr) throw new Error(`storage: ${upErr.message}`)

    await supabase.from('agent_outputs').insert({
      task_id: task.id,
      user_id: task.user_id,
      agent: 'video_generation',
      output_type: 'social_post',
      title: input.title || 'Cinematic B-roll video',
      content: {
        raw: input.caption?.trim() || input.lines.join(' '),
        script: input.lines,
        media_storage_path: storagePath,
        media_mime: 'video/mp4',
        generated: {
          model: `${LIPSYNC_MODEL} + ${BROLL_MODEL}`,
          video_type: input.typeId,
          creator: input.creatorId,
          captions: input.captions,
          duration_sec: out.durationSec,
          stills: input.stills,
          scenes: input.scenes,
        },
      },
      status: 'pending_approval',
      lifecycle_stage: 'review',
    })

    const stillsMade = 1 + input.scenes.length + (BROLL_REDOS - input.redosLeft)
    const cost = stillsMade * USD.still + clips.length * USD.kling5s + (input.durationSec ?? out.durationSec) * USD.lipsyncPerSec
    await recordAgentTaskCost(task.id, {
      action_type: (task.action_type as ActionCreditKey) ?? 'video_broll_30',
      cost_usd: Math.round(cost * 100) / 100,
      add_cost_usd: true,
      model: BROLL_MODEL,
    })
    await supabase
      .from('agent_tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString(), input: { ...claimed, stage: 'done' } })
      .eq('id', task.id)
    return { status: 'completed' }
  } catch (err) {
    console.error('[broll] edit failed', task.id, err instanceof Error ? err.message : err)
    await failVideoTask(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }
}

export async function signedStills(stills: BrollTaskInput['stills']): Promise<{ onCamera: string | null; broll: Array<string | null> }> {
  const [onCamera, ...broll] = await Promise.all([stills.onCamera, ...stills.broll].map(p => createPostAssetSignedUrl(p, 60 * 60 * 6)))
  return { onCamera: onCamera ?? null, broll }
}
