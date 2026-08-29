/**
 * Team invite activation must not demote a live workspace owner.
 *
 * npx tsx scripts/verify-team-invite-existing-workspace.ts
 */
import { decideTeamInviteActivation } from '../lib/team/teamInviteActivation'

function assert(cond: unknown, message: string) {
  if (!cond) {
    console.error(`FAIL · ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS · ${message}`)
  }
}

const inviteAccountId = 'owner-bob'
const freshShell = {
  id: 'profile-alice',
  is_account_owner: true,
  account_id: null,
  plan: null,
  status: 'onboarding',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  foundation_complete: false,
  onboarding_complete: false,
  role: 'client',
  billing_exempt: false,
}

assert(
  decideTeamInviteActivation(freshShell, inviteAccountId).action === 'activate',
  'blank onboarding shell can join as a team member',
)

assert(
  decideTeamInviteActivation(
    { ...freshShell, plan: 'growth', status: 'active', stripe_subscription_id: 'sub_123' },
    inviteAccountId,
  ).action === 'refuse_existing_workspace',
  'paying workspace owner is not demoted by a pending invite',
)

assert(
  decideTeamInviteActivation(
    { ...freshShell, plan: 'starter', status: 'trialing', stripe_subscription_id: 'sub_trial' },
    inviteAccountId,
  ).action === 'refuse_existing_workspace',
  'trialing workspace owner is not demoted by a pending invite',
)

assert(
  decideTeamInviteActivation(
    { ...freshShell, foundation_complete: true },
    inviteAccountId,
  ).action === 'refuse_existing_workspace',
  'completed Foundation is treated as a live workspace',
)

assert(
  decideTeamInviteActivation(
    { ...freshShell, onboarding_complete: true },
    inviteAccountId,
  ).action === 'refuse_existing_workspace',
  'completed onboarding is treated as a live workspace',
)

assert(
  decideTeamInviteActivation(
    { ...freshShell, role: 'admin' },
    inviteAccountId,
  ).action === 'refuse_existing_workspace',
  'internal admin accounts cannot be converted into members',
)

assert(
  decideTeamInviteActivation(
    { ...freshShell, billing_exempt: true },
    inviteAccountId,
  ).action === 'refuse_existing_workspace',
  'comp accounts cannot be converted into members',
)

assert(
  decideTeamInviteActivation(
    { ...freshShell, id: inviteAccountId },
    inviteAccountId,
  ).action === 'refuse_existing_workspace',
  'an owner cannot be invited into their own workspace as a member',
)

const alreadyMember = decideTeamInviteActivation(
  {
    ...freshShell,
    is_account_owner: false,
    account_id: inviteAccountId,
  },
  inviteAccountId,
)
assert(
  alreadyMember.action === 'already_member' && alreadyMember.accountId === inviteAccountId,
  'already-linked member of this workspace is a no-op',
)

assert(
  decideTeamInviteActivation(
    {
      ...freshShell,
      is_account_owner: false,
      account_id: 'owner-other',
    },
    inviteAccountId,
  ).action === 'refuse_existing_workspace',
  'members of another team are not stolen by a new invite',
)

assert(
  decideTeamInviteActivation(freshShell, inviteAccountId, { ownedTeamMemberCount: 2 }).action ===
    'refuse_existing_workspace',
  'an owner who already has a team is not demoted',
)

assert(
  decideTeamInviteActivation(
    {
      ...freshShell,
      plan: 'growth',
      status: 'churned',
      stripe_subscription_id: 'sub_old',
      foundation_complete: true,
    },
    inviteAccountId,
  ).action === 'activate',
  'churned leftover plan/foundation does not block joining a new team',
)

if (process.exitCode) {
  console.error('\nTeam invite existing-workspace guards failed')
  process.exit(1)
}

console.log('\nOK · pending invites cannot demote a live workspace owner')
