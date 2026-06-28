import { createServiceClient } from '@/lib/supabase/server'

export const PLAN_CREDITS: Record<string, number> = {
  starter:  100,
  growth:   350,
  proagent: 1000,
}

export interface CreditMutationResult {
  balance: number
}

/** Reset balance to plan allocation and write a ledger row. */
export async function allocatePlanCredits(
  profileId: string,
  plan: string,
  opts?: { skipIfAllocated?: boolean; description?: string; preserveExistingBalance?: boolean }
): Promise<number | null> {
  const credits = PLAN_CREDITS[plan]
  if (!credits) return null

  const supabase = createServiceClient()

  if (opts?.skipIfAllocated) {
    const { count } = await supabase
      .from('credit_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profileId)
      .eq('type', 'allocation')

    if ((count ?? 0) > 0) return null
  }

  const now = new Date().toISOString()
  const description = opts?.description ?? `Monthly allocation — ${plan} plan`
  let balanceAfter = credits

  if (opts?.preserveExistingBalance) {
    const { data } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', profileId)
      .maybeSingle()
    const currentBalance = Number(data?.balance ?? 0)
    if (currentBalance >= credits) return null
    balanceAfter = credits
  }

  await supabase
    .from('credit_balances')
    .upsert({
      user_id:    profileId,
      balance:    balanceAfter,
      updated_at: now,
    })

  await supabase.from('credit_ledger').insert({
    user_id:       profileId,
    type:          'allocation',
    credits,
    balance_after: balanceAfter,
    description,
  })

  return credits
}

export async function deductCredits(
  profileId: string,
  credits: number,
  description: string,
  taskId?: string,
  orchestrationId?: string
): Promise<CreditMutationResult> {
  if (credits <= 0) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', profileId)
      .maybeSingle()
    return { balance: Number(data?.balance ?? 0) }
  }

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
  if (credits <= 0) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', profileId)
      .maybeSingle()
    return { balance: Number(data?.balance ?? 0) }
  }

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
