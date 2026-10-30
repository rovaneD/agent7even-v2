import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getWorkspaceAuthContext } from '@/lib/profiles/workspaceSession'
import { createPostAssetSignedUrl, downloadPostAsset } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { openRouterHeaders } from '@/lib/agents/imageGeneration/openRouterImage'
import { assembleVideo } from '@/lib/agents/videoGeneration/assemble'
import { brollWindows, type BrollTaskInput } from '@/lib/agents/videoGeneration/brollJob'
import { pollVideoJob } from '@/lib/agents/videoGeneration/openRouterVideo'

export const maxDuration = 300
const INTERNAL_EMAILS = new Set(['rovane@dursodesign.com', 'melissa@agent7even.com', 'rovdurs@gmail.com'])

/**
 * Internal: redo only the edit of a finished Cinematic B-roll task (no new renders, no credits) so edit
 * changes can be compared on real footage. Uses the stored raw renders, or the provider's copies.
 * Body { taskId }. Returns a signed URL; the task and its Approvals output are not changed.
 */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx?.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { taskId } = (await req.json().catch(() => ({}))) as { taskId?: string }
  const { data: task } = await supabase.from('agent_tasks').select('id,input').eq('id', taskId ?? '').maybeSingle()
  if (!task) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const input = task.input as BrollTaskInput
  const ids = [input.lipsync_job_id, ...(input.broll_job_ids ?? [])]
  const videos: Buffer[] = []
  for (const [i, id] of ids.entries()) {
    let v = await downloadPostAsset(`${input.profileId}/broll-raw-${task.id}-${i}.mp4`)
    if (!v && id) {
      const poll = await pollVideoJob(id)
      const src = poll.unsigned_urls?.[0]
      const r = src ? await fetch(src, { headers: openRouterHeaders() }) : null
      v = r?.ok ? Buffer.from(await r.arrayBuffer()) : null
      if (v) await supabase.storage.from(POST_ASSETS_BUCKET).upload(`${input.profileId}/broll-raw-${task.id}-${i}.mp4`, v, { contentType: 'video/mp4', upsert: true })
    }
    if (!v) return NextResponse.json({ error: 'render_unavailable', index: i }, { status: 410 })
    videos.push(v)
  }
  const [main, ...clips] = videos
  const lineTimes = input.lineTimes ?? []
  const out = await assembleVideo({
    video: main!,
    lines: input.lines,
    subtitles: input.captions !== 'off',
    captionStyle: input.captions === 'serif' ? 'serif' : 'sans',
    captionY: input.captionPos === 'lower' ? 0.73 : 0.52,
    lineTimes: lineTimes.length ? lineTimes : null,
    broll: brollWindows(lineTimes, input.onCamLines, clips.length).map(w => ({ video: clips[w.clip]!, start: w.start, end: w.end })),
    cta: input.cta?.trim() || null,
    endCard: null,
  })
  const path = `${input.profileId}/reedit-${task.id}-${Date.now()}.mp4`
  const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(path, out.video, { contentType: 'video/mp4', upsert: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: await createPostAssetSignedUrl(path, 60 * 60 * 6), durationSec: out.durationSec })
}
