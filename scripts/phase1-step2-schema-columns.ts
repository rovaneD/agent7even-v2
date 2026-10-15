/**
 * Phase 1 Step 2 — print agent_tasks / agent_outputs cost-related columns from live DB.
 * Usage: npx tsx --env-file=.env.local scripts/phase1-step2-schema-columns.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function columns(table: string) {
  const { data: sample, error: sampleError } = await supabase.from(table).select('*').limit(1)
  if (sampleError) {
    console.log(`=== ${table} sample error ===`)
    console.log(sampleError.message)
    return
  }
  const keys = sample?.[0] ? Object.keys(sample[0]).sort() : []
  console.log(`=== ${table} columns (from sample row keys; empty table = no keys) ===`)
  console.log(JSON.stringify(keys, null, 2))
}

async function main() {
  console.log('=== schema snapshot file (agent_tasks excerpt) ===')
  console.log(
    [
      'cost_usd numeric(10,6)',
      'model text',
      'input_tokens integer',
      'output_tokens integer',
      'job_type text',
      'action_type text — ADD via 46_agent_tasks_action_type.sql (NOT in schema_live_2026-08-21.sql)',
    ].join('\n'),
  )
  await columns('agent_tasks')
  await columns('agent_outputs')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
