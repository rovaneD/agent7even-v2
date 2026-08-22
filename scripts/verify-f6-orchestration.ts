/**
 * F6 verification — runFoundationGeneration still writes orchestration_sessions.
 * Runs one section only (voice → 1 doc) to limit API cost.
 */
import { createClient } from '@supabase/supabase-js'
import { runFoundationGeneration } from '../lib/foundation/runFoundationGeneration'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')

  const sb = createClient(url, key)
  const profileId = process.env.F6_PROFILE_ID ?? 'bfa73081-3906-4b5b-b24e-d9df3fb07384'

  const { data: before } = await sb
    .from('orchestration_sessions')
    .select('id, created_at, total_cost_usd, triggered_by')
    .eq('user_id', profileId)
    .eq('triggered_by', 'foundation_generate')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data: profile } = await sb
    .from('profiles')
    .select('plan, company_name, foundation_answers')
    .eq('id', profileId)
    .single()

  if (!profile?.foundation_answers) {
    console.error('No foundation_answers on profile', profileId)
    process.exit(1)
  }

  console.log('Running foundation_generate (voice section only) for', profileId)
  const result = await runFoundationGeneration(sb, {
    profileId,
    userPlan: profile?.plan ?? 'starter',
    companyName: profile?.company_name ?? 'Test',
    answers: profile.foundation_answers as Record<string, unknown>,
    sections: ['voice'],
    markComplete: false,
  })

  const { data: after } = await sb
    .from('orchestration_sessions')
    .select('id, created_at, total_cost_usd, triggered_by, status')
    .eq('user_id', profileId)
    .eq('triggered_by', 'foundation_generate')
    .order('created_at', { ascending: false })
    .limit(1)

  const prev = before?.[0]
  const latest = after?.[0]
  const isNew =
    latest &&
    (!prev || latest.id !== prev.id || latest.created_at !== prev.created_at)

  console.log('Previous orchestration:', prev)
  console.log('Latest orchestration:', latest)
  console.log('Generation result:', result)

  if (!isNew) {
    console.error('F6 FAILED — no new orchestration_sessions row')
    process.exit(1)
  }
  if (latest!.total_cost_usd == null || Number(latest!.total_cost_usd) <= 0) {
    console.error('F6 FAILED — total_cost_usd null or zero')
    process.exit(1)
  }
  if (latest!.triggered_by !== 'foundation_generate') {
    console.error('F6 FAILED — unexpected triggered_by')
    process.exit(1)
  }
  console.log('F6 verification PASSED — instrumentation intact after runOrchestration removal')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
