import { deductCredits, refundCredits } from '@/lib/credits'
import type { createServiceClient } from '@/lib/supabase/server'

type SupabaseClient = ReturnType<typeof createServiceClient>

/**
 * Internal claim tokens stored on agent_tasks.error. They are not shown raw —
 * friendlyRunError maps them. The column is the row lock: Postgres updates
 * the matching row once, so two webhook deliveries cannot both refund.
 */
const REFUNDING = 'video_refunding'
const REFUNDED = 'video_refunded'
const SETTLED = 'video_fail_settled'
const RECHARGING = 'video_recharging'
const RECHARGED = 'video_recharged'

type CreditOps = {
  refundCredits: typeof refundCredits
  deductCredits: typeof deductCredits
}

const defaultCreditOps: CreditOps = { refundCredits, deductCredits }

/**
 * Mark a video task failed and refund whatever it was charged (net of earlier refunds), so a
 * customer never pays for a video they did not get.
 *
 * Safe when the webhook and "Check if ready" both observe the same failure, and when one of
 * those paths fails after the other has already saved the mp4: a delivered clip is completed
 * and any refund is charged back once.
 */
export async function failVideoTask(
  supabase: SupabaseClient,
  taskId: string,
  userId: string | null | undefined,
  credits: CreditOps = defaultCreditOps,
): Promise<void> {
  if (await hasDeliveredOutput(supabase, taskId)) {
    await completeVideoTask(supabase, taskId, userId, credits)
    return
  }

  const now = new Date().toISOString()
  await supabase
    .from('agent_tasks')
    .update({ status: 'failed', completed_at: now })
    .eq('id', taskId)
    .eq('status', 'running')

  if (await hasDeliveredOutput(supabase, taskId)) {
    await completeVideoTask(supabase, taskId, userId, credits)
    return
  }

  if (!userId) return

  const { data: claimed, error: claimError } = await supabase
    .from('agent_tasks')
    .update({ error: REFUNDING })
    .eq('id', taskId)
    .eq('status', 'failed')
    .is('error', null)
    .select('id')
  if (claimError || !claimed?.length) return

  try {
    if (await hasDeliveredOutput(supabase, taskId)) {
      await supabase.from('agent_tasks').update({ error: null }).eq('id', taskId).eq('error', REFUNDING)
      await completeVideoTask(supabase, taskId, userId, credits)
      return
    }

    const net = await netCredits(supabase, taskId)
    if (net < 0) {
      await credits.refundCredits(userId, -net, 'Refund — video generation failed', taskId)
      await supabase.from('agent_tasks').update({ error: REFUNDED }).eq('id', taskId).eq('error', REFUNDING)
    } else {
      await supabase.from('agent_tasks').update({ error: SETTLED }).eq('id', taskId).eq('error', REFUNDING)
    }

    if (await hasDeliveredOutput(supabase, taskId)) {
      await completeVideoTask(supabase, taskId, userId, credits)
    }
  } catch (err) {
    await supabase.from('agent_tasks').update({ error: null }).eq('id', taskId).eq('error', REFUNDING)
    console.error('[video] refund failed, task:', taskId, err instanceof Error ? err.message : err)
  }
}

/**
 * Finish a video task that has a saved approval output.
 * Only one caller can move running → completed. If a failure path already refunded the
 * charge, the caller that moves failed → completed (or finds the clip already saved)
 * charges that refund back exactly once.
 */
export async function completeVideoTask(
  supabase: SupabaseClient,
  taskId: string,
  userId: string | null | undefined,
  credits: CreditOps = defaultCreditOps,
): Promise<void> {
  const now = new Date().toISOString()
  const { data: fromRunning } = await supabase
    .from('agent_tasks')
    .update({ status: 'completed', completed_at: now })
    .eq('id', taskId)
    .eq('status', 'running')
    .select('id')
  if (fromRunning?.length) return

  const { data: fromFailed } = await supabase
    .from('agent_tasks')
    .update({ status: 'completed', completed_at: now })
    .eq('id', taskId)
    .eq('status', 'failed')
    .select('id')
  if (fromFailed?.length || await hasDeliveredOutput(supabase, taskId)) {
    await rechargeRefundedVideo(supabase, taskId, userId, credits)
  }
}

async function rechargeRefundedVideo(
  supabase: SupabaseClient,
  taskId: string,
  userId: string | null | undefined,
  credits: CreditOps,
): Promise<void> {
  if (!userId) return
  const { data: claimed, error } = await supabase
    .from('agent_tasks')
    .update({ error: RECHARGING })
    .eq('id', taskId)
    .eq('error', REFUNDED)
    .select('id')
  if (error || !claimed?.length) return

  try {
    const refunded = await refundedCredits(supabase, taskId)
    if (refunded > 0) {
      await credits.deductCredits(userId, refunded, 'Video generation — delivered', taskId)
    }
    await supabase.from('agent_tasks').update({ error: RECHARGED }).eq('id', taskId).eq('error', RECHARGING)
  } catch (err) {
    await supabase.from('agent_tasks').update({ error: REFUNDED }).eq('id', taskId).eq('error', RECHARGING)
    console.error('[video] recharge after refund failed, task:', taskId, err instanceof Error ? err.message : err)
  }
}

async function hasDeliveredOutput(supabase: SupabaseClient, taskId: string): Promise<boolean> {
  const { data } = await supabase
    .from('agent_outputs')
    .select('id')
    .eq('task_id', taskId)
    .limit(1)
    .maybeSingle()
  return Boolean(data?.id)
}

async function netCredits(supabase: SupabaseClient, taskId: string): Promise<number> {
  const { data: rows } = await supabase.from('credit_ledger').select('credits').eq('task_id', taskId)
  return (rows ?? []).reduce((sum, row) => sum + Number(row.credits ?? 0), 0)
}

async function refundedCredits(supabase: SupabaseClient, taskId: string): Promise<number> {
  const { data: rows } = await supabase.from('credit_ledger').select('credits').eq('task_id', taskId)
  return (rows ?? []).reduce((sum, row) => sum + Math.max(0, Number(row.credits ?? 0)), 0)
}
