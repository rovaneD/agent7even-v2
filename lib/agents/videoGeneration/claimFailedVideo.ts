import { failVideoTask } from './failVideoTask'
import type { createServiceClient } from '@/lib/supabase/server'

type Supabase = ReturnType<typeof createServiceClient>

/**
 * One poller refunds a running video. Presenter and B-roll are advanced from the create panel and
 * from every dashboard page; both can observe the same failure. The status claim makes the second
 * caller a no-op so the ledger is not refunded twice.
 */
export async function claimFailedVideo(supabase: Supabase, taskId: string, userId: string | null | undefined): Promise<void> {
  const { data } = await supabase
    .from('agent_tasks')
    .update({ status: 'failed', completed_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('status', 'running')
    .select('id')
  if (!data?.length) return
  await failVideoTask(supabase, taskId, userId)
}
