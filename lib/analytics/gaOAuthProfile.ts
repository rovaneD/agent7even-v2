import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { refreshGoogleAccessToken, type GoogleTokenRefreshResult } from '@/lib/googleOAuth'

const GA_PROFILE_SELECT =
  'id, ga_refresh_token, ga_measurement_id, ga_oauth_email, ga_connected'

export type GaProfileRow = {
  id: string
  ga_refresh_token: string | null
  ga_measurement_id: string | null
  ga_oauth_email: string | null
  ga_connected: boolean | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: string | null
  created_at: string
}

export async function getGaProfileForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<GaProfileRow | null> {
  return resolveClerkProfile<GaProfileRow>(supabase, clerkUserId, GA_PROFILE_SELECT, email)
}

/** Refresh GA access token; if canonical token is stale, try sibling profile rows and migrate. */
export async function refreshGaAccessTokenForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<
  | { ok: true; accessToken: string; profileId: string }
  | { ok: false; reason: string; needsReconnect: boolean }
> {
  const canonical = await getGaProfileForClerkUser(supabase, clerkUserId, email)
  if (!canonical?.ga_refresh_token) {
    return { ok: false, reason: 'Not connected', needsReconnect: true }
  }

  const primary = await refreshGoogleAccessToken(canonical.ga_refresh_token)
  if (primary.accessToken) {
    return { ok: true, accessToken: primary.accessToken, profileId: canonical.id }
  }

  const { data: siblings } = await supabase
    .from('profiles')
    .select(GA_PROFILE_SELECT)
    .eq('clerk_user_id', clerkUserId)
    .not('ga_refresh_token', 'is', null)

  for (const row of (siblings ?? []) as GaProfileRow[]) {
    if (row.id === canonical.id || !row.ga_refresh_token) continue
    const sibling = await refreshGoogleAccessToken(row.ga_refresh_token)
    if (!sibling.accessToken) continue

    await supabase
      .from('profiles')
      .update({
        ga_refresh_token: row.ga_refresh_token,
        ga_oauth_email: row.ga_oauth_email ?? canonical.ga_oauth_email,
      })
      .eq('id', canonical.id)

    return { ok: true, accessToken: sibling.accessToken, profileId: canonical.id }
  }

  const reason = primary.error ?? 'Token refresh failed — reconnect Google Analytics.'
  const needsReconnect =
    primary.errorCode === 'invalid_grant' ||
    primary.errorCode === 'invalid_client' ||
    primary.error?.toLowerCase().includes('revoked') ||
    primary.error?.toLowerCase().includes('expired')

  return { ok: false, reason, needsReconnect: needsReconnect || !primary.errorCode }
}

export type GaOAuthTokenPayload = {
  refreshToken: string
  oauthEmail: string | null
}

/** Persist GA OAuth tokens on the canonical profile row. */
export async function saveGaOAuthTokensForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  tokens: GaOAuthTokenPayload,
  clerkEmail?: string | null,
): Promise<{ ok: true; profileId: string } | { ok: false; reason: string }> {
  const profile = await getGaProfileForClerkUser(supabase, clerkUserId, clerkEmail)
  if (!profile) {
    return { ok: false, reason: 'Profile not found' }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      ga_refresh_token: tokens.refreshToken,
      ga_oauth_email: tokens.oauthEmail,
      ga_connected: false,
    })
    .eq('id', profile.id)
    .select('id')
    .single()

  if (error || !data?.id) {
    console.error('[gaOAuth] save tokens failed:', error?.message ?? 'no row updated')
    return { ok: false, reason: 'Failed to save Google connection' }
  }

  return { ok: true, profileId: data.id }
}

export type { GoogleTokenRefreshResult }
