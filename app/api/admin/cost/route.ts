import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  await requireAdmin()
  const supabase = createServiceClient()

  const [{ data: accounts, error: accountsErr }, { data: runs, error: runsErr }] = await Promise.all([
    supabase
      .from('v_account_month_cost')
      .select('*')
      .order('cost_usd', { ascending: false }),

    supabase
      .from('agent_tasks')
      .select(`
        id, agent, job_type, model, status,
        input_tokens, output_tokens, cached_tokens, cost_usd, created_at,
        profiles ( company_name, full_name )
      `)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (accountsErr) console.error('[admin/cost] accounts error:', accountsErr.message)
  if (runsErr)     console.error('[admin/cost] runs error:', runsErr.message)

  const rows = (accounts ?? []) as {
    user_id: string
    company_name: string | null
    plan: string | null
    mrr_usd: number
    tasks_this_month: number
    input_tokens: number
    output_tokens: number
    cached_tokens: number
    cost_usd: number
    maya_cost_usd: number
    credits_remaining: number | null
  }[]

  const summary = {
    total_mrr:      rows.reduce((s, r) => s + (r.mrr_usd ?? 0), 0),
    total_cost:     rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0),
    total_tasks:    rows.reduce((s, r) => s + (r.tasks_this_month ?? 0), 0),
    active_accounts: rows.filter(r => (r.tasks_this_month ?? 0) > 0).length,
  }

  return NextResponse.json({ accounts: rows, runs: runs ?? [], summary })
}
