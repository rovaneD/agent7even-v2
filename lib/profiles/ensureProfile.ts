import type { User } from '@clerk/nextjs/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type FoundationProfile = {
  id: string
  company_name: string | null
  business_type: string | null
  foundation_complete: boolean | null
  foundation_step: number | null
}

const FOUNDATION_SELECT =
  'id, company_name, business_type, foundation_complete, foundation_step'

const LINK_SELECT =
  'id, clerk_user_id, stripe_customer_id, stripe_subscription_id, plan, status, created_at, company_name, business_type, foundation_complete, foundation_step'

function roleRank(role?: string | null): number {
  if (role === 'owner') return 0
  if (role === 'admin') return 1
  return 2
}

export function pickCanonicalProfile<
  T extends {
    id: string
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan: string | null
    created_at: string
    role?: string | null
  },
>(rows: T[]): T {
  return [...rows].sort((a, b) => {
    const ar = roleRank(a.role)
    const br = roleRank(b.role)
    if (ar !== br) return ar - br
    if (a.stripe_customer_id && !b.stripe_customer_id) return -1
    if (!a.stripe_customer_id && b.stripe_customer_id) return 1
    if (a.plan && !b.plan) return -1
    if (!a.plan && b.plan) return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })[0]
}

/** Resolve or create the Supabase profile row for a Clerk user (handles email reuse). */
export async function ensureProfileForClerkUser(
  supabase: SupabaseClient,
  userId: string,
  user: User | null,
): Promise<{ profile: FoundationProfile | null; error?: string }> {
  const email = user?.emailAddresses?.[0]?.emailAddress ?? ''
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  const avatarUrl = user?.imageUrl ?? ''

  const { data: byClerk } = await supabase
    .from('profiles')
    .select(FOUNDATION_SELECT)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (byClerk) return { profile: byClerk }

  if (email) {
    const { data: existingByEmail } = await supabase
      .from('profiles')
      .select(LINK_SELECT)
      .ilike('email', email)
      .neq('status', 'churned')
      .order('created_at', { ascending: true })

    const rows = existingByEmail ?? []
    if (rows.length > 0) {
      const canonical = pickCanonicalProfile(rows)

      const { data: linked, error: linkError } = await supabase
        .from('profiles')
        .update({
          clerk_user_id: userId,
          full_name: fullName || undefined,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', canonical.id)
        .select(FOUNDATION_SELECT)
        .single()

      if (linkError) {
        console.error('[ensureProfile] link by email failed:', linkError.message)
        return { profile: null, error: linkError.message }
      }

      const orphanIds = rows
        .filter(
          (p) =>
            p.id !== canonical.id &&
            !p.stripe_customer_id &&
            !p.stripe_subscription_id,
        )
        .map((p) => p.id)

      if (orphanIds.length > 0) {
        await supabase.from('profiles').delete().in('id', orphanIds)
      }

      return { profile: linked }
    }
  }

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .upsert(
      {
        clerk_user_id: userId,
        email,
        full_name: fullName,
        avatar_url: avatarUrl,
        role: 'client',
        status: 'onboarding',
      },
      { onConflict: 'clerk_user_id' },
    )
    .select(FOUNDATION_SELECT)
    .single()

  if (insertError) {
    console.error('[ensureProfile] insert failed:', insertError.message)
    return { profile: null, error: insertError.message }
  }

  return { profile: created }
}
