import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { consumeOAuthState } from '@/lib/oauth-state'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const nonce = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !nonce) {
    return NextResponse.redirect(`${APP_URL}/dashboard/analytics?ga_error=access_denied`)
  }

  // Validate nonce — single-use, bound to this provider, expires in 10 min
  const clerkId = await consumeOAuthState(nonce, 'google')
  if (!clerkId) {
    return NextResponse.redirect(`${APP_URL}/dashboard/analytics?ga_error=invalid_state`)
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri:  `${APP_URL}/api/analytics/ga-callback`,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()

  if (!tokens.refresh_token) {
    return NextResponse.redirect(`${APP_URL}/dashboard/analytics?ga_error=no_refresh_token`)
  }

  // Get Google account email
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const userInfo = await userInfoRes.json()

  // Save tokens to profile — scoped to the verified clerk_id from the nonce
  const supabase = createServiceClient()
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      ga_refresh_token: tokens.refresh_token,
      ga_oauth_email:   userInfo.email ?? null,
      ga_connected:     false, // true once property is also selected
    })
    .eq('clerk_user_id', clerkId)

  if (updateError) {
    return NextResponse.redirect(`${APP_URL}/dashboard/analytics?ga_error=save_failed`)
  }

  return NextResponse.redirect(`${APP_URL}/dashboard/analytics?ga_oauth=success`)
}
