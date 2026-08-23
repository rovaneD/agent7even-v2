/**
 * Campaign workspace tenancy — unit tests for the write-key gate plus a
 * static check that generate writes the workspace id.
 *
 * Usage: npx tsx scripts/verify-campaign-workspace.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { campaignWorkspaceGate } from '../lib/campaigns/campaignWorkspace'

const OWNER_ID = 'owner-workspace-id'
const MEMBER_ID = 'member-profile-id'

let failed = 0
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('=== Campaign workspace tenancy ===\n')

console.log('Gate unit tests')
{
  const unauth = campaignWorkspaceGate(null)
  check('signed-out is 401', !unauth.ok && unauth.status === 401)
}

{
  const owner = campaignWorkspaceGate({ memberId: OWNER_ID, workspaceId: OWNER_ID })
  check(
    'owner writes own workspace',
    owner.ok && owner.workspaceId === OWNER_ID && owner.memberId === OWNER_ID,
  )
}

{
  const member = campaignWorkspaceGate({ memberId: MEMBER_ID, workspaceId: OWNER_ID })
  check(
    'team member writes owner workspace, not member profile',
    member.ok && member.workspaceId === OWNER_ID && member.memberId === MEMBER_ID,
    member.ok ? `workspaceId=${member.workspaceId}` : undefined,
  )
  check(
    'team member write key is not the acting profile id',
    member.ok && member.workspaceId !== MEMBER_ID,
  )
}

console.log('\nRoute static checks')
const generateSrc = readFileSync(join(process.cwd(), 'app/api/campaigns/generate/route.ts'), 'utf8')
check(
  'generate uses requireCampaignWorkspace',
  generateSrc.includes('requireCampaignWorkspace'),
)
check(
  'generate inserts workspaceId, not member profile.id',
  generateSrc.includes('user_id: workspaceId') && !generateSrc.includes('user_id: profile.id'),
)
check(
  'generate does not resolve the acting Clerk profile as the write key',
  !generateSrc.includes('resolveClerkProfile'),
)

if (failed > 0) {
  console.log(`\nFAIL · ${failed} check(s)`)
  process.exit(1)
}

console.log('\nPASS · campaign generation is workspace-scoped')
