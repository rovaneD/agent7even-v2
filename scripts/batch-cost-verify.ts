/**
 * Batch cost-write verification harness (Test B pattern).
 *
 * Fires N Maya chat turns against a configurable base URL, then queries Supabase
 * for agent_tasks rows in the batch window.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/batch-cost-verify.ts
 *
 * Env:
 *   BATCH_BASE_URL     — default http://localhost:3000
 *   BATCH_COUNT        — default 15
 *   BATCH_AUTH_COOKIE  — full Cookie header value (must include Clerk session)
 *   BATCH_SINCE        — optional ISO start override
 *
 * Local sanity expects BATCH_COUNT/BATCH_COUNT match with cost_usd populated.
 * Serverless drop-risk is UNVERIFIED until run against a deployed preview/prod URL.
 */
import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.BATCH_BASE_URL ?? 'http://localhost:3000'
const COUNT = Number(process.env.BATCH_COUNT ?? '15')
const COOKIE = process.env.BATCH_AUTH_COOKIE ?? ''

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function sendMayaChat(index: number): Promise<{ ok: boolean; status: number; taskHint?: string }> {
  const body = {
    messages: [
      {
        id: `batch-${Date.now()}-${index}`,
        role: 'user',
        parts: [{ type: 'text', text: `Batch verify ping ${index} — reply with one word only.` }],
      },
    ],
  }

  const res = await fetch(`${BASE_URL}/api/maya/chat`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      ...(COOKIE ? { Cookie: COOKIE } : {}),
    },
    body: JSON.stringify(body),
  })

  if (res.status === 307 || res.status === 302 || res.status === 401) {
    const loc = res.headers.get('location') ?? ''
    console.error(`[${index}] auth redirect/block: HTTP ${res.status}${loc ? ` → ${loc}` : ''}`)
    return { ok: false, status: res.status }
  }

  // Consume stream so server-side waitUntil can finish locally
  if (res.ok && res.body) {
    const reader = res.body.getReader()
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }
  } else {
    const text = await res.text().catch(() => '')
    console.error(`[${index}] HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  return { ok: res.ok, status: res.status }
}

async function main() {
  if (!COOKIE) {
    console.error(
      'BATCH_AUTH_COOKIE is required — copy the browser Cookie header while signed in (include __session).',
    )
    process.exit(1)
  }

  const batchStart = process.env.BATCH_SINCE ?? new Date().toISOString()
  console.log(`Batch start: ${batchStart}`)
  console.log(`Target: ${BASE_URL}  Count: ${COUNT}`)
  console.log('NOTE: serverless drop-risk is UNVERIFIED until this runs against a deployed URL.\n')

  const results: { ok: boolean; status: number }[] = []
  for (let i = 1; i <= COUNT; i++) {
    results.push(await sendMayaChat(i))
    // Small gap — still "quick succession"
    await sleep(150)
  }

  const okCount = results.filter(r => r.ok).length
  console.log(`\nHTTP: ${okCount}/${COUNT} chat requests returned 200`)

  // Allow waitUntil + cost writes to settle
  await sleep(8000)

  const { data: tasks, error } = await supabase
    .from('agent_tasks')
    .select('id, agent, status, started_at, completed_at, input_tokens, output_tokens, cost_usd, model, created_at')
    .eq('agent', 'maya')
    .gte('created_at', batchStart)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Query error:', error.message)
    process.exit(1)
  }

  const rows = tasks ?? []
  const withCost = rows.filter(r => r.cost_usd != null && Number(r.cost_usd) > 0)
  const completed = rows.filter(r => r.status === 'completed')
  const withCompletedAt = rows.filter(r => r.completed_at != null)

  console.log('\n=== Batch summary ===')
  console.log(`Generations fired (HTTP 200): ${okCount}`)
  console.log(`agent_tasks rows (maya, since batch): ${rows.length}`)
  console.log(`status=completed: ${completed.length}`)
  console.log(`non-null completed_at: ${withCompletedAt.length}`)
  console.log(`non-null cost_usd > 0: ${withCost.length}`)

  const mismatch = okCount !== rows.length || rows.length !== withCost.length
  if (okCount === 0) {
    console.log('\n⚠ AUTH FAILED: no authenticated chat requests succeeded. Copy the full Cookie header from DevTools on a live /api/maya/chat request.')
  } else if (mismatch) {
    console.log(`\n⚠ MISMATCH: fired ${okCount}, tasks ${rows.length}, cost rows ${withCost.length}`)
  } else {
    console.log('\n✓ Local sanity: counts align (does NOT prove serverless safety).')
  }

  console.log('\n=== agent_tasks rows ===')
  console.log(JSON.stringify(rows, null, 2))

  const taskIds = rows.map(r => r.id)
  if (taskIds.length) {
    const { data: outputs } = await supabase
      .from('agent_outputs')
      .select('id, task_id, input_tokens, output_tokens, cost_usd, created_at')
      .in('task_id', taskIds)
    console.log(`\nagent_outputs for batch tasks: ${outputs?.length ?? 0} (Maya chat does not write outputs)`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
