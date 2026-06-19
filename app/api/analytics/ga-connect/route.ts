import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createOAuthState } from '@/lib/oauth-state'
import { gaOAuthRedirectUri } from '@/lib/oauthCallbackBase'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return redirect('/sign-in')

  const nonce = await createOAuthState(userId, 'google')
  const redirectUri = gaOAuthRedirectUri(req)

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/analytics.readonly',
    access_type:   'offline',
    prompt:        'consent',
    state:         nonce,
  })

  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
