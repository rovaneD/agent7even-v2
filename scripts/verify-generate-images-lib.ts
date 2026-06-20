/**
 * Shared helpers for generate-images HTTP verification scripts.
 */
import { createClerkClient } from '@clerk/backend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertGenerationFloor } from '../lib/foundation/sectionStrength'

export async function getClerkJwt(clerkUserId: string): Promise<string> {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })
  const { data: sessions } = await clerk.sessions.getSessionList({
    userId: clerkUserId,
    status: 'active',
    limit: 1,
  })
  const sessionId = sessions[0]?.id ?? (await clerk.sessions.createSession({ userId: clerkUserId })).id
  const res = await fetch(`https://api.clerk.com/v1/sessions/${sessionId}/tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`Clerk token mint failed: ${res.status}`)
  return ((await res.json()) as { jwt: string }).jwt
}

/** First profile whose clerk_user_id still exists in Clerk (stale IDs are skipped). */
export async function findProfileWithValidClerkJwt(
  sb: SupabaseClient,
  limit = 20,
): Promise<{ id: string; clerk_user_id: string; company_name: string | null }> {
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, clerk_user_id, company_name, foundation_score, plan')
    .not('clerk_user_id', 'is', null)
    .not('plan', 'is', null)
    .order('foundation_score', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (!profiles?.length) throw new Error('No profiles with clerk_user_id')

  for (const profile of profiles) {
    if (!profile.clerk_user_id) continue
    try {
      await getClerkJwt(profile.clerk_user_id)
      return profile as { id: string; clerk_user_id: string; company_name: string | null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  skip stale clerk id ${profile.clerk_user_id}: ${msg}`)
    }
  }

  throw new Error('No profile with a valid Clerk user (all clerk_user_id values stale?)')
}

/** Profile with plan, valid Clerk JWT, and Foundation generation floor passed. */
export async function findGenerationTestProfile(
  sb: SupabaseClient,
  limit = 30,
): Promise<{ id: string; clerk_user_id: string; company_name: string | null }> {
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, clerk_user_id, company_name, foundation_score, plan')
    .not('clerk_user_id', 'is', null)
    .not('plan', 'is', null)
    .order('foundation_score', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (!profiles?.length) throw new Error('No profiles with clerk_user_id and plan')

  for (const profile of profiles) {
    if (!profile.clerk_user_id) continue
    const floor = await assertGenerationFloor(profile.id)
    if (!floor.ok) {
      console.warn(
        `  skip ${profile.company_name ?? profile.id}: floor blocked (${floor.section} ${floor.score}%)`,
      )
      continue
    }
    try {
      await getClerkJwt(profile.clerk_user_id)
      return profile as { id: string; clerk_user_id: string; company_name: string | null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  skip stale clerk id ${profile.clerk_user_id}: ${msg}`)
    }
  }

  throw new Error('No profile passes generation floor with a valid Clerk user')
}

export const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export function assertFlagOn(): boolean {
  const flagOn = process.env.NEXT_PUBLIC_IMAGE_GENERATION === 'true'
  console.log(`NEXT_PUBLIC_IMAGE_GENERATION=${flagOn}`)
  console.log(`appUrl=${appUrl}\n`)
  if (!flagOn) {
    console.log('SKIP: set NEXT_PUBLIC_IMAGE_GENERATION=true and restart dev server.')
    return false
  }
  return true
}
