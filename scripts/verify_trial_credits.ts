import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { allocateTrialCredits } from '../lib/billing/trialCredits'
import { TRIAL_DAYS, TRIAL_MEDIA_CREDITS } from '../lib/billing/trialPolicy'
import { videoCreditCost } from '../lib/credits/actionCosts'
import { PLAN_CREDITS } from '../lib/credits'
import { getStripeSecretKey, sanitizeSecretEnvValue } from '../lib/stripe'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

function qaStripeKey(): string | null {
  return sanitizeSecretEnvValue(process.env.STRIPE_QA_SECRET_KEY) ?? getStripeSecretKey()
}

function qaStripeClient(): Stripe | null {
  const apiKey = qaStripeKey()
  if (!apiKey) return null
  return new Stripe(apiKey, { apiVersion: '2026-04-22.dahlia' as any })
}

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

  const stripe = qaStripeClient()
  const secret = qaStripeKey()
  const testMode = secret?.startsWith('sk_test_') ?? false
  assert(testMode, 'Stripe QA requires sk_test_ (STRIPE_QA_SECRET_KEY or test STRIPE_SECRET_KEY)')

  const { data: subscribedProfiles, error } = await supabase
    .from('profiles')
    .select('id, plan, stripe_subscription_id, stripe_customer_id, status')
    .not('stripe_subscription_id', 'is', null)
    .in('plan', ['starter', 'growth', 'proagent'])

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  console.log('\n── Trialing profile DB assertions ──')
  let trialingCount = 0

  if (stripe && testMode) {
    for (const row of subscribedProfiles ?? []) {
      if (!row.stripe_subscription_id) continue
      let sub: Stripe.Subscription
      try {
        sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
      } catch {
        continue
      }
      if (sub.status !== 'trialing') continue

      trialingCount++
      const { data: bal } = await supabase
        .from('credit_balances')
        .select('balance')
        .eq('user_id', row.id)
        .maybeSingle()

      const balance = bal?.balance ?? null
      console.log(
        `  trialing ${row.id.slice(0, 8)} plan=${row.plan} profile_status=${row.status} balance=${balance ?? 'null'}`,
      )

      assert(balance != null, `${row.id.slice(0, 8)} trialing profile has credit_balances row`)
      assert(
        balance! <= TRIAL_MEDIA_CREDITS,
        `${row.id.slice(0, 8)} balance ${balance} <= ${TRIAL_MEDIA_CREDITS}`,
      )

      const trialEndDays =
        sub.trial_end && sub.trial_start
          ? Math.round((sub.trial_end - sub.trial_start) / 86400)
          : null
      if (trialEndDays != null && trialEndDays !== TRIAL_DAYS) {
        console.log(
          `  note: ${row.id.slice(0, 8)} trial length ${trialEndDays}d (grandfathered — not ${TRIAL_DAYS}d)`,
        )
      }
    }
  }

  if (trialingCount === 0) {
    const qaProfileId = process.env.STRIPE_QA_PROFILE_ID?.trim()
    const starterPriceId =
      process.env.STRIPE_QA_STARTER_MONTHLY_PRICE_ID?.trim() ??
      process.env.STRIPE_STARTER_MONTHLY_PRICE_ID?.trim()

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

    if (qaProfileId && starterPriceId && stripe && testMode) {
      console.log(`\n  Provisioning trialing subscription on QA profile ${qaProfileId.slice(0, 8)}…`)
      const { data: qaProfile } = await supabase
        .from('profiles')
        .select('id, stripe_customer_id, stripe_subscription_id, email')
        .eq('id', qaProfileId)
        .maybeSingle()

      assert(Boolean(qaProfile), `STRIPE_QA_PROFILE_ID ${qaProfileId} exists`)

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
              metadata: { qa_profile_id: qaProfile.id },
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
          metadata: { plan: 'starter', qa: 'verify_trial_credits' },
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

        const { data: balAfter } = await supabase
          .from('credit_balances')
          .select('balance')
          .eq('user_id', qaProfile.id)
          .maybeSingle()

        assert(sub.status === 'trialing', 'provisioned subscription is trialing')
        assert(balAfter?.balance === TRIAL_MEDIA_CREDITS, `provisioned balance is ${TRIAL_MEDIA_CREDITS}`)
        trialingCount = 1
      }
    } else if (!starterPriceId || !stripe || !testMode) {
      console.log(
        '  No trialing profiles in DB. Requires sk_test_ and STRIPE_STARTER_MONTHLY_PRICE_ID.',
      )
      assert(false, 'live trialing-profile DB assertion (none found)')
    } else {
      console.log(
        '  No trialing profiles and no eligible QA profile (need a row with null stripe_subscription_id).',
      )
      assert(false, 'live trialing-profile DB assertion (none found)')
    }
  } else {
    assert(trialingCount >= 1, `found ${trialingCount} trialing profile(s)`)
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
