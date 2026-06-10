import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) process.exit(1)

const supabase = createClient(url, key)
const taskIds = process.argv.slice(2)
if (!taskIds.length) {
  console.error('Usage: query-task-outputs.ts <taskId> [...]')
  process.exit(1)
}

async function main() {
  const { data, error } = await supabase
    .from('agent_outputs')
    .select('id, task_id, input_tokens, output_tokens, cost_usd, agent, created_at')
    .in('task_id', taskIds)
  if (error) throw error
  console.log(JSON.stringify(data, null, 2))
}

main()
