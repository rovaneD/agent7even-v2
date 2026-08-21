/**
 * Brand Kit workspace tenancy — unit tests for the mutation gate plus a
 * static check that Brand Kit API routes write the workspace id.
 *
 * Usage: npx tsx scripts/verify-brand-kit-workspace.ts
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { brandKitMutationGate } from '../lib/brandKit/brandKitWorkspace'
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

function memberPerms(brandKit: boolean): TeamPermissions {
  return {
    isOwner: false,
    accountId: OWNER_ID,
    permissions: {
      billing: false,
      services: false,
      ai_toolkit: false,
      analytics: false,
      brand_kit: brandKit,
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

console.log('=== Brand Kit workspace tenancy ===\n')

console.log('Gate unit tests')
{
  const unauth = brandKitMutationGate({ session: null, hasBrandKitPermission: true })
  check('signed-out is 401', !unauth.ok && unauth.status === 401)
}

{
  const owner = brandKitMutationGate({
    session: { memberId: OWNER_ID, workspaceId: OWNER_ID },
    hasBrandKitPermission: hasPermission(ownerPerms(), 'brand_kit'),
  })
  check(
    'owner writes own workspace',
    owner.ok && owner.workspaceId === OWNER_ID && owner.memberId === OWNER_ID,
  )
}

{
  const allowed = brandKitMutationGate({
    session: { memberId: MEMBER_ID, workspaceId: OWNER_ID },
    hasBrandKitPermission: hasPermission(memberPerms(true), 'brand_kit'),
  })
  check(
    'permitted member writes owner workspace, not member profile',
    allowed.ok && allowed.workspaceId === OWNER_ID && allowed.memberId === MEMBER_ID,
    allowed.ok ? `workspaceId=${allowed.workspaceId}` : undefined,
  )
}

{
  const denied = brandKitMutationGate({
    session: { memberId: MEMBER_ID, workspaceId: OWNER_ID },
    hasBrandKitPermission: hasPermission(memberPerms(false), 'brand_kit'),
  })
  check('member without brand_kit is 403', !denied.ok && denied.status === 403)
}

console.log('\nRoute static checks')
const routeRoot = join(process.cwd(), 'app/api/brand-kit')
const routeFiles = walkTsFiles(routeRoot)
check('found brand-kit API routes', routeFiles.length >= 8, `${routeFiles.length} files`)

for (const file of routeFiles) {
  const rel = file.slice(process.cwd().length + 1)
  const src = readFileSync(file, 'utf8')
  check(
    `${rel} uses requireBrandKitWorkspace`,
    src.includes('requireBrandKitWorkspace'),
  )
  check(
    `${rel} does not key writes off clerk_user_id`,
    !src.includes(".eq('clerk_user_id'"),
  )
}

if (failed > 0) {
  console.log(`\nFAIL · ${failed} check(s)`)
  process.exit(1)
}

console.log('\nPASS · Brand Kit mutations are workspace-scoped')
