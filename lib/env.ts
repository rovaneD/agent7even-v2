// Fail-fast env validation. Import from instrumentation.ts so this runs at server startup.
// Usage: import { env } from '@/lib/env' — typed accessor, throws if var is missing.

type EnvSpec = {
  required: string[]
  featureGated: { feature: string; vars: string[] }[]
}

const SPEC: EnvSpec = {
  required: [
    // Clerk
    'CLERK_WEBHOOK_SIGNING_SECRET',
    // Supabase
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    // App
    'NEXT_PUBLIC_APP_URL',
    // Stripe core
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    // Subscription price IDs (all tiers live)
    'STRIPE_STARTER_MONTHLY_PRICE_ID',
    'STRIPE_STARTER_ANNUAL_PRICE_ID',
    'STRIPE_GROWTH_MONTHLY_PRICE_ID',
    'STRIPE_GROWTH_ANNUAL_PRICE_ID',
    'STRIPE_PROAGENT_MONTHLY_PRICE_ID',
    'STRIPE_PROAGENT_ANNUAL_PRICE_ID',
    // AI
    'OPENROUTER_API_KEY',
    // Email
    'RESEND_API_KEY',
    // Cron
    'CRON_SECRET',
    // Internal job execution
    'INTERNAL_JOB_SECRET',
  ],
  featureGated: [
    {
      feature: 'Team seats',
      vars: ['STRIPE_SEAT_PRICE_ID'],
    },
    {
      feature: 'Credit top-ups',
      vars: [
        'STRIPE_CREDITS_SMALL_PRICE_ID',
        'STRIPE_CREDITS_MEDIUM_PRICE_ID',
        'STRIPE_CREDITS_LARGE_PRICE_ID',
      ],
    },
    {
      feature: 'Google Analytics OAuth',
      vars: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
    },
    {
      feature: 'Google service account (Analytics data)',
      vars: ['GOOGLE_SA_CLIENT_EMAIL', 'GOOGLE_SA_PRIVATE_KEY'],
    },
    {
      feature: 'Meta Ads OAuth',
      vars: ['META_APP_ID', 'META_APP_SECRET'],
    },
    {
      feature: 'Foundation generate (Anthropic direct)',
      vars: ['ANTHROPIC_API_KEY'],
    },
  ],
}

function validateEnv() {
  const missingRequired = SPEC.required.filter((k) => !process.env[k])

  if (missingRequired.length > 0) {
    throw new Error(
      `[env] Missing required environment variable(s):\n  - ${missingRequired.join('\n  - ')}\n` +
        `Set these before starting the server. See .env.example.`,
    )
  }

  for (const group of SPEC.featureGated) {
    const missing = group.vars.filter((k) => !process.env[k])
    if (missing.length > 0) {
      console.warn(
        `[env] Feature "${group.feature}" missing var(s): ${missing.join(', ')}. ` +
          `That feature will be unavailable until they are set.`,
      )
    }
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (appUrl.includes('app.agent7even.com') && stripeKey.startsWith('sk_test_')) {
    console.warn(
      '[env] Production app URL with STRIPE_SECRET_KEY as a TEST key (sk_test_). ' +
        'Switch to live keys before accepting real payments.',
    )
  }
}

validateEnv()

type RequiredKey = (typeof SPEC.required)[number]

export const env = new Proxy({} as Record<RequiredKey | string, string>, {
  get(_target, prop: string) {
    const val = process.env[prop]
    if (val === undefined) {
      throw new Error(`[env] Accessed undefined env var "${prop}". Add it to lib/env.ts SPEC.`)
    }
    return val
  },
})
