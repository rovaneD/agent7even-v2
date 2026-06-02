import { createServiceClient } from '@/lib/supabase/server'

export interface CreditMutationResult {
  balance: number
}

export async function deductCredits(
  profileId: string,
  credits: number,
  description: string,
  taskId?: string,
  orchestrationId?: string
): Promise<CreditMutationResult> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id:          profileId,
    p_amount:           credits,
    p_description:      description,
    p_task_id:          taskId ?? null,
    p_orchestration_id: orchestrationId ?? null,
  })

  if (error) {
    if (error.message.includes('INSUFFICIENT_CREDITS')) throw new Error('INSUFFICIENT_CREDITS')
    throw new Error(error.message)
  }

  return { balance: Number(data ?? 0) }
}

export async function refundCredits(
  profileId: string,
  credits: number,
  description: string,
  taskId?: string
): Promise<CreditMutationResult> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('refund_credits', {
    p_user_id: profileId,
    p_amount:  credits,
    p_reason:  description,
    p_task_id: taskId ?? null,
  })

  if (error) throw new Error(error.message)

  return { balance: Number(data ?? 0) }
}
