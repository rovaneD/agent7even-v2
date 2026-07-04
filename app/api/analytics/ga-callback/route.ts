import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { consumeOAuthState } from '@/lib/oauth-state'
import { getGoogleOAuthCredentials } from '@/lib/googleOAuth'
import { gaOAuthRedirectUri, oauthCallbackBaseFromRequest } from '@/lib/oauthCallbackBase'
import { saveGaOAuthTokensForClerkUser } from '@/lib/analytics/gaOAuthProfile'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const nonce = searchParams.get('state')
  const error = searchParams.get('error')
  const appBase = oauthCallbackBaseFromRequest(req)
  const redirectUri = gaOAuthRedirectUri(req)

  if (error || !code || !nonce) {
    return NextResponse.redirect(`${appBase}/dashboard/analytics?ga_error=access_denied`)
  }

  const clerkId = await consumeOAuthState(nonce, 'google')
  if (!clerkId) {
    return NextResponse.redirect(`${appBase}/dashboard/analytics?ga_error=invalid_state`)
  }

  const creds = getGoogleOAuthCredentials()
  if (!creds) {
    console.error('[ga-callback] GOOGLE_OAUTH_CLIENT_ID/SECRET missing or invalid on this deployment')
    return NextResponse.redirect(`${appBase}/dashboard/analytics?ga_error=invalid_client`)
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()

  if (tokens.error) {
    console.error('[ga-callback] token exchange failed:', tokens.error, tokens.error_description)
    const gaError = tokens.error === 'invalid_client' ? 'invalid_client' : 'token_exchange_failed'
    return NextResponse.redirect(`${appBase}/dashboard/analytics?ga_error=${gaError}`)
  }

  if (!tokens.access_token) {
    console.error('[ga-callback] token exchange returned no access_token')
    return NextResponse.redirect(`${appBase}/dashboard/analytics?ga_error=token_exchange_failed`)
  }

  if (!tokens.refresh_token) {
    console.error('[ga-callback] token exchange returned access_token but no refresh_token')
    return NextResponse.redirect(`${appBase}/dashboard/analytics?ga_error=no_refresh_token`)
  }

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const userInfo = await userInfoRes.json()
  const oauthEmail = (userInfo.email as string | undefined) ?? null

  const supabase = createServiceClient()
  const saved = await saveGaOAuthTokensForClerkUser(
    supabase,
    clerkId,
    { refreshToken: tokens.refresh_token, oauthEmail },
    oauthEmail,
  )

  if (!saved.ok) {
    console.error('[ga-callback] save tokens failed:', saved.reason)
    return NextResponse.redirect(`${appBase}/dashboard/analytics?ga_error=save_failed`)
  }

  return NextResponse.redirect(`${appBase}/dashboard/analytics?ga_oauth=success`)
}
