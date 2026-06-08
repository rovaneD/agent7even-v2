import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { consumeOAuthState } from '@/lib/oauth-state'

// Use VERCEL_URL so the post-OAuth redirect returns to the same deployment
// (preview or production) that initiated the connect flow.
const APP_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  // Log all params Zernio sends so we can confirm the exact callback shape
  const allParams: Record<string, string> = {}
  searchParams.forEach((v, k) => { allParams[k] = v })
  console.log('[zernio/callback] params:', JSON.stringify(allParams))

  const nonce    = searchParams.get('state')
  const platform = searchParams.get('platform')
  const error    = searchParams.get('error')

  if (error || !nonce || !platform) {
    console.log('[zernio/callback] missing state/platform — redirecting with error. nonce:', nonce, 'platform:', platform, 'error:', error)
    return NextResponse.redirect(`${APP_URL}/dashboard/analytics?zernio_error=access_denied`)
  }

  // Validate nonce — single-use, bound to clerk_id + platform, expires in 10 min
  const clerkId = await consumeOAuthState(nonce, `zernio:${platform}`)
  if (!clerkId) {
    return NextResponse.redirect(`${APP_URL}/dashboard/analytics?zernio_error=invalid_state`)
  }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, zernio_connected_platforms')
    .eq('clerk_user_id', clerkId)
    .single()

  if (!profile) {
    return NextResponse.redirect(`${APP_URL}/dashboard/analytics?zernio_error=profile_not_found`)
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
      return NextResponse.redirect(`${APP_URL}/dashboard/analytics?zernio_error=save_failed`)
    }
  }

  return NextResponse.redirect(
    `${APP_URL}/dashboard/analytics?zernio_connected=${encodeURIComponent(platform)}`,
  )
}
