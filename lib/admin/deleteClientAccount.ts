import { createClerkClient } from '@clerk/backend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { disconnectAllZernioProfiles, collectZernioProfileIds } from '@/lib/social/zernioProfileIds'
import { getStripeClient } from '@/lib/stripe'

export type DeleteClientAccountResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

/** Minimal Stripe surface used before irreversible account deletion. */
export type StripeCancelClient = {
  subscriptions: {
    retrieve: (id: string) => Promise<{ status: string }>
    cancel: (id: string) => Promise<unknown>
  }
}

/** Stripe errors that mean the subscription is already gone — safe to continue delete. */
export function isBenignStripeCancelError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = 'code' in err ? String((err as { code?: unknown }).code ?? '') : ''
  return code === 'resource_missing'
}

/**
 * Cancel a live Stripe subscription before deleting the profile.
 * Returns null when teardown succeeded (or is already canceled/missing).
 * Fails closed when Stripe is misconfigured or cancel/retrieve fails.
 */
export async function cancelStripeSubscriptionBeforeDelete(
  subscriptionId: string,
  stripe: StripeCancelClient | null,
): Promise<DeleteClientAccountResult | null> {
  if (!stripe) {
    return {
      ok: false,
      error:
        'Billing is not configured; cannot cancel the Stripe subscription before deleting this account.',
      status: 503,
    }
  }

  try {
    const existing = await stripe.subscriptions.retrieve(subscriptionId)
    if (existing.status === 'canceled') return null
    await stripe.subscriptions.cancel(subscriptionId)
    return null
  } catch (err) {
    if (isBenignStripeCancelError(err)) return null
    console.error('[deleteClientAccount] Stripe cancel failed:', err)
    return {
      ok: false,
      error:
        'Failed to cancel the Stripe subscription before deleting this account. Cancel it in Stripe and retry.',
      status: 502,
    }
  }
}

const USER_ID_TABLES = [
  'agent_constraints',
  'agent_outputs',
  'agent_schedules',
  'agent_tasks',
  'brand_answers',
  'brand_documents',
  'brand_kit_assets',
  'brand_kit_colors',
  'brand_kit_fonts',
  'brand_kit_sections',
  'campaigns',
  'chat_sessions',
  'creative_asset_folders',
  'creative_assets',
  'credit_balances',
  'credit_ledger',
  'credit_topups',
  'daily_digests',
  'foundation_documents',
  'foundation_field_scores',
  'maya_sessions',
  'orchestration_sessions',
  'project_inquiries',
  'notifications',
  'orders',
  'support_tickets',
  'client_activity_log',
  'admin_notes',
  'zernio_api_usage',
] as const

const PROFILE_ID_TABLES = [
  'foundation_knowledge',
  'foundation_changelog',
  'foundation_proposals',
  'analytics_briefings',
] as const

type ClientProfileRow = {
  id: string
  email: string | null
  clerk_user_id: string | null
  role: string | null
  stripe_subscription_id: string | null
  zernio_profile_id: string | null
  zernio_profile_ids: string[] | null
}

export async function deleteClientAccount(
  supabase: SupabaseClient,
  profileId: string,
  actingAdminProfileId: string,
): Promise<DeleteClientAccountResult> {
  if (profileId === actingAdminProfileId) {
    return { ok: false, error: 'You cannot delete your own admin account.', status: 400 }
  }

  const { data: profile, error: loadError } = await supabase
    .from('profiles')
    .select('id, email, clerk_user_id, role, stripe_subscription_id, zernio_profile_id, zernio_profile_ids')
    .eq('id', profileId)
    .maybeSingle()

  if (loadError) return { ok: false, error: loadError.message, status: 500 }
  if (!profile) return { ok: false, error: 'Client not found', status: 404 }

  const row = profile as ClientProfileRow
  if (row.role === 'admin' || row.role === 'owner') {
    return { ok: false, error: 'Admin accounts cannot be deleted from this panel.', status: 400 }
  }

  const { count: teamMemberCount } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', profileId)
    .neq('member_profile_id', profileId)

  if ((teamMemberCount ?? 0) > 0) {
    return {
      ok: false,
      error: 'Remove all team members from this workspace before deleting the owner account.',
      status: 400,
    }
  }

  if (row.stripe_subscription_id) {
    const cancelResult = await cancelStripeSubscriptionBeforeDelete(
      row.stripe_subscription_id,
      getStripeClient(),
    )
    if (cancelResult) return cancelResult
  }

  const zernioIds = collectZernioProfileIds(row)
  if (zernioIds.length) {
    // Best-effort: stale Zernio profile ids return false from teardown and must not
    // permanently block admin deletes. Stripe cancel above is the hard fail-closed gate.
    await disconnectAllZernioProfiles(zernioIds).catch(err =>
      console.error('[deleteClientAccount] Zernio teardown failed:', err),
    )
  }

  for (const table of USER_ID_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', profileId)
    if (error) console.error(`[deleteClientAccount] ${table} delete failed:`, error.message)
  }

  for (const table of PROFILE_ID_TABLES) {
    const { error } = await supabase.from(table).delete().eq('profile_id', profileId)
    if (error) console.error(`[deleteClientAccount] ${table} delete failed:`, error.message)
  }

  await supabase.from('team_members').delete().eq('member_profile_id', profileId)
  await supabase.from('team_members').delete().eq('account_id', profileId)

  if (row.clerk_user_id) {
    const secretKey = process.env.CLERK_SECRET_KEY?.trim()
    if (secretKey) {
      try {
        const clerk = createClerkClient({ secretKey })
        await clerk.users.deleteUser(row.clerk_user_id)
      } catch (err) {
        console.error('[deleteClientAccount] Clerk delete failed:', err)
      }
    }
  }

  const { error: profileDeleteError } = await supabase.from('profiles').delete().eq('id', profileId)
  if (profileDeleteError) {
    return { ok: false, error: profileDeleteError.message, status: 500 }
  }

  return { ok: true }
}
