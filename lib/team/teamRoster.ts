import type { SupabaseClient } from '@supabase/supabase-js'
import { formatProfileDisplayName } from '@/lib/profiles/resolveActorName'

export type WorkspaceTeamMemberRow = {
  profileId: string | null
  name: string
  email: string
  role: string
  status: string
}

export async function listWorkspaceTeamMembers(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceTeamMemberRow[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select(
      'role, status, invited_email, member_profile_id, profiles!team_members_member_profile_id_fkey(full_name, email)',
    )
    .eq('account_id', workspaceId)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: true })

  if (error) {
    if (error.message.includes('team_members')) return []
    throw new Error(error.message)
  }

  return (data ?? []).map(row => {
    const profile = row.profiles as { full_name?: string | null; email?: string | null } | null
    const email = profile?.email?.trim() || (row.invited_email as string | null)?.trim() || ''
    return {
      profileId: (row.member_profile_id as string | null) ?? null,
      name: formatProfileDisplayName(profile ?? { email: row.invited_email }),
      email,
      role: row.role as string,
      status: row.status as string,
    }
  })
}
