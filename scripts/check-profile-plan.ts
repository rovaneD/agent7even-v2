import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]
if (!email) {
  console.error('Usage: npx tsx --env-file=.env.local scripts/check-profile-plan.ts <email>')
  process.exit(1)
}

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await s
    .from('profiles')
    .select(
      'id, email, company_name, plan, status, role, is_account_owner, account_id, stripe_customer_id, stripe_subscription_id, onboarding_complete, foundation_complete, created_at, updated_at',
    )
    .ilike('email', email)
    .order('created_at', { ascending: true })

  if (error) {
    console.error(error)
    process.exit(1)
  }

  console.log(`profiles for ${email}: ${data?.length ?? 0}`)
  for (const p of data ?? []) {
    console.log('---')
    console.log(
      JSON.stringify(
        {
          id: p.id,
          company: p.company_name,
          plan: p.plan,
          status: p.status,
          role: p.role,
          owner: p.is_account_owner,
          account_id: p.account_id,
          stripe_customer: p.stripe_customer_id,
          stripe_sub: p.stripe_subscription_id,
          onboarding: p.onboarding_complete,
          foundation: p.foundation_complete,
          created: p.created_at?.slice(0, 19),
          updated: p.updated_at?.slice(0, 19),
        },
        null,
        2,
      ),
    )
  }

  const profile = data?.[data.length - 1]
  if (profile?.id) {
    const { data: ledger } = await s
      .from('credit_ledger')
      .select('type, credits, description, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5)
    console.log('--- recent credit ledger ---')
    for (const row of ledger ?? []) {
      console.log(`${row.created_at?.slice(0, 19)} | ${row.type} | ${row.credits} | ${row.description}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
