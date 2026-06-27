import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withZernioUsageContext } from '@/lib/social/zernioUsage'

export type ZernioProfileContext = {
  profileUserId: string
  profileIds: string[]
  primaryProfileId: string
}

export async function requireZernioProfile(): Promise<
  { error: NextResponse } | ZernioProfileContext
> {
  const { userId } = await auth()
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan, zernio_profile_id, zernio_profile_ids')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.plan) {
    return { error: NextResponse.json({ error: 'active_plan_required' }, { status: 403 }) }
  }

  const profileIds = (profile.zernio_profile_ids as string[] | null) ?? []
  if (profile.zernio_profile_id && !profileIds.includes(profile.zernio_profile_id)) {
    profileIds.push(profile.zernio_profile_id)
  }

  if (profileIds.length === 0) {
    return { error: NextResponse.json({ error: 'not_connected' }, { status: 404 }) }
  }

  return {
    profileUserId: profile.id as string,
    profileIds,
    primaryProfileId: (profile.zernio_profile_id as string | null) ?? profileIds[0],
  }
}

/** Resolve tenant Zernio context and run publisher calls with usage logging. */
export async function withZernioProfileUsage<T>(
  fn: (ctx: ZernioProfileContext) => Promise<T>,
): Promise<T | NextResponse> {
  const ctx = await requireZernioProfile()
  if ('error' in ctx) return ctx.error
  return withZernioUsageContext(
    { userId: ctx.profileUserId, zernioProfileId: ctx.primaryProfileId },
    () => fn(ctx),
  )
}
