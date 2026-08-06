import type { SupabaseClient } from '@supabase/supabase-js'

export type FinalizeVideoOutputInput = {
  taskId: string
  userId: string
  storagePath: string
  videoModel: string
  jobId: string
  briefExcerpt: string
}

/**
 * Persist a completed video as a pending_approval output, then mark the task
 * completed. Fail closed: never mark completed unless the output row exists —
 * otherwise paid videos are orphaned (reconcile only scans status=running).
 */
export async function finalizeVideoOutput(
  supabase: SupabaseClient,
  input: FinalizeVideoOutputInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const content = {
    raw: 'Generated video ready for review.',
    media_storage_path: input.storagePath,
    media_mime: 'video/mp4',
    generated: {
      model: input.videoModel,
      job_id: input.jobId,
      brief_excerpt: input.briefExcerpt,
      qa_passed: true,
    },
  }

  const { error: outputError } = await supabase.from('agent_outputs').insert({
    task_id: input.taskId,
    user_id: input.userId,
    agent: 'video_generation',
    output_type: 'social_post',
    title: 'Generated video',
    content,
    status: 'pending_approval',
    lifecycle_stage: 'review',
  })

  if (outputError) {
    return { ok: false, error: `Output insert: ${outputError.message}` }
  }

  const { error: completeError } = await supabase
    .from('agent_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', input.taskId)
    .eq('status', 'running')

  if (completeError) {
    return { ok: false, error: `Task complete: ${completeError.message}` }
  }

  return { ok: true }
}
