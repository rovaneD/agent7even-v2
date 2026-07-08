import { auth, currentUser } from '@clerk/nextjs/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { activateTeamInviteForProfile } from '@/lib/team/activateTeamInvite'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'

/** Member + workspace IDs for a Clerk session (Phase 1 team workspace SSOT). */
export type WorkspaceSession = {
  memberId: string
  workspaceId: string
}

/**
 * Resolve the signed-in member and the workspace owner profile id used for company data.
 * Idempotent team-invite linking runs when email is provided.
 */
export async function getWorkspaceSessionForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<WorkspaceSession | null> {
  const member = await resolveClerkProfile(supabase, clerkUserId, 'id', email)
  if (!member?.id) return null

  if (email?.trim()) {
    await activateTeamInviteForProfile(supabase, member.id, email)
  }

  const workspaceId = await resolveWorkspaceProfileId(supabase, member.id)
  return { memberId: member.id, workspaceId }
}

/** Company data tenancy key — use for all `user_id` reads/writes on workspace-owned tables. */
export function workspaceDataUserId(session: WorkspaceSession): string {
  return session.workspaceId
}

/** Actor attribution key until Phase 2 `actor_profile_id` columns ship. */
export function workspaceActorId(session: WorkspaceSession): string {
  return session.memberId
}

/** Resolve workspace session from the current Clerk request (API routes + server actions). */
export async function getWorkspaceSessionFromRequest(
  supabase: SupabaseClient,
): Promise<WorkspaceSession | null> {
  const ctx = await getWorkspaceAuthContext(supabase)
  return ctx?.session ?? null
}

export type WorkspaceAuthContext = {
  session: WorkspaceSession
  clerkUserId: string
  email: string | null
}

/** Resolve session plus Clerk identifiers — use when loading workspace-scoped profile rows by Clerk user. */
export async function getWorkspaceAuthContext(
  supabase: SupabaseClient,
): Promise<WorkspaceAuthContext | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const session = await getWorkspaceSessionForClerkUser(supabase, userId, email)
  if (!session) return null
  return { session, clerkUserId: userId, email }
}

/** Workspace data tenancy key for the signed-in Clerk user (API routes). */
export async function resolveWorkspaceDataUserIdForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<string | null> {
  const session = await getWorkspaceSessionForClerkUser(supabase, clerkUserId, email)
  if (!session) return null
  return workspaceDataUserId(session)
}

/** Workspace data tenancy key from the current request (API routes). */
export async function requireWorkspaceDataUserId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx) return null
  return workspaceDataUserId(ctx.session)
}
