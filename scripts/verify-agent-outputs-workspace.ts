/**
 * Lock in agent-output archive tenancy: team members must see the workspace
 * owner's saved outputs, not an empty list keyed off their own profile.
 *
 * Usage: npx tsx scripts/verify-agent-outputs-workspace.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exitCode = 1
  } else {
    console.log('ok:', msg)
  }
}

const page = readFileSync(
  join(process.cwd(), 'app/dashboard/agents/[agentId]/outputs/page.tsx'),
  'utf8',
)

assert(page.includes('loadDashboardSession'), 'outputs page loads dashboard workspace session')
assert(page.includes('workspace?.workspaceId'), 'outputs list uses workspace owner id')
assert(page.includes(".eq('user_id', dataUserId)"), 'agent_outputs query is workspace-scoped')
assert(
  !/\.eq\('user_id',\s*profile\.id\)/.test(page),
  'outputs archive is not keyed off the signed-in member id',
)
assert(
  !/\.eq\('clerk_user_id',\s*userId\)/.test(page),
  'outputs page does not pick the newest clerk profile row',
)
assert(
  page.includes('workspaceProfile.company_name'),
  'outputs header uses the workspace company name',
)

const hub = readFileSync(join(process.cwd(), 'app/dashboard/agents/page.tsx'), 'utf8')
assert(hub.includes(".eq('user_id', dataUserId)"), 'Agents hub recent outputs stay workspace-scoped')
assert(
  hub.includes('href={`/dashboard/agents/${output.agent}/outputs?output=${output.id}`}') ||
    /\/dashboard\/agents\/\$\{.*\}\/outputs/.test(
      readFileSync(join(process.cwd(), 'app/dashboard/agents/AgentCommandCenter.tsx'), 'utf8'),
    ),
  'Command Center still links Recent outputs into the per-agent archive',
)

if (process.exitCode) {
  console.error('\nverify-agent-outputs-workspace failed')
  process.exit(1)
}

console.log('\nverify-agent-outputs-workspace passed')
