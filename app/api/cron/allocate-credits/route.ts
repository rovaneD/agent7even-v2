// app/api/cron/allocate-credits/route.ts
// Runs 1st of every month — allocates credits per plan
// Add to vercel.json: { "path": "/api/cron/allocate-credits", "schedule": "0 0 1 * *" }

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const PLAN_CREDITS: Record<string, number> = {
  starter:  100,
  growth:   350,
  proagent: 1000,
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch all active paid profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, plan')
    .eq('status', 'active')
    .in('plan', ['starter', 'growth', 'proagent'])

  if (!profiles?.length) return NextResponse.json({ allocated: 0 })

  let allocated = 0

  for (const profile of profiles) {
    const credits = PLAN_CREDITS[profile.plan]
    if (!credits) continue

    // Upsert balance (reset to allocation — doesn't roll over)
    await supabase
      .from('credit_balances')
      .upsert({
        user_id:    profile.id,
        balance:    credits,
        updated_at: new Date().toISOString(),
      })

    // Log allocation to ledger
    await supabase.from('credit_ledger').insert({
      user_id:     profile.id,
      type:        'allocation',
      credits:     credits,
      balance_after: credits,
      description: `Monthly allocation — ${profile.plan} plan`,
    })

    allocated++
  }

  return NextResponse.json({ allocated })
}
