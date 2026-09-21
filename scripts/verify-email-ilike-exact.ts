/**
 * Exact profile-email match (no ILIKE wildcards).
 *
 * Usage: npx --yes tsx scripts/verify-email-ilike-exact.ts
 */
import {
  emailsMatch,
  filterRowsByExactEmail,
  selectWithEmail,
} from '../lib/profiles/emailMatch'

type Row = {
  id: string
  email: string | null
  clerk_user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

function assert(name: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  return ok
}

function main() {
  const checks: boolean[] = []

  checks.push(assert(
    'underscore vs dot are different emails',
    !emailsMatch('jane.doe@acme.com', 'jane_doe@acme.com'),
  ))
  checks.push(assert(
    'case-insensitive exact match still works',
    emailsMatch('Jane.Doe@Acme.com', 'jane.doe@acme.com'),
  ))
  checks.push(assert(
    'percent wildcard is literal, not SQL LIKE',
    !emailsMatch('anyone@acme.com', '%@acme.com'),
  ))
  checks.push(assert(
    'empty / null stored email never matches',
    !emailsMatch(null, 'jane_doe@acme.com') && !emailsMatch('', 'jane_doe@acme.com'),
  ))

  const ilikeHits: Row[] = [
    {
      id: 'victim',
      email: 'jane.doe@acme.com',
      clerk_user_id: 'user_victim',
      stripe_customer_id: 'cus_paid',
      stripe_subscription_id: 'sub_paid',
    },
    {
      id: 'same_underscore',
      email: 'jane_doe@acme.com',
      clerk_user_id: 'user_old',
      stripe_customer_id: null,
      stripe_subscription_id: null,
    },
  ]

  const exact = filterRowsByExactEmail(ilikeHits, 'jane_doe@acme.com')
  checks.push(assert(
    'filter drops ILIKE false positive jane.doe when looking up jane_doe',
    exact.length === 1 && exact[0].id === 'same_underscore',
  ))

  const others = exact.filter(p => p.clerk_user_id !== 'user_attacker')
  const orphanIds = exact
    .filter(p => p.id !== others[0]?.id && !p.stripe_customer_id && !p.stripe_subscription_id)
    .map(p => p.id)
  checks.push(assert(
    'relink/orphan path cannot target the paying jane.doe row',
    others[0]?.id === 'same_underscore' && !orphanIds.includes('victim'),
  ))

  const noExact = filterRowsByExactEmail(
    [ilikeHits[0]],
    'jane_doe@acme.com',
  )
  checks.push(assert(
    'signup with jane_doe does not relink when only jane.doe exists',
    noExact.length === 0,
  ))

  checks.push(assert(
    'selectWithEmail appends email once',
    selectWithEmail('id, plan') === 'id, plan, email' &&
      selectWithEmail('id, email, plan') === 'id, email, plan',
  ))

  const passed = checks.filter(Boolean).length
  console.log(`\n${passed}/${checks.length} checks passed`)
  process.exit(passed === checks.length ? 0 : 1)
}

main()
