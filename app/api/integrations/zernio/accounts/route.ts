import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { collectZernioProfileIds } from '@/lib/social/zernioProfileIds'
import { getTenantConnectedAccounts } from '@/lib/social/publisher'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, zernio_profile_id, zernio_profile_ids')
    .eq('clerk_user_id', userId)
    .single()

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
