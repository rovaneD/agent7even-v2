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

    const granted = await allocatePlanCredits(profile.id, profile.plan)
    if (granted != null) allocated++
  }

  return NextResponse.json({ allocated })
}
