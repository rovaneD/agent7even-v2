import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { ensurePaidSubscriptionForClerkUser } from '@/lib/billing/subscriptionGate'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()
  const gate = await ensurePaidSubscriptionForClerkUser(supabase, userId, email)

  if (!gate.ok) {
    return NextResponse.json({ ok: false })
  }

  return NextResponse.json({
    ok: true,
    plan: gate.profile.plan,
    redirect: `/foundation?plan=${encodeURIComponent(gate.profile.plan ?? 'starter')}`,
  })
}
