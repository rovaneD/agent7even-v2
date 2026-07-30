/**
 * Stripe test-mode QA for trial v2:
 * - Secret key is test mode
 * - All plan price IDs resolve and are active
 * - Checkout sessions for each tier: $0 due today + 7-day trial
 * - Trialing Supabase profile per tier: credit balance capped at 25
 *
 * Usage: npx tsx --env-file=.env.local scripts/verify_stripe_trial_qa.ts
 */
import { createClient } from '@supabase/supabase-js'
import {
  ensureTrialingForAllTiers,
  TRIAL_DAYS,
  TRIAL_MEDIA_CREDITS,
  TRIAL_QA_PLANS,
  trialLengthDays,
} from './lib/trialQaEnsure'
import { qaStripeClient, qaStripeKey } from './lib/trialQaStripe'
import { planFromPriceId } from '../lib/stripe/planFromPrice'

const PLANS = TRIAL_QA_PLANS

function priceEnv(plan: (typeof PLANS)[number], cadence: 'monthly' | 'annual'): string {
  const qaOverride =
    cadence === 'monthly'
      ? process.env[`STRIPE_QA_${plan.toUpperCase()}_MONTHLY_PRICE_ID`]
      : process.env[`STRIPE_QA_${plan.toUpperCase()}_ANNUAL_PRICE_ID`]
  if (qaOverride?.trim()) return qaOverride.trim()
  const map: Record<(typeof PLANS)[number], { monthly: string; annual: string }> = {
    starter: {
      monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID ?? '',
      annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID ?? '',
    },
    growth: {
      monthly: process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID ?? '',
      annual: process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID ?? '',
    },
    proagent: {
      monthly: process.env.STRIPE_PROAGENT_MONTHLY_PRICE_ID ?? '',
      annual: process.env.STRIPE_PROAGENT_ANNUAL_PRICE_ID ?? '',
    },
  }
  return map[plan][cadence]
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  let failures = 0
  const assert = (ok: boolean, msg: string) => {
    if (!ok) {
      console.error('FAIL:', msg)
      failures++
    } else {
      console.log('OK:', msg)
    }
  }

  const secret = qaStripeKey()
  const usingQaKey = Boolean(process.env.STRIPE_QA_SECRET_KEY?.trim())
  console.log(`Stripe key: ${usingQaKey ? 'STRIPE_QA_SECRET_KEY' : 'STRIPE_SECRET_KEY'} (${secret?.slice(0, 8)}…)`)
  assert(
    Boolean(secret?.startsWith('sk_test_')),
    'Stripe QA requires sk_test_ — set STRIPE_QA_SECRET_KEY or use test keys in .env.local',
  )
  if (!secret?.startsWith('sk_test_')) {
    console.error(
      'Refusing to run checkout session tests against live keys.\n' +
        'Add sk_test_ + test price IDs via STRIPE_QA_SECRET_KEY (and optional STRIPE_QA_*_PRICE_ID overrides).',
    )
    process.exit(1)
  }

  const stripe = qaStripeClient()
  if (!stripe) {
    console.error('Stripe client unavailable')
    process.exit(1)
  }

  console.log('\n── Price IDs ──')
  for (const plan of PLANS) {
    for (const cadence of ['monthly', 'annual'] as const) {
      const id = priceEnv(plan, cadence)
      assert(Boolean(id), `${plan} ${cadence} price ID configured`)
      if (!id) continue
      const price = await stripe.prices.retrieve(id)
      assert(price.active === true, `${plan} ${cadence} price ${id} is active`)
      assert(planFromPriceId(id) === plan, `${plan} ${cadence} price maps to plan ${plan}`)
    }
  }

  console.log('\n── Checkout sessions (monthly, trial) ──')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.agent7even.ai'
  for (const plan of PLANS) {
    const priceId = priceEnv(plan, 'monthly')
    if (!priceId) continue

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { plan, qa: 'verify_stripe_trial_qa' },
      },
      success_url: `${appUrl}/foundation?qa=1`,
      cancel_url: `${appUrl}/start-trial?plan=${plan}`,
    })

    assert(session.amount_total === 0, `${plan} checkout amount_total is $0 (got ${session.amount_total})`)
    const trialDays =
      session.subscription_data?.trial_period_days ??
      (session as { subscription_data?: { trial_period_days?: number } }).subscription_data?.trial_period_days
    if (trialDays != null) {
      assert(trialDays === TRIAL_DAYS, `${plan} checkout trial_period_days is ${TRIAL_DAYS}`)
    } else {
      console.log(`  note: ${plan} session did not echo trial_period_days (amount_total=${session.amount_total} OK)`)
    }

    await stripe.checkout.sessions.expire(session.id)
  }

  console.log('\n── Trialing profiles (Stripe + DB, all tiers) ──')
  if (!supabaseUrl || !supabaseKey) {
    assert(false, 'Supabase env vars present for DB assertion')
    console.log(`\nDone. ${failures} failure(s).`)
    process.exit(failures > 0 ? 1 : 0)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const byPlan = await ensureTrialingForAllTiers(supabase, stripe, 'verify_stripe_trial_qa')

  for (const plan of PLANS) {
    const row = byPlan.get(plan)
    if (!row) {
      assert(false, `trialing profile for ${plan} tier (none found or provisioned)`)
      continue
    }

    const trialDays = trialLengthDays(row.subscription)
    console.log(
      `  profile ${row.id.slice(0, 8)} plan=${row.plan} balance=${row.balance ?? 'null'} trial_days=${trialDays ?? '?'}`,
    )

    assert(row.balance != null, `${plan}: ${row.id.slice(0, 8)} has credit_balances row`)
    assert(
      row.balance! <= TRIAL_MEDIA_CREDITS,
      `${plan}: ${row.id.slice(0, 8)} balance ${row.balance} <= trial cap ${TRIAL_MEDIA_CREDITS}`,
    )
    assert(row.subscription.status === 'trialing', `${plan}: Stripe subscription is trialing`)

    const { data: ledger } = await supabase
      .from('credit_ledger')
      .select('description, credits')
      .eq('user_id', row.id)
      .eq('type', 'allocation')
      .order('created_at', { ascending: false })
      .limit(3)

    const trialAllocation = ledger?.find(
      l => l.description?.includes('Trial allocation') || l.credits === TRIAL_MEDIA_CREDITS,
    )
    assert(
      Boolean(trialAllocation),
      `${plan}: ${row.id.slice(0, 8)} has trial allocation ledger entry (${TRIAL_MEDIA_CREDITS} credits)`,
    )
  }

  assert(byPlan.size === PLANS.length, `trialing profile present for all ${PLANS.length} tiers`)

  console.log(`\nDone. ${failures} failure(s).`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
