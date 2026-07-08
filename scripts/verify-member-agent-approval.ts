/**
 * Verify member agent runs land on the owner workspace approval queue.
 *
 * Usage:
 *   OWNER_PROFILE_ID=bfa73081-... MEMBER_PROFILE_ID=<uuid> npx --yes tsx --env-file=.env.local scripts/verify-member-agent-approval.ts
 */
import { createClient } from '@supabase/supabase-js'
import { resolveWorkspaceProfileId } from '../lib/profiles/workspaceProfile'
import { listPendingApprovalTasks } from '../lib/agents/pendingApprovals'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const ownerId = process.env.OWNER_PROFILE_ID ?? process.env.FOUNDATION_GUARDIAN_PROFILE_ID
const memberIdOverride = process.env.MEMBER_PROFILE_ID

async function main() {
  if (!url || !key || !ownerId) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OWNER_PROFILE_ID')
    process.exit(1)
  }

  const sb = createClient(url, key)
  console.log('=== Member agent approval verification ===\n')
  console.log(`Owner workspace: ${ownerId}\n`)

  let memberId = memberIdOverride
  if (!memberId) {
    const { data: members } = await sb
      .from('team_members')
      .select('member_profile_id, profiles!team_members_member_profile_id_fkey(email, full_name)')
      .eq('account_id', ownerId)
      .eq('status', 'active')
      .limit(1)
    memberId = members?.[0]?.member_profile_id as string | undefined
  }

  if (!memberId) {
    console.error('No active team member found — set MEMBER_PROFILE_ID')
    process.exit(1)
  }

  const resolvedWorkspace = await resolveWorkspaceProfileId(sb, memberId)
  console.log(`Member profile: ${memberId}`)
  console.log(`Resolved workspace: ${resolvedWorkspace}`)
  console.log(
    resolvedWorkspace === ownerId
      ? 'PASS · member resolves to owner workspace'
      : 'FAIL · member resolves to wrong workspace — agent runs will not appear in owner queue',
  )

  const { data: memberProfile } = await sb
    .from('profiles')
    .select('account_id, is_account_owner, email')
    .eq('id', memberId)
    .single()
  console.log(`Profile link: account_id=${memberProfile?.account_id ?? 'null'} is_account_owner=${memberProfile?.is_account_owner ?? 'null'}`)

  const pending = await listPendingApprovalTasks(sb, ownerId)
  console.log(`\nOwner pending approval tasks: ${pending.length}`)

  const { data: memberRuns } = await sb
    .from('agent_tasks')
    .select('id, agent, status, user_id, actor_profile_id, error, created_at')
    .eq('actor_profile_id', memberId)
    .order('created_at', { ascending: false })
    .limit(10)

  console.log(`\nRecent tasks attributed to member (any workspace): ${memberRuns?.length ?? 0}`)
  for (const row of memberRuns ?? []) {
    const onOwner = row.user_id === ownerId
    console.log(
      `  ${row.created_at.slice(0, 16)} · ${row.agent} · ${row.status}${onOwner ? '' : ' · WRONG user_id=' + row.user_id} · ${row.error ? row.error.slice(0, 80) : 'ok'}`,
    )
  }

  const wrongWorkspace = (memberRuns ?? []).filter(r => r.user_id !== ownerId)
  if (wrongWorkspace.length > 0) {
    console.log(`\nFAIL · ${wrongWorkspace.length} member run(s) saved on wrong workspace`)
    process.exit(1)
  }

  const memberPendingOnOwner = pending.filter(
    t => (t as { actor_profile_id?: string | null }).actor_profile_id === memberId,
  )
  console.log(`\nPending approvals submitted by member: ${memberPendingOnOwner.length}`)
  if (memberPendingOnOwner.length > 0) {
    for (const task of memberPendingOnOwner) {
      console.log(`  · ${task.agent} task=${task.id}`)
    }
  }

  const { data: ideaTasks } = await sb
    .from('agent_tasks')
    .select('id, agent, status, actor_profile_id, error, created_at')
    .eq('user_id', ownerId)
    .eq('agent', 'idea_analysis')
    .order('created_at', { ascending: false })
    .limit(5)
  console.log(`\nRecent idea_analysis on owner workspace: ${ideaTasks?.length ?? 0}`)
  for (const row of ideaTasks ?? []) {
    console.log(`  ${row.created_at.slice(0, 16)} · ${row.status} · actor=${(row.actor_profile_id as string | null)?.slice(0, 8) ?? 'null'} · ${row.error ? String(row.error).slice(0, 60) : 'ok'}`)
  }

  const { data: orphanTasks } = await sb
    .from('agent_tasks')
    .select('id, agent, status, user_id, actor_profile_id, error, created_at')
    .eq('actor_profile_id', memberId)
    .neq('user_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(5)
  if ((orphanTasks ?? []).length > 0) {
    console.log(`\nOrphan member runs (wrong user_id): ${orphanTasks!.length}`)
    for (const row of orphanTasks!) {
      console.log(`  ${row.created_at.slice(0, 16)} · ${row.agent} · ${row.status} · user_id=${row.user_id}`)
    }
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
