import type { SupabaseClient } from '@supabase/supabase-js'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'

export type FoundationWorkspaceSession = {
  memberId: string
  workspaceId: string
}

/** Resolve member + workspace IDs for Foundation API routes (team-safe reads/writes). */
export async function resolveFoundationWorkspaceForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<FoundationWorkspaceSession | null> {
  const profile = await getDashboardProfileForClerkUser(supabase, clerkUserId, email)
  if (!profile?.id) return null

  const workspaceId = await resolveWorkspaceProfileId(supabase, profile.id)
  return { memberId: profile.id, workspaceId }
}
