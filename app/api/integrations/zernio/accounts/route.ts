import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { collectZernioProfileIds } from '@/lib/social/zernioProfileIds'
import { getTenantConnectedAccounts } from '@/lib/social/publisher'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const profile = await resolveClerkProfile<{
    plan: string | null
    zernio_profile_id: string | null
    zernio_profile_ids: string[] | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    created_at: string
    id: string
  }>(
    supabase,
    userId,
    'id, plan, zernio_profile_id, zernio_profile_ids',
    email,
  )

  if (!profile?.plan) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }

  const profileIds = collectZernioProfileIds(profile)
  if (profileIds.length === 0) {
    return NextResponse.json({ accounts: [] })
  }

  const accounts = await getTenantConnectedAccounts(profileIds)
  return NextResponse.json({ accounts }, { headers: { 'Cache-Control': 'no-store' } })
}
