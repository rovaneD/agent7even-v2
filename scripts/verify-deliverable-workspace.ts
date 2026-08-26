/**
 * Deliverables workspace tenancy — unit tests for the write/read key gate plus
 * a static check that client Deliverables APIs use the workspace id.
 *
 * Usage: npx tsx scripts/verify-deliverable-workspace.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  canAccessWorkspaceDeliverable,
  deliverableWorkspaceGate,
  projectUserIdFromDeliverable,
} from '../lib/deliverables/deliverableWorkspace'
import { hasPermission, type TeamPermissions } from '../lib/teamPermissionsShared'

const OWNER_ID = 'owner-workspace-id'
const MEMBER_ID = 'member-profile-id'
const OTHER_ID = 'other-tenant-id'

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

function memberPerms(deliverables: boolean): TeamPermissions {
  return {
    isOwner: false,
    accountId: OWNER_ID,
    permissions: {
      billing: false,
      services: false,
      ai_toolkit: false,
      analytics: false,
      brand_kit: false,
      deliverables,
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

console.log('=== Deliverables workspace tenancy ===\n')

console.log('Gate unit tests')
{
  const unauth = deliverableWorkspaceGate({ session: null, hasDeliverablesPermission: true })
  check('signed-out is 401', !unauth.ok && unauth.status === 401)
}

{
  const owner = deliverableWorkspaceGate({
    session: { memberId: OWNER_ID, workspaceId: OWNER_ID },
    hasDeliverablesPermission: hasPermission(ownerPerms(), 'deliverables'),
  })
  check(
    'owner writes own workspace',
    owner.ok && owner.workspaceId === OWNER_ID && owner.memberId === OWNER_ID,
  )
}

{
  const allowed = deliverableWorkspaceGate({
    session: { memberId: MEMBER_ID, workspaceId: OWNER_ID },
    hasDeliverablesPermission: hasPermission(memberPerms(true), 'deliverables'),
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
  const denied = deliverableWorkspaceGate({
    session: { memberId: MEMBER_ID, workspaceId: OWNER_ID },
    hasDeliverablesPermission: hasPermission(memberPerms(false), 'deliverables'),
  })
  check('member without deliverables is 403', !denied.ok && denied.status === 403)
}

console.log('\nAccess unit tests')
{
  check(
    'teammate can read owner-project file',
    canAccessWorkspaceDeliverable({
      isPlatformAdmin: false,
      workspaceId: OWNER_ID,
      memberId: MEMBER_ID,
      projectUserId: OWNER_ID,
      uploadedBy: OTHER_ID,
    }),
  )
  check(
    'teammate cannot read another tenant file',
    !canAccessWorkspaceDeliverable({
      isPlatformAdmin: false,
      workspaceId: OWNER_ID,
      memberId: MEMBER_ID,
      projectUserId: OTHER_ID,
      uploadedBy: OTHER_ID,
    }),
  )
  check(
    'teammate can still access their pre-fix upload',
    canAccessWorkspaceDeliverable({
      isPlatformAdmin: false,
      workspaceId: OWNER_ID,
      memberId: MEMBER_ID,
      projectUserId: MEMBER_ID,
      uploadedBy: MEMBER_ID,
    }),
  )
  check(
    'platform admin can access any file',
    canAccessWorkspaceDeliverable({
      isPlatformAdmin: true,
      workspaceId: OWNER_ID,
      memberId: OWNER_ID,
      projectUserId: OTHER_ID,
      uploadedBy: OTHER_ID,
    }),
  )
  check(
    'nested projects array resolves user_id',
    projectUserIdFromDeliverable({ projects: [{ user_id: OWNER_ID }] }) === OWNER_ID,
  )
  check(
    'object projects relation resolves user_id',
    projectUserIdFromDeliverable({ projects: { user_id: OWNER_ID } }) === OWNER_ID,
  )
}

console.log('\nRoute static checks')
const pageSrc = readFileSync(join(process.cwd(), 'app/dashboard/deliverables/page.tsx'), 'utf8')
check(
  'deliverables page lists workspace dataUserId, not member profile.id',
  pageSrc.includes(".eq('projects.user_id', dataUserId)") &&
    pageSrc.includes('loadDashboardSession') &&
    !pageSrc.includes(".eq('projects.user_id', profile.id)"),
)

const uploadSrc = readFileSync(join(process.cwd(), 'app/api/deliverables/upload/route.ts'), 'utf8')
check('upload uses requireDeliverableWorkspace', uploadSrc.includes('requireDeliverableWorkspace'))
check('upload creates project under workspaceId', uploadSrc.includes('userId: workspaceId'))
check('upload storage path is workspace-prefixed', uploadSrc.includes('`${workspaceId}/'))
check('upload attributes uploaded_by to memberId', uploadSrc.includes('uploaded_by: memberId'))
check('upload does not key writes off clerk_user_id', !uploadSrc.includes(".eq('clerk_user_id'"))
check('upload does not resolve acting profile as write key', !uploadSrc.includes('resolveClerkProfile'))

const downloadSrc = readFileSync(join(process.cwd(), 'app/api/deliverables/download/route.ts'), 'utf8')
check('download uses canAccessWorkspaceDeliverable', downloadSrc.includes('canAccessWorkspaceDeliverable'))
check('download requires deliverables permission for non-admins', downloadSrc.includes("'deliverables'"))

const deleteSrc = readFileSync(join(process.cwd(), 'app/api/deliverables/delete/route.ts'), 'utf8')
check('delete uses canAccessWorkspaceDeliverable', deleteSrc.includes('canAccessWorkspaceDeliverable'))
check('delete requires deliverables permission for non-admins', deleteSrc.includes("'deliverables'"))

if (failed > 0) {
  console.log(`\nFAIL · ${failed} check(s)`)
  process.exit(1)
}

console.log('\nPASS · Deliverables reads/writes are workspace-scoped')
