import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { consumeOAuthState } from '@/lib/oauth-state'

// Use VERCEL_URL so the post-OAuth redirect returns to the same deployment
// (preview or production) that initiated the connect flow.
const APP_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL!

function safeReturnPath(returnTo: string | null): string {
  if (
    returnTo &&
    returnTo.startsWith('/dashboard') &&
    !returnTo.includes('://')
  ) {
    return returnTo.split('?')[0]
  }
  return '/dashboard/analytics'
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  // Log all params Zernio sends so we can confirm the exact callback shape
  const allParams: Record<string, string> = {}
  searchParams.forEach((v, k) => { allParams[k] = v })
  console.log('[zernio/callback] params:', JSON.stringify(allParams))

  const nonce     = searchParams.get('state')
  const connected = searchParams.get('connected')
  const platform  = searchParams.get('platform') ?? connected
  const profileId = searchParams.get('profileId')
  const accountId = searchParams.get('accountId')
  const username  = searchParams.get('username')
  const error     = searchParams.get('error')
  const returnPath = safeReturnPath(searchParams.get('returnTo'))

  if (error || !nonce || !platform) {
    console.log('[zernio/callback] missing state/platform — redirecting with error. nonce:', nonce, 'platform:', platform, 'error:', error)
    return NextResponse.redirect(`${APP_URL}${returnPath}?zernio_error=access_denied`)
  }

  // Validate nonce — single-use, bound to clerk_id + platform, expires in 10 min
  const clerkId = await consumeOAuthState(nonce, `zernio:${platform}`)
  if (!clerkId) {
    return NextResponse.redirect(`${APP_URL}${returnPath}?zernio_error=invalid_state`)
  }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, zernio_profile_id, zernio_profile_ids, zernio_connected_platforms')
    .eq('clerk_user_id', clerkId)
    .single()

  if (!profile) {
    return NextResponse.redirect(`${APP_URL}${returnPath}?zernio_error=profile_not_found`)
  }

  const existingIds = (profile.zernio_profile_ids as string[] | null) ?? []
  const updatedIds = profileId ? Array.from(new Set([...existingIds, profileId])) : existingIds
  const primaryId = profile.zernio_profile_id || profileId || null

  const updatePayload: Record<string, any> = {
    zernio_profile_ids: updatedIds,
  }
  if (primaryId && profile.zernio_profile_id !== primaryId) {
    updatePayload.zernio_profile_id = primaryId
  }

  if (profileId && (!profile.zernio_profile_id || !existingIds.includes(profileId))) {
    const { error: profileUpdateErr } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', profile.id)
    if (profileUpdateErr) {
      console.error('[zernio/callback] failed to store zernio_profile_id / zernio_profile_ids:', profileUpdateErr)
      return NextResponse.redirect(`${APP_URL}${returnPath}?zernio_error=save_failed`)
    }
  }

  const existing = (profile.zernio_connected_platforms as string[] | null) ?? []
  if (!existing.includes(platform)) {
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        zernio_connected_platforms: [...existing, platform],
        zernio_connected_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (updateErr) {
      console.error('[zernio/callback] failed to store connected platform:', updateErr)
      return NextResponse.redirect(`${APP_URL}${returnPath}?zernio_error=save_failed`)
    }
  }

  return NextResponse.redirect(
    `${APP_URL}${returnPath}?zernio_connected=${encodeURIComponent(platform)}${accountId ? `&zernio_account_id=${encodeURIComponent(accountId)}` : ''}${username ? `&zernio_username=${encodeURIComponent(username)}` : ''}`,
  )
}
