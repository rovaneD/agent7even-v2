import { createServiceClient } from '@/lib/supabase/server'
import {
  nextAllocationBalance,
  type AllocationActivity,
  utcMonthStartIso,
} from '@/lib/credits/planAllocation'

export const PLAN_CREDITS: Record<string, number> = {
  starter:  100,
  growth:   350,
  proagent: 1000,
}

export interface CreditMutationResult {
  balance: number
}

export { nextAllocationBalance, utcMonthStartIso } from '@/lib/credits/planAllocation'

type ServiceClient = ReturnType<typeof createServiceClient>

async function loadAllocationActivity(
  supabase: ServiceClient,
  profileId: string,
): Promise<AllocationActivity> {
  const { data: lastAlloc } = await supabase
    .from('credit_ledger')
    .select('credits, created_at')
    .eq('user_id', profileId)
    .eq('type', 'allocation')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastAlloc?.created_at) {
    return {
      previousAllocationCredits: null,
      topupsSinceAllocation: 0,
      netUsageSinceAllocation: 0,
    }
  }

  const since = lastAlloc.created_at as string

  const [{ data: topupRows }, { data: usageRows }, { data: refundRows }] = await Promise.all([
    supabase
      .from('credit_ledger')
      .select('credits')
      .eq('user_id', profileId)
      .eq('type', 'topup')
      .gt('created_at', since),
    supabase
      .from('credit_ledger')
      .select('credits')
      .eq('user_id', profileId)
      .in('type', ['usage', 'debit'])
      .gt('created_at', since),
    supabase
      .from('credit_ledger')
      .select('credits')
      .eq('user_id', profileId)
      .eq('type', 'refund')
      .gt('created_at', since),
  ])

  const topupsSinceAllocation = (topupRows ?? []).reduce(
    (sum, row) => sum + Math.max(0, Number(row.credits ?? 0)),
    0,
  )
  const grossUsage = (usageRows ?? []).reduce(
    (sum, row) => sum + Math.abs(Number(row.credits ?? 0)),
    0,
  )
  const refundTotal = (refundRows ?? []).reduce(
    (sum, row) => sum + Math.max(0, Number(row.credits ?? 0)),
    0,
  )

  return {
    previousAllocationCredits: Number(lastAlloc.credits ?? 0),
    topupsSinceAllocation,
    netUsageSinceAllocation: Math.max(0, grossUsage - refundTotal),
  }
}

/**
 * Write a plan/trial allocation row, optionally preserving unused top-up surplus.
 * Returns the new balance (not only the plan pool size).
 */
export async function writeCreditAllocation(
  profileId: string,
  planCredits: number,
  description: string,
  opts?: { preserveTopups?: boolean },
): Promise<number> {
  const supabase = createServiceClient()
  const preserveTopups = opts?.preserveTopups !== false

  const activity = preserveTopups
    ? await loadAllocationActivity(supabase, profileId)
    : {
        previousAllocationCredits: null,
        topupsSinceAllocation: 0,
        netUsageSinceAllocation: 0,
      }

  const newBalance = nextAllocationBalance(planCredits, activity)
  const now = new Date().toISOString()

  const { error: balanceError } = await supabase
    .from('credit_balances')
    .upsert({
      user_id:    profileId,
      balance:    newBalance,
      updated_at: now,
    })

  if (balanceError) {
    throw new Error(`credit_balances upsert failed: ${balanceError.message}`)
  }

  const { error: ledgerError } = await supabase.from('credit_ledger').insert({
    user_id:       profileId,
    type:          'allocation',
    credits:       planCredits,
    balance_after: newBalance,
    description,
  })

  if (ledgerError) {
    throw new Error(`credit_ledger insert failed: ${ledgerError.message}`)
  }

  return newBalance
}

/**
 * Reset the plan credit pool and write a ledger row.
 * Unused purchased top-ups (ledger type `topup` since last allocation) are preserved.
 */
export async function allocatePlanCredits(
  profileId: string,
  plan: string,
  opts?: {
    skipIfAllocated?: boolean
    skipIfAllocatedThisMonth?: boolean
    description?: string
    preserveTopups?: boolean
  },
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

  if (opts?.skipIfAllocatedThisMonth) {
    const { count } = await supabase
      .from('credit_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profileId)
      .eq('type', 'allocation')
      .gte('created_at', utcMonthStartIso())

    if ((count ?? 0) > 0) return null
  }

  const description = opts?.description ?? `Monthly allocation — ${plan} plan`
  return writeCreditAllocation(profileId, credits, description, {
    preserveTopups: opts?.preserveTopups,
  })
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
