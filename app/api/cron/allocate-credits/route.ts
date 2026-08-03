// app/api/cron/allocate-credits/route.ts
// Runs 1st of every month — allocates credits per plan
// Add to vercel.json: { "path": "/api/cron/allocate-credits", "schedule": "0 0 1 * *" }

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { PLAN_CREDITS, allocatePlanCredits } from '@/lib/credits'

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
    if (!PLAN_CREDITS[profile.plan]) continue

    const { data: row } = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', profile.id)
      .maybeSingle()

    if (row?.stripe_subscription_id) {
      const { isProfileOnTrial } = await import('@/lib/billing/trialPolicy')
      if (await isProfileOnTrial({ stripe_subscription_id: row.stripe_subscription_id })) {
        continue
      }
    }

    // Preserve unused purchased top-ups; skip if this UTC month already allocated
    // so a double cron fire cannot wipe surplus after the first successful write.
    const granted = await allocatePlanCredits(profile.id, profile.plan, {
      skipIfAllocatedThisMonth: true,
    })
    if (granted != null) allocated++
  }

  return NextResponse.json({ allocated })
}
