/**
 * Smoke checks for the public Ask Maya marketing chat route.
 * Requires: migration 44 applied, OPENROUTER_API_KEY, Supabase service role.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-marketing-chat.ts
 *   npx --yes tsx --env-file=.env.local scripts/verify-marketing-chat.ts --base http://localhost:3000
 */
import { createClient } from '@supabase/supabase-js'

const base = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

async function post(message: string, sessionId: string, history: { role: string; content: string }[] = []) {
  const res = await fetch(`${base}/api/marketing/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, history }),
  })
  const data = await res.json()
  return { status: res.status, data }
}

async function main() {
  console.log(`Verify Ask Maya @ ${base}`)

  const getRes = await fetch(`${base}/api/marketing/chat`)
  const getJson = await getRes.json()
  console.log('GET enabled:', getJson)

  const sessionId = `verify-${Date.now()}`
  const checks = [
    { label: 'tier pricing', message: 'How much does Growth cost per month?' },
    { label: 'tiktok decline', message: 'Can Maya post to TikTok?' },
    { label: 'off-topic decline', message: 'Write me a poem about cats' },
  ]

  for (const check of checks) {
    const { status, data } = await post(check.message, sessionId)
    console.log(`\n[${check.label}] status=${status}`)
    console.log(String(data.reply ?? data.error).slice(0, 280))
  }

  if (url && key) {
    const supabase = createClient(url, key)
    const { data: rows, error } = await supabase
      .from('marketing_chat_logs')
      .select('role, prompt_tokens, completion_tokens, cost_usd, model')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('\nLog query failed:', error.message)
      console.error('Apply 44_marketing_chat_logs.sql if the table is missing.')
      process.exit(1)
    }

    console.log('\nLog rows:', rows?.length ?? 0)
    const assistant = rows?.find((r) => r.role === 'assistant')
    if (!assistant?.prompt_tokens) {
      console.error('Expected assistant row with token counts')
      process.exit(1)
    }
    console.log('Assistant tokens:', assistant.prompt_tokens, assistant.completion_tokens, 'cost', assistant.cost_usd)
  } else {
    console.warn('\nSkipping log query (missing Supabase env)')
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
