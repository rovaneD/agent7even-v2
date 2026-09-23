import type { SupabaseClient } from '@supabase/supabase-js'
import { isAtlasClerkSignup } from '@/lib/auth/clerkSignupProduct'
import { activateTeamInviteForProfile, findPendingTeamInviteByEmail } from '@/lib/team/activateTeamInvite'

export type ClerkUserCreatedData = {
  id: string
  email_addresses?: { email_address?: string }[]
  first_name?: string | null
  last_name?: string | null
  image_url?: string | null
  unsafe_metadata?: unknown
  public_metadata?: unknown
}

export type UserCreatedResult =
  | { action: 'skipped_atlas_only' }
  | { action: 'linked_existing'; profileId: string; joinedViaTeamInvite: boolean }
  | {
      action: 'provisioned'
      profileId: string
      joinedViaTeamInvite: boolean
      shouldWelcome: boolean
    }

export type UserCreatedEffects = {
  sendWelcome?: (opts: { email: string; firstName: string }) => Promise<void>
  notifyAdmin?: (opts: {
    profileId: string
    email: string
    fullName: string
    joinedViaTeamInvite: boolean
  }) => Promise<void>
  trackSignup?: (opts: { teamInvite: boolean }) => Promise<void>
}

function createdEmail(data: ClerkUserCreatedData): string {
  return data.email_addresses?.[0]?.email_address ?? ''
}

function createdName(data: ClerkUserCreatedData): string {
  return [data.first_name, data.last_name].filter(Boolean).join(' ')
}

/**
 * Shared Clerk user.created handling.
 * `product: "atlas"` is onboarding intent only — never entitlement.
 * Atlas-only signups skip Maya profile + welcome.
 * A pending Maya invitation still provisions so the invitee is not stranded.
 */
export async function handleClerkUserCreated(
  supabase: SupabaseClient,
  data: ClerkUserCreatedData,
  effects: UserCreatedEffects = {},
): Promise<UserCreatedResult> {
  const atlasIntent = isAtlasClerkSignup(data)
  const email = createdEmail(data)
  const pendingInvite = email ? await findPendingTeamInviteByEmail(supabase, email) : null

  if (atlasIntent && !pendingInvite) {
    return { action: 'skipped_atlas_only' }
  }

  const id = data.id
  const fullName = createdName(data)
  const imageUrl = data.image_url ?? ''

  if (email) {
    const { data: existingByEmail } = await supabase
      .from('profiles')
      .select('id, clerk_user_id, stripe_customer_id, stripe_subscription_id, plan, status, created_at')
      .ilike('email', email)
      .neq('status', 'churned')
      .order('created_at', { ascending: true })

    const others = (existingByEmail ?? []).filter((p) => p.clerk_user_id !== id)
    if (others.length > 0) {
      const canonical = [...(existingByEmail ?? [])].sort((a, b) => {
        if (a.stripe_customer_id && !b.stripe_customer_id) return -1
        if (!a.stripe_customer_id && b.stripe_customer_id) return 1
        if (a.plan && !b.plan) return -1
        if (!a.plan && b.plan) return 1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })[0]

      await supabase
        .from('profiles')
        .update({
          clerk_user_id: id,
          full_name: fullName || undefined,
          ...(imageUrl ? { avatar_url: imageUrl } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', canonical.id)

      const orphanIds = (existingByEmail ?? [])
        .filter((p) => p.id !== canonical.id && !p.stripe_customer_id && !p.stripe_subscription_id)
        .map((p) => p.id)

      if (orphanIds.length > 0) {
        await supabase.from('profiles').delete().in('id', orphanIds)
      }

      const teamActivation = await activateTeamInviteForProfile(supabase, canonical.id, email)
      return {
        action: 'linked_existing',
        profileId: canonical.id,
        joinedViaTeamInvite: Boolean(teamActivation?.activated),
      }
    }
  }

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .upsert(
      {
        clerk_user_id: id,
        email,
        full_name: fullName,
        avatar_url: imageUrl,
        role: 'client',
        status: 'onboarding',
        onboarding_complete: false,
      },
      { onConflict: 'clerk_user_id' },
    )
    .select('id')
    .single()

  if (error || !newProfile?.id) {
    console.error('Supabase upsert error (user.created):', error)
    return {
      action: 'provisioned',
      profileId: '',
      joinedViaTeamInvite: false,
      shouldWelcome: false,
    }
  }

  let joinedViaTeamInvite = false
  if (email) {
    const teamActivation = await activateTeamInviteForProfile(supabase, newProfile.id, email)
    if (teamActivation?.activated) joinedViaTeamInvite = true
  }

  const shouldWelcome = Boolean(email) && !atlasIntent && !joinedViaTeamInvite
  if (shouldWelcome && effects.sendWelcome) {
    try {
      await effects.sendWelcome({ email, firstName: data.first_name ?? '' })
    } catch (emailError) {
      console.error('Welcome email failed:', emailError)
    }
  }

  if (effects.trackSignup) {
    try {
      await effects.trackSignup({ teamInvite: joinedViaTeamInvite })
    } catch (trackError) {
      console.error('Vercel analytics track failed (Signup):', trackError)
    }
  }

  if (effects.notifyAdmin) {
    try {
      await effects.notifyAdmin({
        profileId: newProfile.id,
        email,
        fullName,
        joinedViaTeamInvite,
      })
    } catch (adminNotifyError) {
      console.error('Admin signup notify failed:', adminNotifyError)
    }
  }

  return {
    action: 'provisioned',
    profileId: newProfile.id,
    joinedViaTeamInvite,
    shouldWelcome,
  }
}
