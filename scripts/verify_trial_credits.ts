import { createClient } from '@supabase/supabase-js'
import { videoCreditCost } from '../lib/credits/actionCosts'
import { PLAN_CREDITS } from '../lib/credits'
import { getStripeSecretKey, sanitizeSecretEnvValue } from '../lib/stripe'
import {
  ensureTrialingForAllTiers,
  TRIAL_DAYS,
  TRIAL_MEDIA_CREDITS,
  TRIAL_QA_PLANS,
  trialLengthDays,
} from './lib/trialQaEnsure'
import { qaStripeClient } from './lib/trialQaStripe'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key)
  let failures = 0

  const assert = (ok: boolean, msg: string) => {
    if (!ok) {
      console.error('FAIL:', msg)
      failures++
    } else {
      console.log('OK:', msg)
    }
  }

  assert(TRIAL_MEDIA_CREDITS === 25, 'TRIAL_MEDIA_CREDITS is 25')
  assert(videoCreditCost('kling-v3-std', 'proagent', { onTrial: true }) === -1, 'premium video blocked on trial')
  assert(videoCreditCost('veo-3-1-lite', 'proagent', { onTrial: true }) === 10, 'standard video allowed on trial')

  const secret = sanitizeSecretEnvValue(process.env.STRIPE_QA_SECRET_KEY) ?? getStripeSecretKey()
  const testMode = secret?.startsWith('sk_test_') ?? false
  assert(testMode, 'Stripe QA requires sk_test_ (STRIPE_QA_SECRET_KEY or test STRIPE_SECRET_KEY)')

  const stripe = qaStripeClient()
  if (!stripe || !testMode) {
    console.log(`\nDone. ${failures} failure(s).`)
    process.exit(failures > 0 ? 1 : 0)
  }

  console.log('\n── Trialing profile DB assertions (all tiers) ──')
  const byPlan = await ensureTrialingForAllTiers(supabase, stripe, 'verify_trial_credits')

  for (const plan of TRIAL_QA_PLANS) {
    const row = byPlan.get(plan)
    if (!row) {
      assert(false, `trialing profile for ${plan} tier (none found or provisioned)`)
      continue
    }

    const trialDays = trialLengthDays(row.subscription)
    console.log(
      `  trialing ${row.id.slice(0, 8)} plan=${row.plan} balance=${row.balance ?? 'null'} trial_days=${trialDays ?? '?'}`,
    )

    assert(row.balance != null, `${plan}: ${row.id.slice(0, 8)} has credit_balances row`)
    assert(
      row.balance! <= TRIAL_MEDIA_CREDITS,
      `${plan}: ${row.id.slice(0, 8)} balance ${row.balance} <= ${TRIAL_MEDIA_CREDITS}`,
    )
    assert(row.subscription.status === 'trialing', `${plan}: Stripe subscription is trialing`)

    if (trialDays != null && trialDays !== TRIAL_DAYS) {
      console.log(
        `  note: ${plan} trial length ${trialDays}d (grandfathered — expected ${TRIAL_DAYS}d for new QA subs)`,
      )
    }
  }

  assert(byPlan.size === TRIAL_QA_PLANS.length, `trialing profile present for all ${TRIAL_QA_PLANS.length} tiers`)

  const { data: subscribedProfiles, error } = await supabase
    .from('profiles')
    .select('id, plan, stripe_subscription_id, status')
    .not('stripe_subscription_id', 'is', null)
    .in('plan', [...TRIAL_QA_PLANS])

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  console.log('\n── Subscribed profiles (sample) ──')
  for (const row of (subscribedProfiles ?? []).slice(0, 10)) {
    const { data: bal } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', row.id)
      .maybeSingle()

    const balance = bal?.balance ?? null
    console.log(
      `- ${row.id.slice(0, 8)} plan=${row.plan} status=${row.status} balance=${balance ?? 'null'}`,
    )

    if (row.plan && PLAN_CREDITS[row.plan] && balance != null && balance > TRIAL_MEDIA_CREDITS) {
      console.log(
        `  note: balance ${balance} exceeds trial cap — likely post-trial or pre-migration row`,
      )
    }
  }

  console.log(`\nDone. ${failures} failure(s).`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
