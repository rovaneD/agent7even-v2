import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadProposalThemePolicy,
  shouldBlockProposalTheme,
} from '@/lib/foundation/proposals/proposalThemePolicy'

const AUTO_DISMISS_NOTE =
  'Auto-dismissed: this theme already has an approved Foundation layer.'

/** Hide orphan pending rows whose theme is covered by an approved layer. */
export async function dismissStalePendingProposals(
  supabase: SupabaseClient,
  profileId: string,
): Promise<number> {
  const policy = await loadProposalThemePolicy(supabase, profileId)

  const { data, error } = await supabase
    .from('foundation_proposals')
    .select('id, theme')
    .eq('profile_id', profileId)
    .eq('guardian_verdict', 'surface')
    .eq('user_decision', 'pending')

  if (error) {
    if (error.message.includes('user_decision')) return 0
    throw new Error(error.message)
  }

  const staleIds = (data ?? [])
    .filter(row => shouldBlockProposalTheme(row.theme, policy))
    .map(row => row.id as string)

  if (staleIds.length === 0) return 0

  const decidedAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('foundation_proposals')
    .update({
      user_decision: 'rejected',
      decided_at: decidedAt,
      decision_note: AUTO_DISMISS_NOTE,
    })
    .in('id', staleIds)

  if (updateError) throw new Error(updateError.message)
  return staleIds.length
}
