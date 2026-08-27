/**
 * AI Toolkit workspace tenancy — unit tests for the write-key gate plus a
 * static check that run-prompt uses the workspace owner for plan/Brand Kit.
 *
 * Usage: npx tsx scripts/verify-ai-toolkit-workspace.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { toolkitWorkspaceGate } from '../lib/ai/toolkitWorkspace'
import { hasPermission, type TeamPermissions } from '../lib/teamPermissionsShared'
import { hasPlatformAccess } from '../lib/plans'
import { meetsPlanRequirement } from '../lib/ai/toolkitCategoryPlan'

const OWNER_ID = 'owner-workspace-id'
const MEMBER_ID = 'member-profile-id'

function ownerPerms(): TeamPermissions {
  return {
    isOwner: true,
    accountId: null,
    permissions: {
      billing: true,
      services: true,
      ai_toolkit: true,
      analytics: true,
      brand_kit: true,
      deliverables: true,
      support: true,
    },
  }
}

function memberPerms(aiToolkit: boolean): TeamPermissions {
  return {
    isOwner: false,
    accountId: OWNER_ID,
    permissions: {
      billing: false,
      services: false,
      ai_toolkit: aiToolkit,
      analytics: false,
      brand_kit: false,
      deliverables: false,
      support: true,
    },
  }
}

let failed = 0
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('=== AI Toolkit workspace tenancy ===\n')

console.log('Gate unit tests')
{
  const unauth = toolkitWorkspaceGate({ session: null, hasToolkitPermission: true })
  check('signed-out is 401', !unauth.ok && unauth.status === 401)
}

{
  const owner = toolkitWorkspaceGate({
    session: { memberId: OWNER_ID, workspaceId: OWNER_ID },
    hasToolkitPermission: hasPermission(ownerPerms(), 'ai_toolkit'),
  })
  check(
    'owner uses own workspace',
    owner.ok && owner.workspaceId === OWNER_ID && owner.memberId === OWNER_ID,
  )
}

{
  const allowed = toolkitWorkspaceGate({
    session: { memberId: MEMBER_ID, workspaceId: OWNER_ID },
    hasToolkitPermission: hasPermission(memberPerms(true), 'ai_toolkit'),
  })
  check(
    'permitted member uses owner workspace, not member profile',
    allowed.ok && allowed.workspaceId === OWNER_ID && allowed.memberId === MEMBER_ID,
    allowed.ok ? `workspaceId=${allowed.workspaceId}` : undefined,
  )
  check(
    'team member data key is not the acting profile id',
    allowed.ok && allowed.workspaceId !== MEMBER_ID,
  )
}

{
  const denied = toolkitWorkspaceGate({
    session: { memberId: MEMBER_ID, workspaceId: OWNER_ID },
    hasToolkitPermission: hasPermission(memberPerms(false), 'ai_toolkit'),
  })
  check('member without ai_toolkit is 403', !denied.ok && denied.status === 403)
}

console.log('\nMember vs owner plan (the production 403)')
{
  const memberPlan = null
  const memberStatus = 'onboarding'
  const ownerPlan = 'growth'
  const ownerStatus = 'active'
  check(
    'typical invitee hasPlatformAccess is false',
    hasPlatformAccess(memberPlan, memberStatus) === false,
  )
  check(
    'workspace owner hasPlatformAccess is true',
    hasPlatformAccess(ownerPlan, ownerStatus) === true,
  )
  check(
    'member plan locks every starter tool',
    meetsPlanRequirement(memberPlan, 'starter') === false,
  )
  check(
    'owner growth plan unlocks starter tools',
    meetsPlanRequirement(ownerPlan, 'starter') === true,
  )
}

console.log('\nRoute static checks')
const runSrc = readFileSync(join(process.cwd(), 'app/api/ai/run-prompt/route.ts'), 'utf8')
const saveSrc = readFileSync(join(process.cwd(), 'app/api/ai/save-prompt/route.ts'), 'utf8')
const pageSrc = readFileSync(join(process.cwd(), 'app/dashboard/ai-toolkit/page.tsx'), 'utf8')
const navSrc = readFileSync(join(process.cwd(), 'app/dashboard/DashboardShell.tsx'), 'utf8')

check('run-prompt uses requireToolkitWorkspace', runSrc.includes('requireToolkitWorkspace'))
check(
  'run-prompt does not resolve the acting Clerk profile as the write key',
  !runSrc.includes('resolveClerkProfile'),
)
check(
  'run-prompt uses owner plan for hasPlatformAccess',
  runSrc.includes('hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt'),
)
check(
  'run-prompt reads Brand Kit from workspaceId',
  runSrc.includes(".eq('user_id', workspaceId)"),
)
check(
  'run-prompt records usage against workspaceId',
  runSrc.includes('user_id: workspaceId'),
)
check(
  'run-prompt does not insert user_id: profile.id',
  !runSrc.includes('user_id: profile.id'),
)
check('save-prompt uses requireToolkitWorkspace', saveSrc.includes('requireToolkitWorkspace'))
check(
  'save-prompt does not resolve the acting Clerk profile as the auth key',
  !saveSrc.includes('resolveClerkProfile'),
)
check(
  'page loads workspace session for plan/Brand Kit',
  pageSrc.includes('loadDashboardSession') && pageSrc.includes('workspace?.workspaceId'),
)
check(
  'page keys Brand Kit and usage off dataUserId (workspace)',
  (pageSrc.match(/\.eq\('user_id', dataUserId\)/g) ?? []).length >= 2,
)
check(
  'page still lists the member\'s saved prompts',
  pageSrc.includes(".eq('user_id', profile.id)"),
)
check(
  'page passes workspace owner plan to the client',
  pageSrc.includes('plan={workspaceProfile.plan ?? null}'),
)
check(
  'nav hides AI Toolkit without ai_toolkit permission',
  navSrc.includes("'/dashboard/ai-toolkit': 'ai_toolkit'"),
)

if (failed > 0) {
  console.log(`\nFAIL · ${failed} check(s)`)
  process.exit(1)
}

console.log('\nPASS · AI Toolkit plan, Brand Kit, and usage are workspace-scoped')
