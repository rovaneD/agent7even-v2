import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { createPostAssetSignedUrl } from '@/lib/postAssets'

/**
 * Status of one video job for the generating screen. The OpenRouter webhook completes the task and
 * writes the agent_outputs row; the page polls this so it can show the finished video instead of
 * spinning (reconcile-video only reports still-running jobs).
 */
export async function GET(req: Request) {
  const taskId = new URL(req.url).searchParams.get('taskId')?.trim()
  if (!taskId) return NextResponse.json({ error: 'taskId_required' }, { status: 400 })

  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: task } = await supabase
    .from('agent_tasks')
    .select('id,status,user_id')
    .eq('id', taskId)
    .eq('user_id', ws.workspaceId)
    .maybeSingle()
  if (!task) return NextResponse.json({ status: 'unknown' })

  if (task.status !== 'completed') {
    return NextResponse.json({ status: task.status === 'failed' ? 'failed' : 'running' })
  }

  const { data: output } = await supabase
    .from('agent_outputs')
    .select('id,content')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const path = (output?.content as { media_storage_path?: string } | null)?.media_storage_path
  const videoUrl = path ? await createPostAssetSignedUrl(path, 60 * 60) : null
  return NextResponse.json({ status: 'completed', videoUrl, outputId: output?.id ?? null })
}
