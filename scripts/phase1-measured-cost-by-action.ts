/**
 * Phase 1 Step 3 — measured cost_usd by action_type (agent_tasks), last 90 days.
 * Usage: npx tsx --env-file=.env.local scripts/phase1-measured-cost-by-action.ts
 */
import { createClient } from '@supabase/supabase-js'

const INTERNAL_EMAILS = [
  'rovane@dursodesign.com',
  'melissa@agent7even.com',
  'rovdurs@gmail.com',
]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

/** Pre-migration fallback when action_type column is not deployed yet. */
function inferActionTypeKey(row: {
  job_type: string | null
  agent: string | null
  model: string | null
}): string {
  const jt = row.job_type ?? ''
  const agent = row.agent ?? ''
  const model = row.model ?? ''
  if (jt === 'maya_chat' || agent === 'maya') return 'maya_chat_turn'
  if (jt === 'image_options') return model.includes('recraft') ? 'image_premium' : 'image_standard'
  if (jt === 'image_compose_queue') return model.includes('recraft') ? 'image_premium' : 'image_standard'
  if (jt === 'video_generate' || agent === 'video_generation') {
    return model.includes('kling') ? 'video_premium' : 'video_standard'
  }
  if (jt === 'campaign_generate') return 'text_run'
  if (agent === 'content_posting' || jt === 'post_caption') return 'text_run'
  return jt ? `job_type:${jt}` : `agent:${agent}`
}

type Row = {
  action_type: string | null
  job_type: string | null
  cnt: number
  avg_cost: number | null
  max_cost: number | null
}

async function loadInternalProfileIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', INTERNAL_EMAILS)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => r.id as string)
}

async function aggregate(opts: { excludeProfileIds: string[]; label: string }) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('agent_tasks')
    .select('job_type, agent, cost_usd, user_id, created_at, model')
    .gte('created_at', since)
    .not('cost_usd', 'is', null)

  if (error) {
    console.error(`[${opts.label}] query error:`, error.message)
    return
  }

  const rows = (data ?? []).filter(row => {
    if (!opts.excludeProfileIds.length) return true
    return !opts.excludeProfileIds.includes(row.user_id as string)
  })

  const buckets = new Map<string, { costs: number[]; job_type: string | null }>()
  for (const row of rows) {
    const key = inferActionTypeKey(row)
    const cost = Number(row.cost_usd)
    if (!Number.isFinite(cost)) continue
    const b = buckets.get(key) ?? { costs: [], job_type: row.job_type as string | null }
    b.costs.push(cost)
    buckets.set(key, b)
  }

  const out: Row[] = [...buckets.entries()]
    .map(([action_type, b]) => {
      const costs = b.costs
      const sum = costs.reduce((a, c) => a + c, 0)
      return {
        action_type,
        job_type: b.job_type,
        cnt: costs.length,
        avg_cost: costs.length ? Number((sum / costs.length).toFixed(6)) : null,
        max_cost: costs.length ? Math.max(...costs) : null,
      }
    })
    .sort((a, b) => b.cnt - a.cnt)

  console.log(`\n=== ${opts.label} (since ${since}) ===`)
  console.log(JSON.stringify(out, null, 2))
}

async function main() {
  const internalIds = await loadInternalProfileIds()
  console.log('=== internal profile ids (exclude set) ===')
  console.log(JSON.stringify(internalIds, null, 2))

  await aggregate({ excludeProfileIds: internalIds, label: 'EXCLUDING internal test accounts' })
  await aggregate({ excludeProfileIds: [], label: 'INCLUDING all profiles (test traffic only)' })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
