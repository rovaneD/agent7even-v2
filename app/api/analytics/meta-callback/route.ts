import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { consumeOAuthState } from '@/lib/oauth-state'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const nonce = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'
  const redirectUri = `${appUrl}/api/analytics/meta-callback`

  if (error) {
    console.error('Meta OAuth error:', error)
    return NextResponse.redirect(`${appUrl}/dashboard/analytics?meta_error=access_denied`)
  }

  if (!code || !nonce) {
    return NextResponse.redirect(`${appUrl}/dashboard/analytics?meta_error=missing_params`)
  }

  // Validate nonce — single-use, bound to this provider, expires in 10 min
  const clerkId = await consumeOAuthState(nonce, 'meta')
  if (!clerkId) {
    return NextResponse.redirect(`${appUrl}/dashboard/analytics?meta_error=invalid_state`)
  }

  try {
    // ── Step 1: Exchange code for short-lived token ──────────────────────────
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        client_id:     process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        redirect_uri:  redirectUri,
        code,
      }).toString()
    )

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('Meta token exchange failed:', tokenData)
      return NextResponse.redirect(`${appUrl}/dashboard/analytics?meta_error=token_failed`)
    }

    const shortLivedToken = tokenData.access_token

    // ── Step 2: Exchange for long-lived token (60 days) ─────────────────────
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type:       'fb_exchange_token',
        client_id:        process.env.META_APP_ID!,
        client_secret:    process.env.META_APP_SECRET!,
        fb_exchange_token: shortLivedToken,
      }).toString()
    )

    const longTokenData = await longTokenRes.json()
    const accessToken   = longTokenData.access_token ?? shortLivedToken

    // ── Step 3: Fetch user's ad accounts ────────────────────────────────────
    const adAccountsRes  = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
    )
    const adAccountsData = await adAccountsRes.json()
    const adAccounts     = adAccountsData.data ?? []

    const activeAdAccount = adAccounts.find((a: { account_status: number }) => a.account_status === 1) ?? adAccounts[0]
    const adAccountId     = activeAdAccount?.id ?? null

    // ── Step 4: Fetch Instagram business accounts ────────────────────────────
    const pagesRes  = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`
    )
    const pagesData = await pagesRes.json()
    const pages     = pagesData.data ?? []

    const igPage      = pages.find((p: { instagram_business_account?: { id: string } }) => p.instagram_business_account)
    const igAccountId = igPage?.instagram_business_account?.id ?? null

    let igHandle = null
    if (igAccountId) {
      const igRes  = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}?fields=username,name&access_token=${accessToken}`
      )
      const igData = await igRes.json()
      igHandle = igData.username ?? null
    }

    // ── Step 5: Store in Supabase — scoped to the verified clerk_id ──────────
    const supabase = createServiceClient()

    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        meta_access_token:  accessToken,
        meta_ad_account_id: adAccountId,
        meta_ig_account_id: igAccountId,
        ...(igHandle ? { instagram_handle: igHandle } : {}),
        meta_connected: true,
        updated_at:     new Date().toISOString(),
      })
      .eq('clerk_user_id', clerkId)

    if (dbError) {
      console.error('Supabase update error (meta-callback):', dbError)
      return NextResponse.redirect(`${appUrl}/dashboard/analytics?meta_error=db_error`)
    }

    return NextResponse.redirect(`${appUrl}/dashboard/analytics?meta_connected=true`)
  } catch (err) {
    console.error('Meta callback error:', err)
    return NextResponse.redirect(`${appUrl}/dashboard/analytics?meta_error=unknown`)
  }
}
