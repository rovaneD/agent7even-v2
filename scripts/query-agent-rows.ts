/**
 * Query recent agent_tasks + agent_outputs for verification runs.
 * Usage: npx tsx --env-file=.env.local scripts/query-agent-rows.ts [sinceIso]
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)
const since = process.argv[2]

async function main() {
  let tasksQuery = supabase
    .from('agent_tasks')
    .select(
      'id, agent, status, started_at, completed_at, input_tokens, output_tokens, cost_usd, model, created_at, orchestration_id, trigger_type',
    )
    .order('created_at', { ascending: false })
    .limit(10)

  if (since) {
    tasksQuery = tasksQuery.gte('created_at', since)
  }

  const { data: tasks, error: tasksErr } = await tasksQuery
  if (tasksErr) {
    console.error('agent_tasks error:', tasksErr.message)
    process.exit(1)
  }

  console.log('=== agent_tasks (latest) ===')
  console.log(JSON.stringify(tasks, null, 2))

  const taskIds = (tasks ?? []).map(t => t.id)
  let outputsQuery = supabase
    .from('agent_outputs')
    .select('id, task_id, input_tokens, output_tokens, cost_usd, agent, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (since) {
    outputsQuery = outputsQuery.gte('created_at', since)
  } else if (taskIds.length) {
    outputsQuery = outputsQuery.in('task_id', taskIds)
  }

  const { data: outputs, error: outputsErr } = await outputsQuery
  if (outputsErr) {
    console.error('agent_outputs error:', outputsErr.message)
    process.exit(1)
  }

  console.log('\n=== agent_outputs (matching / latest) ===')
  console.log(JSON.stringify(outputs, null, 2))

  if (since) {
    const { data: orch } = await supabase
      .from('orchestration_sessions')
      .select('id, triggered_by, status, total_tasks, completed_tasks, total_cost_usd, completed_at, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5)
    console.log('\n=== orchestration_sessions (since batch) ===')
    console.log(JSON.stringify(orch, null, 2))
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
