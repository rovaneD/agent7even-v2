import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { pollVideoJob } from '@/lib/agents/videoGeneration/openRouterVideo'
import { finalizeVideoOutput } from '@/lib/agents/videoGeneration/finalizeVideoOutput'
import { logProviderError } from '@/lib/agents/sanitizeProviderError'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { openRouterHeaders } from '@/lib/agents/imageGeneration/openRouterImage'

export const maxDuration = 60

type ReconcileResult = {
  processed: number
  still_running: number
  failed: number
}

export async function POST(): Promise<NextResponse> {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId } = ws

  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('id, user_id, input')
    .eq('user_id', workspaceId)
    .eq('agent', 'video_generation')
    .eq('status', 'running')

  if (!tasks || tasks.length === 0) {
    return NextResponse.json<ReconcileResult>({ processed: 0, still_running: 0, failed: 0 })
  }

  const result: ReconcileResult = { processed: 0, still_running: 0, failed: 0 }

  for (const task of tasks) {
    const input      = (task.input ?? {}) as Record<string, unknown>
    const jobId      = input.video_job_id as string | undefined
    const profileId  = input.profileId as string | undefined
    const videoModel = (input.video_model as string | undefined) ?? 'unknown'
    const briefExcerpt = (input.brief_excerpt as string | undefined) ?? ''

    if (!jobId || !profileId) {
      await supabase
        .from('agent_tasks')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', task.id as string)
      result.failed++
      continue
    }

    try {
      const poll = await pollVideoJob(jobId)

      if (poll.status === 'failed') {
        await supabase
          .from('agent_tasks')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', task.id as string)
        result.failed++
        continue
      }

      if (poll.status !== 'completed') {
        result.still_running++
        continue
      }

      const videoUrl = poll.unsigned_urls?.[0]
      if (!videoUrl) {
        await supabase
          .from('agent_tasks')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', task.id as string)
        result.failed++
        continue
      }

      // Download — 401 means the signed URL expired; mark failed so we stop retrying
      const dlRes = await fetch(videoUrl, { headers: openRouterHeaders() })
      if (dlRes.status === 401 || dlRes.status === 403) {
        await supabase
          .from('agent_tasks')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', task.id as string)
        result.failed++
        continue
      }
      if (!dlRes.ok) throw new Error(`Download ${dlRes.status}`)
      const videoBytes = Buffer.from(await dlRes.arrayBuffer())

      // Ensure bucket allows video/mp4
      const { data: bucket } = await supabase.storage.getBucket(POST_ASSETS_BUCKET)
      const currentTypes = (bucket as { allowed_mime_types?: string[] | null } | null)?.allowed_mime_types
      if (!Array.isArray(currentTypes) || !currentTypes.includes('video/mp4')) {
        await supabase.storage.updateBucket(POST_ASSETS_BUCKET, {
          public: false,
          allowedMimeTypes: [...(currentTypes ?? []), 'video/mp4'],
        })
      }

      // Upload
      const storagePath = `${profileId}/${randomUUID()}.mp4`
      const { error: uploadError } = await supabase.storage
        .from(POST_ASSETS_BUCKET)
        .upload(storagePath, videoBytes, { contentType: 'video/mp4', upsert: false })

      if (uploadError) throw new Error(`Upload: ${uploadError.message}`)

      const finalized = await finalizeVideoOutput(supabase, {
        taskId: task.id as string,
        userId: task.user_id as string,
        storagePath,
        videoModel,
        jobId,
        briefExcerpt,
      })
      if (!finalized.ok) throw new Error(finalized.error)

      result.processed++
    } catch (err) {
      logProviderError(`reconcile-video job ${jobId}`, err)
      // Leave as running — video may still be generating
      result.still_running++
    }
  }

  return NextResponse.json<ReconcileResult>(result)
}
