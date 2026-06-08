import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'
import { createOAuthState } from '@/lib/oauth-state'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { platform } = body as { platform?: string }
  if (!platform) return NextResponse.json({ error: 'platform is required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan, company_name, zernio_profile_id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  if (!profile.plan) {
    return NextResponse.json(
      { error: 'active_plan_required', message: 'Connect your accounts after activating your plan.' },
      { status: 403 },
    )
  }

  // Create Zernio profile on first connection for this tenant
  let zernioProfileId = (profile.zernio_profile_id as string | null) ?? null
  if (!zernioProfileId) {
    try {
      zernioProfileId = await publisher.createProfile(
        (profile.company_name as string | null) ?? `tenant-${profile.id}`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[zernio/connect] createProfile failed:', msg)
      return NextResponse.json({ error: `Zernio profile creation failed: ${msg}` }, { status: 502 })
    }
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ zernio_profile_id: zernioProfileId })
      .eq('id', profile.id)
    if (updateErr) {
      console.error('[zernio/connect] failed to store profile_id:', updateErr)
    }
  }

  // Create CSRF nonce — provider is scoped per platform so two simultaneous connects don't collide
  const nonce = await createOAuthState(userId, `zernio:${platform}`)
  const callbackUrl = `${APP_URL}/api/integrations/zernio/callback?state=${nonce}&platform=${encodeURIComponent(platform)}`

  let authUrl: string
  try {
    authUrl = await publisher.getConnectUrl(zernioProfileId, platform, callbackUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[zernio/connect] getConnectUrl failed:', msg)
    return NextResponse.json({ error: `Zernio connect URL failed: ${msg}` }, { status: 502 })
  }

  return NextResponse.json({ authUrl })
}
