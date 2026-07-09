import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import {
  collectZernioProfileIds,
  disconnectAllZernioProfiles,
  disconnectPlatformFromTenant,
  syncTenantConnectedPlatforms,
  ZERNIO_TEARDOWN_COLUMNS,
} from '@/lib/social/zernioProfileIds'

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { platform, accountId } = body as { platform?: string; accountId?: string }

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()
  const profile = await resolveClerkProfile<{
    id: string
    zernio_profile_id: string | null
    zernio_profile_ids: string[] | null
    zernio_connected_platforms: string[] | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan: string | null
    created_at: string
  }>(
    supabase,
    userId,
    'id, zernio_profile_id, zernio_profile_ids, zernio_connected_platforms',
    email,
  )

  const zernioProfileIds = profile ? collectZernioProfileIds(profile) : []
  if (zernioProfileIds.length === 0) {
    return NextResponse.json({ error: 'No connected profile found' }, { status: 404 })
  }

  if (platform) {
    const { ok } = await disconnectPlatformFromTenant(zernioProfileIds, platform, accountId)
    const remaining = await syncTenantConnectedPlatforms(zernioProfileIds)

    if (!ok && remaining.some((p) => p === platform.toLowerCase())) {
      return NextResponse.json({ error: 'Failed to disconnect account. Please try again.' }, { status: 502 })
    }

    await supabase
      .from('profiles')
      .update({ zernio_connected_platforms: remaining })
      .eq('id', profile!.id)

    return NextResponse.json({ success: true, platform, remaining })
  }

  const teardownResults = await disconnectAllZernioProfiles(zernioProfileIds)
  await supabase
    .from('profiles')
    .update(ZERNIO_TEARDOWN_COLUMNS)
    .eq('id', profile!.id)

  return NextResponse.json({
    success: true,
    disconnectedAll: true,
    profiles: teardownResults,
  })
}
