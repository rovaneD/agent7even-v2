import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import {
  getWorkspaceAuthContext,
  workspaceActorId,
  workspaceDataUserId,
  type WorkspaceSession,
} from '@/lib/profiles/workspaceSession'

export type DeliverableWorkspaceGate =
  | { ok: true; workspaceId: string; memberId: string }
  | { ok: false; status: 401 | 403; error: string }

/**
 * Deliverables pages list `.eq('projects.user_id', workspaceId)`.
 * Client uploads and downloads must use the same key or teammates see an empty
 * folder (admin files live on the owner) and member uploads vanish from the owner.
 */
export function deliverableWorkspaceGate(input: {
  session: WorkspaceSession | null
  hasDeliverablesPermission: boolean
}): DeliverableWorkspaceGate {
  if (!input.session) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  if (!input.hasDeliverablesPermission) {
    return { ok: false, status: 403, error: 'Deliverables access required' }
  }
  return {
    ok: true,
    workspaceId: workspaceDataUserId(input.session),
    memberId: workspaceActorId(input.session),
  }
}

export type DeliverableWorkspaceResult =
  | { ok: true; workspaceId: string; memberId: string }
  | { ok: false; status: 401 | 403; error: string }

/** Auth + deliverables permission for client Deliverables APIs. */
export async function requireDeliverableWorkspace(
  supabase: SupabaseClient,
): Promise<DeliverableWorkspaceResult> {
  const ctx = await getWorkspaceAuthContext(supabase)
  const perms = ctx ? await getTeamPermissions(ctx.session.memberId) : null
  return deliverableWorkspaceGate({
    session: ctx?.session ?? null,
    hasDeliverablesPermission: perms ? hasPermission(perms, 'deliverables') : false,
  })
}

export function deliverableWorkspaceGateResponse(
  result: Extract<DeliverableWorkspaceResult, { ok: false }>,
): NextResponse {
  return NextResponse.json({ error: result.error }, { status: result.status })
}

export function projectUserIdFromDeliverable(deliverable: {
  projects?: { user_id?: string | null } | { user_id?: string | null }[] | null
}): string | null {
  const project = Array.isArray(deliverable.projects)
    ? deliverable.projects[0]
    : deliverable.projects
  return project?.user_id ?? null
}

/** Workspace members may read/mutate owner files; platform admins bypass tenancy. */
export function canAccessWorkspaceDeliverable(input: {
  isPlatformAdmin: boolean
  workspaceId: string
  memberId: string
  projectUserId: string | null
  uploadedBy: string | null
}): boolean {
  if (input.isPlatformAdmin) return true
  if (input.projectUserId && input.projectUserId === input.workspaceId) return true
  // Pre-fix teammate uploads were keyed off the member profile.
  if (input.uploadedBy && input.uploadedBy === input.memberId) return true
  return false
}
