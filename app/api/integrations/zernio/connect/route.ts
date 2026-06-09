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
    .select('id, plan, company_name, zernio_profile_id, zernio_profile_ids')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  if (!profile.plan) {
    return NextResponse.json(
      { error: 'active_plan_required', message: 'Connect your accounts after activating your plan.' },
      { status: 403 },
    )
  }

  // Create Zernio profile on first connection for this tenant.
  // Name includes a profile ID suffix to guarantee uniqueness across tenants.
  let zernioProfileId = (profile.zernio_profile_id as string | null) ?? null
  const zernioProfileIds = (profile.zernio_profile_ids as string[] | null) ?? []

  if (!zernioProfileId && zernioProfileIds.length > 0) {
    zernioProfileId = zernioProfileIds[0]
  }

  if (!zernioProfileId) {
    const baseName = (profile.company_name as string | null) ?? 'tenant'
    const profileName = `${baseName}-${(profile.id as string).slice(0, 8)}`

    try {
      zernioProfileId = await publisher.createProfile(profileName)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[zernio/connect] createProfile error:', msg)

      // Any failure (already exists, 400, 409, 5xx) → attempt recovery via list.
      // Profile may have been created in a prior session with a different name format.
      console.warn('[zernio/connect] attempting recovery via listProfiles')
      const profiles = await publisher.listProfiles()
      console.log('[zernio/connect] profiles found:', JSON.stringify(profiles.map(p => ({ id: p.id, name: p.name }))))

      const recovered = profiles.find((p) => p.name === profileName) ?? null

      if (recovered?.id) {
        console.log('[zernio/connect] recovered profile id:', recovered.id, 'name:', recovered.name)
        zernioProfileId = recovered.id
      } else {
        console.error('[zernio/connect] could not recover profile. profiles:', JSON.stringify(profiles))
        return NextResponse.json(
          { error: 'Could not create or recover Zernio profile. Please contact support.' },
          { status: 502 },
        )
      }
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        zernio_profile_id: zernioProfileId,
        zernio_profile_ids: Array.from(new Set([...zernioProfileIds, zernioProfileId])),
      })
      .eq('id', profile.id)
    if (updateErr) {
      console.error('[zernio/connect] failed to store profile_id:', updateErr)
    }
  }

  // Use VERCEL_URL for callback base so preview deployments don't redirect
  // to the main-branch deployment (which may not have this route).
  // VERCEL_URL is set automatically by Vercel for every deployment (no https:// prefix).
  const callbackBase = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : APP_URL

  // Create CSRF nonce — provider is scoped per platform so two simultaneous connects don't collide
  const nonce = await createOAuthState(userId, `zernio:${platform}`)
  const callbackUrl = `${callbackBase}/api/integrations/zernio/callback?state=${nonce}`
  console.log('[zernio/connect] callbackUrl:', callbackUrl)

  let authUrl: string
  try {
    authUrl = await publisher.getConnectUrl(zernioProfileId, platform, callbackUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[zernio/connect] getConnectUrl failed:', msg)

    // Zernio free tier allows only 2 connected accounts
    if (msg.includes('402') || msg.includes('PAYMENT_REQUIRED') || msg.includes('free_tier_exceeded')) {
      return NextResponse.json(
        { error: 'payment_required', message: 'Your Zernio account has reached the free tier limit (2 accounts). Add a payment method at zernio.com/dashboard to connect more.' },
        { status: 402 },
      )
    }

    return NextResponse.json({ error: `Zernio connect URL failed: ${msg}` }, { status: 502 })
  }

  return NextResponse.json({ authUrl })
}
