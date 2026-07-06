import type { SupabaseClient } from '@supabase/supabase-js'
import { getTeamPermissions } from '@/lib/teamPermissions'

export type OwnerGuardResult =
  | { ok: true; memberId: string }
  | { ok: false; status: number; error: string; code: 'owner_required' | 'connect_owner_only' }

/** Block team members from owner-only integration mutations (GA connect, billing, etc.). */
export async function requireWorkspaceOwner(
  supabase: SupabaseClient,
  memberProfileId: string,
  code: 'owner_required' | 'connect_owner_only' = 'owner_required',
): Promise<OwnerGuardResult> {
  const perms = await getTeamPermissions(memberProfileId)
  if (perms.isOwner) return { ok: true, memberId: memberProfileId }

  return {
    ok: false,
    status: 403,
    code: code === 'connect_owner_only' ? 'connect_owner_only' : 'owner_required',
    error: 'Only the account owner can perform this action.',
  }
}
