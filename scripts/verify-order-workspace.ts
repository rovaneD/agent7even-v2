/**
 * Services/order workspace tenancy — unit tests for the write-key gate plus a
 * static check that order APIs write the workspace id.
 *
 * Usage: npx tsx scripts/verify-order-workspace.ts
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { orderWorkspaceGate } from '../lib/orders/orderWorkspace'
import { hasPermission, type TeamPermissions } from '../lib/teamPermissionsShared'

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

function memberPerms(services: boolean): TeamPermissions {
  return {
    isOwner: false,
    accountId: OWNER_ID,
    permissions: {
      billing: false,
      services,
      ai_toolkit: false,
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

function walkTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walkTsFiles(full))
    else if (name.endsWith('.ts')) out.push(full)
  }
  return out
}

console.log('=== Order workspace tenancy ===\n')

console.log('Gate unit tests')
{
  const unauth = orderWorkspaceGate({ session: null, hasServicesPermission: true })
  check('signed-out is 401', !unauth.ok && unauth.status === 401)
}

{
  const owner = orderWorkspaceGate({
    session: { memberId: OWNER_ID, workspaceId: OWNER_ID },
    hasServicesPermission: hasPermission(ownerPerms(), 'services'),
  })
  check(
    'owner writes own workspace',
    owner.ok && owner.workspaceId === OWNER_ID && owner.memberId === OWNER_ID,
  )
}

{
  const allowed = orderWorkspaceGate({
    session: { memberId: MEMBER_ID, workspaceId: OWNER_ID },
    hasServicesPermission: hasPermission(memberPerms(true), 'services'),
  })
  check(
    'permitted member writes owner workspace, not member profile',
    allowed.ok && allowed.workspaceId === OWNER_ID && allowed.memberId === MEMBER_ID,
    allowed.ok ? `workspaceId=${allowed.workspaceId}` : undefined,
  )
  check(
    'team member write key is not the acting profile id',
    allowed.ok && allowed.workspaceId !== MEMBER_ID,
  )
}

{
  const denied = orderWorkspaceGate({
    session: { memberId: MEMBER_ID, workspaceId: OWNER_ID },
    hasServicesPermission: hasPermission(memberPerms(false), 'services'),
  })
  check('member without services is 403', !denied.ok && denied.status === 403)
}

console.log('\nRoute static checks')
const routeRoot = join(process.cwd(), 'app/api/orders')
const routeFiles = walkTsFiles(routeRoot).filter(file => !file.includes('/admin/'))
check('found order API routes', routeFiles.length >= 3, `${routeFiles.length} files`)

for (const file of routeFiles) {
  const rel = file.slice(process.cwd().length + 1)
  const src = readFileSync(file, 'utf8')
  check(
    `${rel} uses requireOrderWorkspace`,
    src.includes('requireOrderWorkspace'),
  )
  check(
    `${rel} writes workspaceId, not member profile.id`,
    src.includes('user_id: workspaceId') || src.includes(".eq('user_id', workspaceId)"),
  )
  check(
    `${rel} does not key writes off clerk_user_id`,
    !src.includes(".eq('clerk_user_id'"),
  )
  check(
    `${rel} does not resolve the acting Clerk profile as the write key`,
    !src.includes('resolveClerkProfile'),
  )
}

const createSrc = readFileSync(join(process.cwd(), 'app/api/orders/create/route.ts'), 'utf8')
check(
  'create inserts orders with workspaceId',
  (createSrc.match(/user_id: workspaceId/g) ?? []).length >= 2,
)
check(
  'create does not insert user_id: profile.id',
  !createSrc.includes('user_id: profile.id'),
)
check(
  'create uses owner plan for hasPlatformAccess',
  createSrc.includes('hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt'),
)

if (failed > 0) {
  console.log(`\nFAIL · ${failed} check(s)`)
  process.exit(1)
}

console.log('\nPASS · Services/order mutations are workspace-scoped')
