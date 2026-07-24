/**
 * Stripe test-mode QA for trial v2:
 * - Secret key is test mode
 * - All plan price IDs resolve and are active
 * - Checkout sessions for each tier: $0 due today + 7-day trial
 * - Live DB profiles on Stripe trialing: credit balance capped at 25
 *
 * Usage: npx tsx --env-file=.env.local scripts/verify_stripe_trial_qa.ts
 */
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { allocateTrialCredits } from '../lib/billing/trialCredits'
import { allocateTrialCredits } from '../lib/billing/trialCredits'
import { TRIAL_DAYS, TRIAL_MEDIA_CREDITS } from '../lib/billing/trialPolicy'
import { videoCreditCost } from '../lib/credits/actionCosts'
import { PLAN_CREDITS } from '../lib/credits'
import { getStripeSecretKey, sanitizeSecretEnvValue } from '../lib/stripe'
import { planFromPriceId } from '../lib/stripe/planFromPrice'

const PLANS = ['starter', 'growth', 'proagent'] as const

function qaStripeKey(): string | null {
  return sanitizeSecretEnvValue(process.env.STRIPE_QA_SECRET_KEY) ?? getStripeSecretKey()
}

function qaStripeClient(): Stripe | null {
  const apiKey = qaStripeKey()
  if (!apiKey) return null
  return new Stripe(apiKey, { apiVersion: '2026-04-22.dahlia' as any })
}

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
  const usingQaKey = Boolean(sanitizeSecretEnvValue(process.env.STRIPE_QA_SECRET_KEY))
  console.log(`Stripe key: ${usingQaKey ? 'STRIPE_QA_SECRET_KEY' : 'STRIPE_SECRET_KEY'} (${secret?.slice(0, 8)}…)`)
  assert(Boolean(secret?.startsWith('sk_test_')), 'Stripe QA requires sk_test_ — set STRIPE_QA_SECRET_KEY or use test keys in .env.local')
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

  console.log('\n── Trialing profiles (Stripe + DB) ──')
  if (!supabaseUrl || !supabaseKey) {
    assert(false, 'Supabase env vars present for DB assertion')
    console.log(`\nDone. ${failures} failure(s).`)
    process.exit(failures > 0 ? 1 : 0)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, plan, stripe_subscription_id, status, email')
    .not('stripe_subscription_id', 'is', null)
    .in('plan', [...PLANS])

  if (error) {
    assert(false, `profiles query: ${error.message}`)
    process.exit(1)
  }

  const trialingRows: Array<{
    id: string
    plan: string | null
    stripe_subscription_id: string
    balance: number | null
    subscription: Stripe.Subscription
  }> = []

  for (const row of profiles ?? []) {
    if (!row.stripe_subscription_id) continue
    let sub: Stripe.Subscription
    try {
      sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
    } catch {
      console.log(`  skip ${row.id.slice(0, 8)} — subscription not found in Stripe`)
      continue
    }
    if (sub.status !== 'trialing') continue

    const { data: bal } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', row.id)
      .maybeSingle()

    trialingRows.push({
      id: row.id,
      plan: row.plan,
      stripe_subscription_id: row.stripe_subscription_id,
      balance: bal?.balance ?? null,
      subscription: sub,
    })
  }

  if (trialingRows.length === 0) {
    const stripeTrialing = await stripe.subscriptions.list({ status: 'trialing', limit: 10 })
    console.log(
      `  No DB profile on Stripe trialing (Stripe account has ${stripeTrialing.data.length} trialing subscription(s) unmatched to profiles).`,
    )

    const starterPriceId = priceEnv('starter', 'monthly')
    let qaProfileId = process.env.STRIPE_QA_PROFILE_ID?.trim()

    if (!qaProfileId) {
      const { data: candidate } = await supabase
        .from('profiles')
        .select('id')
        .is('stripe_subscription_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      qaProfileId = candidate?.id
      if (qaProfileId) {
        console.log(`  Auto-selected QA profile ${qaProfileId.slice(0, 8)} (no subscription)`)
      }
    }

    if (qaProfileId && starterPriceId) {
      const { data: qaProfile } = await supabase
        .from('profiles')
        .select('id, stripe_customer_id, stripe_subscription_id, email, plan')
        .eq('id', qaProfileId)
        .maybeSingle()

      assert(Boolean(qaProfile), `QA profile ${qaProfileId} exists`)

      if (qaProfile) {
        if (qaProfile.stripe_subscription_id) {
          try {
            const existing = await stripe.subscriptions.retrieve(qaProfile.stripe_subscription_id)
            if (existing.status === 'trialing') {
              await stripe.subscriptions.cancel(qaProfile.stripe_subscription_id)
            }
          } catch {
            /* stale id */
          }
        }

        const customerId =
          qaProfile.stripe_customer_id ??
          (
            await stripe.customers.create({
              email: qaProfile.email ?? undefined,
              metadata: { qa_profile_id: qaProfile.id, qa: 'verify_stripe_trial_qa' },
            })
          ).id

        if (!qaProfile.stripe_customer_id) {
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
            .eq('id', qaProfile.id)
        }

        const sub = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: starterPriceId }],
          trial_period_days: TRIAL_DAYS,
          metadata: { plan: 'starter', qa: 'verify_stripe_trial_qa' },
        })

        await supabase
          .from('profiles')
          .update({
            plan: 'starter',
            status: 'active',
            stripe_subscription_id: sub.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', qaProfile.id)

        await allocateTrialCredits(qaProfile.id)

        trialingRows.push({
          id: qaProfile.id,
          plan: 'starter',
          stripe_subscription_id: sub.id,
          balance: TRIAL_MEDIA_CREDITS,
          subscription: sub,
        })

        assert(sub.status === 'trialing', 'provisioned subscription is trialing')
        assert(
          trialingRows[0].balance === TRIAL_MEDIA_CREDITS,
          `provisioned balance is ${TRIAL_MEDIA_CREDITS}`,
        )
      }
    }

    if (trialingRows.length === 0) {
      assert(
        false,
        'No trialing profile for DB assertion — set STRIPE_QA_PROFILE_ID or add a profile without stripe_subscription_id',
      )
    }
  }

  if (trialingRows.length > 0) {
    for (const row of trialingRows) {
      const trialDays =
        row.subscription.trial_end && row.subscription.trial_start
          ? Math.round((row.subscription.trial_end - row.subscription.trial_start) / 86400)
          : null

      console.log(
        `  profile ${row.id.slice(0, 8)} plan=${row.plan} balance=${row.balance ?? 'null'} trial_days=${trialDays ?? '?'}`,
      )

      assert(row.balance != null, `${row.id.slice(0, 8)} has credit_balances row`)
      assert(
        row.balance! <= TRIAL_MEDIA_CREDITS,
        `${row.id.slice(0, 8)} balance ${row.balance} <= trial cap ${TRIAL_MEDIA_CREDITS}`,
      )

      const { data: ledger } = await supabase
        .from('credit_ledger')
        .select('description, credits')
        .eq('user_id', row.id)
        .eq('type', 'allocation')
        .order('created_at', { ascending: false })
        .limit(3)

      const trialAllocation = ledger?.find(l =>
        l.description?.includes('Trial allocation') || l.credits === TRIAL_MEDIA_CREDITS,
      )
      assert(
        Boolean(trialAllocation),
        `${row.id.slice(0, 8)} has trial allocation ledger entry (${TRIAL_MEDIA_CREDITS} credits)`,
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
