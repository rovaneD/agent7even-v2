import type { SupabaseClient } from '@supabase/supabase-js'
import { getAnalyticsProfileForClerkUser, type AnalyticsProfile } from './getAnalyticsProfile'
import {
  getWorkspaceAuthContext,
  workspaceActorId,
  workspaceDataUserId,
  type WorkspaceSession,
} from './workspaceSession'

export type PostsWorkspaceContext = {
  session: WorkspaceSession
  workspaceId: string
  memberId: string
  profile: AnalyticsProfile
}

/** Workspace-scoped profile + IDs for Posts/Zernio API routes. */
export async function resolvePostsWorkspace(
  supabase: SupabaseClient,
): Promise<PostsWorkspaceContext | null> {
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx) return null
  const profile = await getAnalyticsProfileForClerkUser(supabase, ctx.clerkUserId, ctx.email)
  if (!profile) return null
  return {
    session: ctx.session,
    workspaceId: workspaceDataUserId(ctx.session),
    memberId: workspaceActorId(ctx.session),
    profile,
  }
}
