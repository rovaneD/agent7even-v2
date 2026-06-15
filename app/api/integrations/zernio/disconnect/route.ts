import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'
import {
  collectZernioProfileIds,
  disconnectAllZernioProfiles,
  ZERNIO_TEARDOWN_COLUMNS,
} from '@/lib/social/zernioProfileIds'

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { platform } = body as { platform?: string }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, zernio_profile_id, zernio_profile_ids, zernio_connected_platforms')
    .eq('clerk_user_id', userId)
    .single()

  const zernioProfileIds = profile ? collectZernioProfileIds(profile) : []
  if (zernioProfileIds.length === 0) {
    return NextResponse.json({ error: 'No Zernio profile found' }, { status: 404 })
  }

  const primaryProfileId = (profile!.zernio_profile_id as string | null) ?? zernioProfileIds[0]

  if (platform) {
    const disconnected = await publisher.disconnectAccount(primaryProfileId, platform)
    if (!disconnected) {
      return NextResponse.json({ error: 'Failed to disconnect platform from Zernio' }, { status: 502 })
    }

    const existing = (profile!.zernio_connected_platforms as string[] | null) ?? []
    const remaining = await publisher.getConnectedPlatforms(primaryProfileId)
    const nextPlatforms = remaining.length > 0 ? remaining : existing.filter((p) => p !== platform)
    await supabase
      .from('profiles')
      .update({ zernio_connected_platforms: nextPlatforms })
      .eq('id', profile!.id)
    return NextResponse.json({ success: true, platform, remaining: nextPlatforms })
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
