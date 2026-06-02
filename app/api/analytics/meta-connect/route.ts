import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createOAuthState } from '@/lib/oauth-state'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return redirect('/sign-in')

  const nonce = await createOAuthState(userId, 'meta')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'

  const scopes = [
    'ads_read',
    'ads_management',
    'business_management',
    'pages_read_engagement',
    'pages_show_list',
    'public_profile',
  ].join(',')

  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID!,
    redirect_uri:  `${appUrl}/api/analytics/meta-callback`,
    scope:         scopes,
    response_type: 'code',
    state:         nonce,
  })

  return redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`)
}
