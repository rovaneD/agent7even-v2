import { refundCredits } from '@/lib/credits'
import type { createServiceClient } from '@/lib/supabase/server'

type SupabaseClient = ReturnType<typeof createServiceClient>

/**
 * Mark a video task failed and refund whatever it was charged (net of earlier refunds), so a
 * customer never pays for a video they did not get. Idempotent: a second call finds net 0.
 */
export async function failVideoTask(supabase: SupabaseClient, taskId: string, userId: string | null | undefined): Promise<void> {
  await supabase
    .from('agent_tasks')
    .update({ status: 'failed', completed_at: new Date().toISOString() })
    .eq('id', taskId)
  if (!userId) return
  const { data: rows } = await supabase.from('credit_ledger').select('credits').eq('task_id', taskId)
  const net = (rows ?? []).reduce((sum, r) => sum + Number(r.credits ?? 0), 0)
  if (net < 0) {
    try {
      await refundCredits(userId, -net, 'Refund — video generation failed', taskId)
    } catch (err) {
      console.error('[video] refund failed, task:', taskId, err instanceof Error ? err.message : err)
    }
  }
}
