import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { platform } = body as { platform?: string }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, zernio_profile_id, zernio_connected_platforms')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.zernio_profile_id) {
    return NextResponse.json({ error: 'No Zernio profile found' }, { status: 404 })
  }

  const zernioProfileId = profile.zernio_profile_id as string

  if (platform) {
    // Disconnect a single platform
    await publisher.disconnectAccount(zernioProfileId, platform)
    const existing = (profile.zernio_connected_platforms as string[] | null) ?? []
    await supabase
      .from('profiles')
      .update({ zernio_connected_platforms: existing.filter((p) => p !== platform) })
      .eq('id', profile.id)
    return NextResponse.json({ success: true, platform })
  } else {
    // Disconnect all — called from Stripe webhook or explicit full disconnect
    await publisher.disconnectAllAccounts(zernioProfileId)
    await supabase
      .from('profiles')
      .update({ zernio_connected_platforms: [], zernio_profile_id: null })
      .eq('id', profile.id)
    return NextResponse.json({ success: true, disconnectedAll: true })
  }
}
