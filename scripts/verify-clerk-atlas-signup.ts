import assert from 'node:assert/strict'
import { handleClerkUserCreated } from '../lib/auth/handleClerkUserCreated'
import { isAtlasClerkSignup } from '../lib/auth/clerkSignupProduct'
import { mayaAccessAfterProfile } from '../lib/auth/mayaAccessAfterProfile'

type Row = Record<string, unknown>

function createMockSupabase(state: {
  profiles?: Row[]
  pendingInvites?: { id: string; account_id: string; invited_email: string; status: string }[]
}) {
  const profiles = [...(state.profiles ?? [])]
  const invites = [...(state.pendingInvites ?? [])]
  const updates: Row[] = []

  function from(table: string) {
    const chain: Record<string, any> = {}
    const q = { table, filters: {} as Record<string, unknown>, op: 'select' as string, payload: null as Row | null }
    const methods = [
      'select',
      'insert',
      'upsert',
      'update',
      'delete',
      'eq',
      'neq',
      'ilike',
      'in',
      'order',
      'maybeSingle',
      'single',
    ]
    for (const name of methods) {
      chain[name] = (...args: unknown[]) => {
        if (name === 'select' && q.op === 'select') q.op = 'select'
        if (name === 'upsert' || name === 'insert') {
          q.op = 'upsert'
          q.payload = args[0] as Row
        }
        if (name === 'update') {
          q.op = 'update'
          q.payload = args[0] as Row
        }
        if (name === 'eq') q.filters[String(args[0])] = args[1]
        if (name === 'ilike') q.filters.email = String(args[1]).toLowerCase()
        if (name === 'maybeSingle' || name === 'single') return resolve()
        return chain
      }
    }
    chain.then = (resolve: any, reject: any) => resolveQuery().then(resolve, reject)

    async function resolveQuery() {
      if (table === 'team_members') {
        if (q.op === 'update') {
          const invite = invites.find((row) => row.id === q.filters.id)
          if (invite && q.payload) Object.assign(invite, q.payload)
          return { data: invite ?? null, error: null }
        }
        const email = String(q.filters.invited_email ?? '').toLowerCase()
        const found = invites.find((row) => row.invited_email === email && row.status === (q.filters.status ?? 'pending'))
        return { data: found ?? null, error: null }
      }
      if (table === 'profiles') {
        if (q.op === 'upsert' && q.payload) {
          const created = { id: 'profile_new', ...q.payload }
          profiles.push(created)
          return { data: created, error: null }
        }
        if (q.op === 'update' && q.payload) {
          updates.push(q.payload)
          const existing = profiles.find((row) => row.id === q.filters.id || row.clerk_user_id === q.filters.clerk_user_id)
          if (existing) Object.assign(existing, q.payload)
          return { data: existing ?? q.payload, error: null }
        }
        const email = q.filters.email ? String(q.filters.email).toLowerCase() : ''
        const clerk = q.filters.clerk_user_id
        const id = q.filters.id
        const found = profiles.filter((row) => {
          if (id && row.id !== id) return false
          if (clerk && row.clerk_user_id !== clerk) return false
          if (email && String(row.email).toLowerCase() !== email) return false
          return true
        })
        return { data: found, error: null }
      }
      return { data: null, error: null }
    }

    async function resolve() {
      const result = await resolveQuery()
      if (Array.isArray(result.data)) {
        return { data: result.data[0] ?? null, error: null }
      }
      return result
    }

    return chain
  }

  return { from, _profiles: profiles, _invites: invites, _updates: updates }
}

async function main() {
  assert.equal(isAtlasClerkSignup({ unsafe_metadata: { product: 'atlas' } }), true)
  assert.equal(isAtlasClerkSignup({ public_metadata: { product: 'atlas' } }), true)
  assert.equal(isAtlasClerkSignup({ unsafe_metadata: { product: 'maya' } }), false)

  const welcomes: string[] = []
  const atlasOnly = createMockSupabase({})
  const skipped = await handleClerkUserCreated(
    atlasOnly as any,
    {
      id: 'user_atlas',
      email_addresses: [{ email_address: 'atlas-only@example.com' }],
      first_name: 'Ada',
      unsafe_metadata: { product: 'atlas' },
    },
    { sendWelcome: async ({ email }) => { welcomes.push(email) } },
  )
  assert.equal(skipped.action, 'skipped_atlas_only')
  assert.equal(atlasOnly._profiles.length, 0)
  assert.deepEqual(welcomes, [])

  const maya = createMockSupabase({})
  const provisioned = await handleClerkUserCreated(
    maya as any,
    {
      id: 'user_maya',
      email_addresses: [{ email_address: 'maya@example.com' }],
      first_name: 'Maya',
    },
    { sendWelcome: async ({ email }) => { welcomes.push(email) } },
  )
  assert.equal(provisioned.action, 'provisioned')
  if (provisioned.action === 'provisioned') {
    assert.equal(provisioned.shouldWelcome, true)
    assert.equal(provisioned.joinedViaTeamInvite, false)
  }
  assert.equal(maya._profiles.length, 1)
  assert.deepEqual(welcomes, ['maya@example.com'])

  const invited = createMockSupabase({
    pendingInvites: [{ id: 'inv_1', account_id: 'acct_1', invited_email: 'invited@example.com', status: 'pending' }],
  })
  const atlasInvite = await handleClerkUserCreated(
    invited as any,
    {
      id: 'user_invited',
      email_addresses: [{ email_address: 'invited@example.com' }],
      first_name: 'Ivy',
      unsafe_metadata: { product: 'atlas' },
    },
    { sendWelcome: async ({ email }) => { welcomes.push(email) } },
  )
  assert.equal(atlasInvite.action, 'provisioned')
  if (atlasInvite.action === 'provisioned') {
    assert.equal(atlasInvite.joinedViaTeamInvite, true)
    assert.equal(atlasInvite.shouldWelcome, false)
  }
  assert.equal(invited._invites[0].status, 'active')
  assert.deepEqual(welcomes, ['maya@example.com'])

  assert.equal(
    mayaAccessAfterProfile({
      profile: { id: 'p1' },
      isTeamMember: false,
      billing: { role: 'client', stripe_subscription_id: null, plan: null, status: 'onboarding' },
    }),
    'start-trial',
  )
  assert.equal(
    mayaAccessAfterProfile({
      profile: { id: 'p1' },
      isTeamMember: true,
      billing: { role: 'client', stripe_subscription_id: null, plan: null, status: 'onboarding' },
    }),
    'continue',
  )
  assert.equal(
    mayaAccessAfterProfile({
      profile: { id: 'p1' },
      isTeamMember: false,
      billing: { role: 'client', stripe_subscription_id: 'sub_1', plan: 'starter', status: 'active' },
    }),
    'continue',
  )

  console.log('verify-clerk-atlas-signup: ok')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
