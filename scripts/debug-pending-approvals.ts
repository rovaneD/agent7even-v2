import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing env')

  const sb = createClient(url, key)
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, company_name, clerk_user_id, created_at')
    .ilike('company_name', '%agent7even%')
    .order('created_at')

  console.log('Agent7even profiles:', profiles)

  const { data: pending } = await sb
    .from('agent_outputs')
    .select('id, task_id, agent, status, user_id, title, created_at')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false })
    .limit(15)

  console.log('\nAll pending_approval outputs:', pending)

  for (const p of profiles ?? []) {
    const { count } = await sb
      .from('agent_outputs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', p.id)
      .eq('status', 'pending_approval')
    if (count) console.log(`Profile ${p.id} (${p.company_name}): ${count} pending`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
