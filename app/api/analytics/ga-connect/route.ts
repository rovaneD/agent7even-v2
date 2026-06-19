import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createOAuthState } from '@/lib/oauth-state'
import { gaOAuthRedirectUri } from '@/lib/oauthCallbackBase'
import { createServiceClient } from '@/lib/supabase/server'

async function revokeGoogleRefreshToken(token: string) {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    })
  } catch {
    // Non-fatal — reconnect may still succeed with prompt=consent
  }
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return redirect('/sign-in')

  // Drop stale Google grants so reconnect returns a fresh refresh token.
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('ga_refresh_token')
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.ga_refresh_token) {
    await revokeGoogleRefreshToken(profile.ga_refresh_token)
  }

  const nonce = await createOAuthState(userId, 'google')
  const redirectUri = gaOAuthRedirectUri(req)

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/analytics.readonly',
    access_type:   'offline',
    prompt:        'consent select_account',
    state:         nonce,
  })

  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
