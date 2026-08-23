import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getWorkspaceSessionFromRequest,
  workspaceActorId,
  workspaceDataUserId,
  type WorkspaceSession,
} from '@/lib/profiles/workspaceSession'

export type CampaignWorkspaceProfile = {
  id: string
  company_name: string | null
  foundation_answers: Record<string, unknown> | null
}

export type CampaignWorkspaceGate =
  | { ok: true; workspaceId: string; memberId: string }
  | { ok: false; status: 401; error: string }

/**
 * Campaigns pages list `.eq('user_id', workspaceId)`. Writes must use the
 * same key or team-created campaigns 404 and vanish from My campaigns.
 */
export function campaignWorkspaceGate(session: WorkspaceSession | null): CampaignWorkspaceGate {
  if (!session) return { ok: false, status: 401, error: 'Unauthorized' }
  return {
    ok: true,
    workspaceId: workspaceDataUserId(session),
    memberId: workspaceActorId(session),
  }
}

export type CampaignWorkspaceResult =
  | {
      ok: true
      workspaceId: string
      memberId: string
      profile: CampaignWorkspaceProfile
    }
  | { ok: false; status: 401 | 404; error: string }

export async function requireCampaignWorkspace(
  supabase: SupabaseClient,
): Promise<CampaignWorkspaceResult> {
  const session = await getWorkspaceSessionFromRequest(supabase)
  const gate = campaignWorkspaceGate(session)
  if (!gate.ok) return gate

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, foundation_answers')
    .eq('id', gate.workspaceId)
    .maybeSingle()

  if (!profile?.id) {
    return { ok: false, status: 404, error: 'Profile not found' }
  }

  return {
    ok: true,
    workspaceId: gate.workspaceId,
    memberId: gate.memberId,
    profile: profile as CampaignWorkspaceProfile,
  }
}
