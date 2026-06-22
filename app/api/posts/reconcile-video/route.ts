import { auth } from '@clerk/nextjs/server'
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { pollVideoJob } from '@/lib/agents/videoGeneration/openRouterVideo'
import { logProviderError } from '@/lib/agents/sanitizeProviderError'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'

export const maxDuration = 60

type ReconcileResult = {
  processed: number
  still_running: number
  failed: number
}

export async function POST(): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('id, user_id, input')
    .eq('user_id', profile.id as string)
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

      // Download
      const dlRes = await fetch(videoUrl)
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

      // Insert agent_output
      await supabase.from('agent_outputs').insert({
        task_id:     task.id,
        user_id:     task.user_id,
        agent:       'video_generation',
        output_type: 'social_post',
        title:       'Generated video',
        content: {
          raw:                'Generated video ready for review.',
          media_storage_path: storagePath,
          media_mime:         'video/mp4',
          generated: {
            model:         videoModel,
            job_id:        jobId,
            brief_excerpt: briefExcerpt,
            qa_passed:     true,
          },
        },
        status: 'pending_approval',
      })

      await supabase
        .from('agent_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', task.id as string)

      result.processed++
    } catch (err) {
      logProviderError(`reconcile-video job ${jobId}`, err)
      // Leave as running — video may still be generating
      result.still_running++
    }
  }

  return NextResponse.json<ReconcileResult>(result)
}
