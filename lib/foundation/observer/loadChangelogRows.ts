import { createServiceClient } from '@/lib/supabase/server'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'
import type { FoundationChangelogRow } from '@/lib/foundation/observer/types'

const DEFAULT_LIMIT = 50

export async function loadFoundationChangelogRows(
  actorProfileId: string,
  limit = DEFAULT_LIMIT,
): Promise<FoundationChangelogRow[]> {
  const supabase = createServiceClient()
  const profileId = await resolveWorkspaceProfileId(supabase, actorProfileId)

  const { data, error } = await supabase
    .from('foundation_changelog')
    .select('id, signal_type, agent_id, content_summary, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (error) {
    if (error.message.includes('foundation_changelog')) return []
    throw new Error(`loadFoundationChangelogRows: ${error.message}`)
  }

  return (data ?? []) as FoundationChangelogRow[]
}
