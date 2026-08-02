import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { consumeOAuthState } from '@/lib/oauth-state'
import { oauthCallbackBaseFromRequest } from '@/lib/oauthCallbackBase'
import {
  collectZernioProfileIds,
  isOwnedZernioCallbackProfileId,
} from '@/lib/social/zernioOwnedProfileIds'
import * as publisher from '@/lib/social/publisher'

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

function readOAuthNonce(searchParams: URLSearchParams): string | null {
  return searchParams.get('a7_nonce') ?? searchParams.get('state')
}

function parseUserProfile(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    return JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>
  } catch {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

async function persistConnectedPlatform(opts: {
  appBase: string
  clerkId: string
  platform: string
  profileId: string | null
  accountId?: string | null
  username?: string | null
  returnPath: string
}): Promise<NextResponse> {
  const supabase = createServiceClient()
  const profile = await resolveClerkProfile<{
    id: string
    zernio_profile_id: string | null
    zernio_profile_ids: string[] | null
    zernio_connected_platforms: string[] | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan: string | null
    created_at: string
  }>(
    supabase,
    opts.clerkId,
    'id, zernio_profile_id, zernio_profile_ids, zernio_connected_platforms',
  )

  if (!profile) {
    return NextResponse.redirect(`${opts.appBase}${opts.returnPath}?zernio_error=profile_not_found`)
  }

  // Never persist a callback profileId that was not already bound at connect time.
  // The shared Zernio API key makes an unbound id a cross-tenant takeover.
  if (!isOwnedZernioCallbackProfileId(profile, opts.profileId)) {
    console.error('[zernio/callback] rejected unbound profileId', {
      clerkId: opts.clerkId,
      profileId: opts.profileId,
      owned: collectZernioProfileIds(profile),
    })
    return NextResponse.redirect(`${opts.appBase}${opts.returnPath}?zernio_error=invalid_profile`)
  }

  const existing = (profile.zernio_connected_platforms as string[] | null) ?? []
  if (!existing.includes(opts.platform)) {
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        zernio_connected_platforms: [...existing, opts.platform],
        zernio_connected_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (updateErr) {
      console.error('[zernio/callback] failed to store connected platform:', updateErr)
      return NextResponse.redirect(`${opts.appBase}${opts.returnPath}?zernio_error=save_failed`)
    }
  }

  const q = new URLSearchParams({ zernio_connected: opts.platform })
  if (opts.accountId) q.set('zernio_account_id', opts.accountId)
  if (opts.username) q.set('zernio_username', opts.username)
  return NextResponse.redirect(`${opts.appBase}${opts.returnPath}?${q.toString()}`)
}

export async function GET(req: NextRequest) {
  const appBase = oauthCallbackBaseFromRequest(req)
  const { searchParams } = req.nextUrl

  const allParams: Record<string, string> = {}
  searchParams.forEach((v, k) => { allParams[k] = v })
  console.log('[zernio/callback] params:', JSON.stringify(allParams))

  const nonce = readOAuthNonce(searchParams)
  const connected = searchParams.get('connected')
  const platform = (searchParams.get('platform') ?? connected ?? '').toLowerCase()
  const profileId = searchParams.get('profileId')
  const accountId = searchParams.get('accountId')
  const username = searchParams.get('username')
  const error = searchParams.get('error')
  const returnPath = safeReturnPath(searchParams.get('returnTo'))
  const step = searchParams.get('step')

  if (error) {
    return NextResponse.redirect(`${appBase}${returnPath}?zernio_error=access_denied`)
  }

  // Headless Facebook — finish page selection on our domain (never send user to Zernio UI).
  if (step === 'select_page' && platform === 'facebook' && profileId) {
    const tempToken = searchParams.get('tempToken')
    const userProfile = parseUserProfile(searchParams.get('userProfile'))
    if (!nonce || !tempToken || !userProfile) {
      return NextResponse.redirect(`${appBase}${returnPath}?zernio_error=invalid_state`)
    }

    const clerkId = await consumeOAuthState(nonce, 'zernio:facebook')
    if (!clerkId) {
      return NextResponse.redirect(`${appBase}${returnPath}?zernio_error=invalid_state`)
    }

    // Ownership check before any Zernio mutation with attacker-controlled profileId.
    const supabase = createServiceClient()
    const earlyProfile = await resolveClerkProfile<{
      id: string
      zernio_profile_id: string | null
      zernio_profile_ids: string[] | null
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      plan: string | null
      created_at: string
    }>(supabase, clerkId, 'id, zernio_profile_id, zernio_profile_ids')
    if (!earlyProfile || !isOwnedZernioCallbackProfileId(earlyProfile, profileId)) {
      console.error('[zernio/callback] rejected unbound facebook profileId', {
        clerkId,
        profileId,
        owned: earlyProfile ? collectZernioProfileIds(earlyProfile) : [],
      })
      return NextResponse.redirect(`${appBase}${returnPath}?zernio_error=invalid_profile`)
    }

    try {
      const pages = await publisher.listFacebookPages(profileId, tempToken)
      if (pages.length === 0) {
        return NextResponse.redirect(`${appBase}${returnPath}?zernio_error=no_pages`)
      }

      const selected = await publisher.selectFacebookPage({
        profileId,
        pageId: pages[0].id,
        tempToken,
        userProfile,
        redirectUri: `${appBase}${returnPath}`,
      })

      return persistConnectedPlatform({
        appBase,
        clerkId,
        platform: 'facebook',
        profileId,
        accountId: selected.accountId ?? accountId,
        username: selected.username ?? username ?? pages[0].username ?? pages[0].name,
        returnPath,
      })
    } catch (err) {
      console.error('[zernio/callback] headless facebook select failed:', err)
      return NextResponse.redirect(`${appBase}${returnPath}?zernio_error=save_failed`)
    }
  }

  if (!nonce || !platform) {
    console.log('[zernio/callback] missing nonce/platform — redirecting with error. nonce:', nonce, 'platform:', platform)
    return NextResponse.redirect(`${appBase}${returnPath}?zernio_error=access_denied`)
  }

  const clerkId = await consumeOAuthState(nonce, `zernio:${platform}`)
  if (!clerkId) {
    return NextResponse.redirect(`${appBase}${returnPath}?zernio_error=invalid_state`)
  }

  return persistConnectedPlatform({
    appBase,
    clerkId,
    platform,
    profileId,
    accountId,
    username,
    returnPath,
  })
}
