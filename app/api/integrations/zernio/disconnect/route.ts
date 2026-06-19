import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, zernio_profile_id, zernio_profile_ids, zernio_connected_platforms')
    .eq('clerk_user_id', userId)
    .single()

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
